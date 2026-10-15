import { closedDailyWindow, formatShanghaiDate, signalsInWindow } from '@/core/daily/clock';
import { DAILY_ACTUATION } from '@/core/daily/types';
import { aggregateLaneReports } from '@/core/daily/aggregator';
import { runFleet } from '@/core/daily/fleet';
import { LAW_DEFINITIONS, cloneGenome } from '@/core/daily/genome';
import { createGrokBotPortFromProcessEnv } from '@/core/daily/grok-port';
import { FOURTEEN_ELEMENTS_CONFIG } from '@/core/constants/fourteen-elements';
import { mergeReaderNotes, readerExecutionLabel } from '@/core/daily/analysis-reader';
import { buildVersionWatchTasks, scorePriorityVersions } from '@/core/priority/version-watch';
import type {
  AnalysisReader,
  DailyRunResult,
  EntityProfile,
  GrokBotPort,
  IntelSignal,
  ModelGenome,
  MonitoringTasks,
} from '@/core/daily/types';
import type { ReaderLaneNote } from '@/core/daily/analysis-reader';

export interface DailyCycleInput {
  now: Date;
  signals: IntelSignal[];
  genome: ModelGenome;
  entities: EntityProfile[];
  port?: GrokBotPort;
  generatedAt?: string;
  analysisReader?: AnalysisReader;
  readerNotes?: ReaderLaneNote[];
}

function monitoringTasks(genome: ModelGenome, entities: EntityProfile[]): MonitoringTasks {
  return {
    elements: FOURTEEN_ELEMENTS_CONFIG.map((spec) => ({
      code: spec.code,
      nameZh: spec.nameZh,
      weight: genome.weights[spec.code],
      defaultWeight: spec.defaultWeight,
      hazardDescription: spec.hazardDescription,
    })),
    laws: {
      lambdas: [...genome.lawLambdas] as [number, number, number],
      definitions: LAW_DEFINITIONS,
    },
    entities: entities.map((entity) => ({
      s2Did: entity.s2Did,
      entityName: entity.entityName,
      s2Category: entity.s2Category,
      domainType: entity.domainType,
    })),
    hypotheses: genome.hypotheses.map((item) => ({
      geneId: item.geneId,
      stance: item.stance,
      targetElement: item.targetElement,
      observationIntent: item.observationIntent,
    })),
    previousForecast: genome.lastForecast,
    versionWatches: buildVersionWatchTasks(),
  };
}

async function proofHash(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(`RAO|ZERO-ACTUATION|DAILY|${payload}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** One closed Shanghai day: clip intelligence, run the fleet, then let the aggregator update the local genome. */
export async function runDailyCycle(input: DailyCycleInput): Promise<DailyRunResult> {
  const window = closedDailyWindow(input.now);
  const signals = signalsInWindow(input.signals, window);
  const genomeBefore = cloneGenome(input.genome);
  const port = input.port ?? createGrokBotPortFromProcessEnv(process.env);
  const tasks = monitoringTasks(genomeBefore, input.entities);
  const [fleetReports, versionScores] = await Promise.all([
    runFleet({
      port,
      task: {
        window,
        signals,
        tasks,
      },
    }),
    scorePriorityVersions(signals, tasks.versionWatches),
  ]);
  const requestedReader = input.analysisReader ?? 'BUILTIN';
  const readerNotes = input.readerNotes ?? [];
  const analysisReader: AnalysisReader =
    requestedReader === 'DEEPSEEK' && readerNotes.length === 0 ? 'DEEPSEEK_FALLBACK' : requestedReader;
  const reports = analysisReader === 'DEEPSEEK' ? mergeReaderNotes(fleetReports, readerNotes) : fleetReports;
  const nextLabel = formatShanghaiDate(new Date(window.endIso));
  const aggregate = aggregateLaneReports({
    windowLabel: window.label,
    nextWindowLabel: nextLabel,
    signals,
    reports,
    genome: genomeBefore,
    entities: input.entities,
  });
  const mode = reports.every((report) => report.mode === 'CLOUD_GROK') ? 'CLOUD_GROK' : 'LOCAL_REHEARSAL';
  const executionLabel = readerExecutionLabel(analysisReader, mode);
  const hash = await proofHash(
    JSON.stringify({
      window: window.label,
      mode,
      analysisReader,
      scores: reports.map((report) => [report.laneId, report.securityScore]),
      versions: versionScores.map((score) => [score.versionId, score.securityScore, score.matched]),
      meanTti: aggregate.meanTti,
      generation: aggregate.proposedGenome.generation,
      actuation: DAILY_ACTUATION,
    }),
  );
  return {
    window,
    mode,
    executionLabel,
    analysisReader,
    actuation: DAILY_ACTUATION,
    laneReports: reports,
    meanSecurityScore: aggregate.meanSecurityScore,
    entityScores: aggregate.entityScores,
    meanTti: aggregate.meanTti,
    genomeBefore,
    proposedGenome: aggregate.proposedGenome,
    weightL1FromPrior: aggregate.weightL1FromPrior,
    forecastVerdict: aggregate.forecastVerdict,
    versionScores,
    synthesis: `${aggregate.synthesis}重点观察命中 ${versionScores.filter((score) => score.matched).length} 个 Anthropic / OpenAI 版本关键词。`,
    zeroActuationProofHash: hash,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
