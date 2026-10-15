import { buildDailyReport } from '@/core/daily/report';
import type {
  AnalysisReader,
  BaselineStore,
  BotMode,
  DailyRunResult,
  EntityDayScore,
  ForecastVerdict,
  LaneId,
} from '@/core/daily/types';

export interface StoredCitation {
  title: string;
  source: string;
  url: string;
}

export interface StoredLane {
  laneId: LaneId;
  botId: string;
  securityScore: number;
  status: 'COMPLETE' | 'QUIET';
  impactSummary: string;
  citations: StoredCitation[];
}

/** One closed day, small enough to archive. Genomes stay on the machine that computed them. */
export interface StoredDay {
  windowLabel: string;
  startIso: string;
  endIso: string;
  generatedAt: string;
  mode: BotMode;
  executionLabel: string;
  analysisReader: AnalysisReader;
  actuation: 'NONE';
  meanSecurityScore: number;
  meanTti: number;
  forecastVerdict: ForecastVerdict;
  weightL1FromPrior: number;
  synthesis: string;
  reportMarkdown: string;
  laneReports: StoredLane[];
  versionScores: DailyRunResult['versionScores'];
  entityScores: EntityDayScore[];
}

export function historyServiceStatus(env: Record<string, string | undefined>): { online: boolean; store: 'supabase' | 'local' } {
  const url = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) return { online: true, store: 'supabase' };
  return { online: false, store: 'local' };
}

export function toStoredDay(run: DailyRunResult): StoredDay {
  return {
    windowLabel: run.window.label,
    startIso: run.window.startIso,
    endIso: run.window.endIso,
    generatedAt: run.generatedAt,
    mode: run.mode,
    executionLabel: run.executionLabel,
    analysisReader: run.analysisReader,
    actuation: 'NONE',
    meanSecurityScore: run.meanSecurityScore,
    meanTti: run.meanTti,
    forecastVerdict: run.forecastVerdict,
    weightL1FromPrior: run.weightL1FromPrior,
    synthesis: run.synthesis,
    reportMarkdown: buildDailyReport(run),
    laneReports: run.laneReports.map((report) => ({
      laneId: report.laneId,
      botId: report.botId,
      securityScore: report.securityScore,
      status: report.status,
      impactSummary: report.impactSummary,
      citations: report.citations,
    })),
    versionScores: run.versionScores,
    entityScores: run.entityScores,
  };
}

export function upsertDay(days: StoredDay[], day: StoredDay): StoredDay[] {
  const next = days.filter((item) => item.windowLabel !== day.windowLabel);
  next.push(day);
  next.sort((left, right) => left.windowLabel.localeCompare(right.windowLabel));
  return next;
}

export function overlayDays(store: BaselineStore, days: StoredDay[]): BaselineStore {
  if (days.length === 0) return store;
  const byLabel = new Map(days.map((day) => [day.windowLabel, day]));
  return {
    ...store,
    runs: store.runs.map((run) => {
      const day = byLabel.get(run.window.label);
      return day ? applyStoredDay(run, day) : run;
    }),
    trend: store.trend.map((point) => {
      const day = byLabel.get(point.label);
      if (!day) return point;
      return { ...point, meanSecurityScore: day.meanSecurityScore, meanTti: day.meanTti };
    }),
  };
}

export function applyStoredDay(run: DailyRunResult, day: StoredDay): DailyRunResult {
  const byLane = new Map(day.laneReports.map((item) => [item.laneId, item]));
  return {
    ...run,
    generatedAt: day.generatedAt,
    mode: day.mode,
    executionLabel: day.executionLabel,
    analysisReader: day.analysisReader,
    meanSecurityScore: day.meanSecurityScore,
    meanTti: day.meanTti,
    forecastVerdict: day.forecastVerdict,
    weightL1FromPrior: day.weightL1FromPrior,
    synthesis: day.synthesis,
    versionScores: day.versionScores,
    entityScores: day.entityScores,
    laneReports: run.laneReports.map((report) => {
      const saved = byLane.get(report.laneId);
      if (!saved) return report;
      return {
        ...report,
        botId: saved.botId,
        securityScore: saved.securityScore,
        status: saved.status,
        impactSummary: saved.impactSummary,
        citations: saved.citations,
      };
    }),
  };
}
