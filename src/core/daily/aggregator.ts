import { ELEMENT_CODES, FOURTEEN_ELEMENTS_CONFIG, elementByCode, type ElementCode } from '@/core/constants/fourteen-elements';
import { computeRsiProbeFitness } from '@/core/engines/rsi-evolver';
import { calculateTotalThreatIndex } from '@/core/engines/tti-calculator';
import { cloneElements, applyTrustRegion, l1Distance, zeroElements } from '@/core/daily/pressure';
import { cloneGenome } from '@/core/daily/genome';
import type { EntityProfile } from '@/core/daily/types';
import type {
  EntityDayScore,
  ForecastVerdict,
  GrokBotLaneReport,
  HorizonForecast,
  IntelSignal,
  LawPressure,
  ModelGenome,
} from '@/core/daily/types';

const COUPLING: Partial<Record<ElementCode, Partial<Record<ElementCode, number>>>> = {
  E14_CARBON_SOVEREIGNTY: {
    E05_MOMENTUM: 0.2,
    E06_METABOLIC: 0.08,
    E12_LOGIC_MEMORY: 0.15,
  },
};

export interface AggregateInput {
  windowLabel: string;
  nextWindowLabel: string;
  signals: IntelSignal[];
  reports: GrokBotLaneReport[];
  genome: ModelGenome;
  entities: EntityProfile[];
}

export interface AggregateOutput {
  proposedGenome: ModelGenome;
  entityScores: EntityDayScore[];
  meanTti: number;
  meanSecurityScore: number;
  weightL1FromPrior: number;
  forecastVerdict: ForecastVerdict;
  synthesis: string;
}

function realizedFromSignals(signals: IntelSignal[]): Record<ElementCode, number> {
  const realized = zeroElements();
  for (const signal of signals) {
    for (const code of ELEMENT_CODES) {
      realized[code] = Math.min(1, realized[code] + (signal.elementPressure[code] ?? 0));
    }
  }
  return realized;
}

function issueForecast(windowLabel: string, nextLabel: string, priorWeights: Record<ElementCode, number>, signals: IntelSignal[]): HorizonForecast {
  const realized = realizedFromSignals(signals);
  const projected = zeroElements();
  for (const code of ELEMENT_CODES) projected[code] = realized[code] * 0.55;
  for (const [source, targets] of Object.entries(COUPLING) as [ElementCode, Partial<Record<ElementCode, number>>][]) {
    for (const [target, gain] of Object.entries(targets) as [ElementCode, number][]) {
      projected[target] = Math.min(1, projected[target] + realized[source] * gain);
    }
  }
  const ranked = ELEMENT_CODES.filter((code) => projected[code] >= 0.08)
    .sort((a, b) => projected[b] - projected[a])
    .slice(0, 3)
    .map((code) => elementByCode(code).nameZh);
  const narrative = ranked.length
    ? `下一窗持续性预测主要落在${ranked.join('、')}。若这些要素没有新的公开披露，这条预测应被判为未证实。`
    : '下一窗没有从本窗公开情报外推出明显的要素压力。';
  return {
    issuedFromWindow: windowLabel,
    forWindowLabel: nextLabel,
    elementPressure: projected,
    priorWeights: cloneElements(priorWeights),
    narrative,
  };
}

function evidenceNet(reports: GrokBotLaneReport[]): Record<ElementCode, number> {
  const net = zeroElements();
  for (const report of reports) {
    if (report.laneId === 'element-baseline-drift' || report.laneId === 'forecast-falsification') continue;
    for (const code of ELEMENT_CODES) net[code] += report.elementPressure[code] ?? 0;
  }
  return net;
}

function lawNet(reports: GrokBotLaneReport[]): LawPressure {
  const net: LawPressure = { law1: 0, law2: 0, law3: 0 };
  for (const report of reports) {
    net.law1 += report.lawPressure.law1;
    net.law2 += report.lawPressure.law2;
    net.law3 += report.lawPressure.law3;
  }
  return net;
}

function updateHypotheses(genome: ModelGenome, reports: GrokBotLaneReport[], scores: EntityDayScore[]): ModelGenome['hypotheses'] {
  const hottest = reports
    .filter((report) => report.laneId !== 'forecast-falsification' && report.laneId !== 'element-baseline-drift')
    .sort((a, b) => b.securityScore - a.securityScore)[0];
  const inducedFloor = scores.length ? Math.max(...scores.map((score) => score.ttiScore)) : 20;
  const next = [];
  for (const hypothesis of genome.hypotheses) {
    const related = reports.filter((report) =>
      report.impactSummary.includes(elementByCode(hypothesis.targetElement).nameZh),
    );
    const induced = related.length
      ? related.reduce((total, report) => total + report.securityScore, 0) / related.length
      : Math.min(inducedFloor, hypothesis.saturated ? 10 : 28);
    const fitness = computeRsiProbeFitness({
      probeId: hypothesis.geneId,
      generation: hypothesis.generation,
      inducedTtiScore: induced,
      triggeredCannedRefusal: hypothesis.saturated,
      semanticNoveltyScore: hypothesis.semanticNoveltyScore,
    });
    if (fitness.evolutionDirective === 'PRUNE_OBSOLETE') continue;
    const move = fitness.evolutionDirective === 'CROSSOVER_MUTATE' && hottest && hottest.securityScore >= 40;
    next.push({
      ...hypothesis,
      generation: move ? hypothesis.generation + 1 : hypothesis.generation,
      fitnessScore: fitness.fitnessScore,
      evolutionDirective: fitness.evolutionDirective,
      targetElement: hypothesis.targetElement,
    });
  }
  return next;
}

export function aggregateLaneReports(input: AggregateInput): AggregateOutput {
  if (input.reports.length < 10) {
    throw new Error(`Aggregator requires at least 10 lane reports, got ${input.reports.length}`);
  }
  const falsification = input.reports.find((report) => report.laneId === 'forecast-falsification');
  if (!falsification) throw new Error('Aggregator requires the forecast-falsification lane');

  const net = evidenceNet(input.reports);
  const mass = ELEMENT_CODES.reduce((total, code) => total + net[code], 0);
  const verdict = falsification.forecastVerdict;
  let weights = cloneElements(input.genome.weights);
  if (mass > 0.01) {
    const step = zeroElements();
    for (const code of ELEMENT_CODES) step[code] = input.genome.eta * net[code] * 0.08;
    weights = applyTrustRegion(input.genome.weights, step);
  } else if (verdict === 'FALSIFIED' && input.genome.lastForecast) {
    const step = zeroElements();
    for (const code of ELEMENT_CODES) {
      step[code] = 0.5 * (input.genome.lastForecast.priorWeights[code] - input.genome.weights[code]);
    }
    weights = applyTrustRegion(input.genome.weights, step);
  }

  const laws = lawNet(input.reports);
  const lambdas = input.genome.lawLambdas.map((lambda, index) => {
    const key = (['law1', 'law2', 'law3'] as const)[index];
    const step = Math.max(-0.02, Math.min(0.02, input.genome.eta * laws[key] * 0.05));
    return Math.max(0.4, Math.min(1.35, lambda + (mass > 0.01 ? step : 0)));
  }) as [number, number, number];

  const draft = cloneGenome(input.genome);
  draft.weights = weights;
  draft.lawLambdas = lambdas;
  draft.generation = input.genome.generation + 1;
  draft.lastForecast = issueForecast(input.windowLabel, input.nextWindowLabel, input.genome.weights, input.signals);

  const entityScores: EntityDayScore[] = input.entities.map((entity) => {
    const elements = FOURTEEN_ELEMENTS_CONFIG.map((spec) => ({
      code: spec.code,
      weight: draft.weights[spec.code],
      rawSemanticRisk: entity.risks[spec.code].raw,
      swmPhysicalAmplifier: entity.risks[spec.code].phi,
    }));
    const scored = calculateTotalThreatIndex(elements, entity.laws, 1.25, draft.lawLambdas);
    return {
      s2Did: entity.s2Did,
      entityName: entity.entityName,
      ttiScore: scored.ttiScore,
      severity: scored.severity,
    };
  });
  draft.hypotheses = updateHypotheses(draft, input.reports, entityScores);

  const meanSecurityScore = Number(
    (input.reports.reduce((total, report) => total + report.securityScore, 0) / input.reports.length).toFixed(2),
  );
  const meanTti = Number(
    (entityScores.reduce((total, score) => total + score.ttiScore, 0) / Math.max(1, entityScores.length)).toFixed(2),
  );
  const weightL1FromPrior = Number(l1Distance(input.genome.weights, draft.weights).toFixed(4));
  const synthesis = [
    `日窗 ${input.windowLabel} 由 ${input.reports.length} 条只读车道完成。`,
    `窗口关注分均值 ${meanSecurityScore.toFixed(2)}，观察名单平均 TTI ${meanTti.toFixed(2)}。`,
    `基因组由 G${input.genome.generation} 提议到 G${draft.generation}，权重 L1 变化 ${weightL1FromPrior.toFixed(4)}，步长受信任域约束。`,
    falsification.impactSummary,
    draft.lastForecast.narrative,
    '这些分数是红锚观察者的窗内评估，不是模型厂商的官方评级。没有向任何外部系统发送干预。',
  ].join('');

  return {
    proposedGenome: draft,
    entityScores,
    meanTti,
    meanSecurityScore,
    weightL1FromPrior,
    forecastVerdict: verdict,
    synthesis,
  };
}
