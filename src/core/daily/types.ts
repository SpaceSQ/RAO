import type { ElementCode } from '@/core/constants/fourteen-elements';
import type { DomainType, S2Category, Severity } from '@/types/rao';

export const DAILY_ACTUATION = 'NONE' as const;

export type LaneId =
  | 'frontier-unsanctioned'
  | 'hidden-context'
  | 'excessive-agency'
  | 'sensitive-disclosure'
  | 'coding-agent-supply'
  | 'multi-agent-contagion'
  | 'containment-law1'
  | 'deceptive-law2'
  | 'physical-coupling-law3'
  | 'governance-regimes'
  | 'element-baseline-drift'
  | 'forecast-falsification';

export type BotMode = 'LOCAL_REHEARSAL' | 'CLOUD_GROK';

export type ForecastVerdict = 'CONFIRMED' | 'FALSIFIED' | 'INCONCLUSIVE' | 'NOT_APPLICABLE';

export interface DailyWindow {
  /** Inclusive Shanghai midnight, ISO. */
  startIso: string;
  /** Exclusive next Shanghai midnight, ISO. */
  endIso: string;
  /** Civil date in Asia/Shanghai covered by this window, YYYY-MM-DD. */
  label: string;
}

export interface LawPressure {
  law1: number;
  law2: number;
  law3: number;
}

export interface IntelSignal {
  id: string;
  /** When the intelligence surfaced. Day-precision items enter that Shanghai day only. */
  observedAt: string;
  source: string;
  sourceUrl: string;
  title: string;
  /** Impact-level summary. Never a procedure. */
  summary: string;
  lanes: LaneId[];
  elementPressure: Partial<Record<ElementCode, number>>;
  lawPressure: Partial<LawPressure>;
  intensity: number;
}

export interface UndatedPrior {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  dateNote: string;
}

export interface LaneDefinition {
  id: LaneId;
  botIndex: number;
  nameZh: string;
  nameEn: string;
  assignment: string;
  focusElements: ElementCode[];
  lawFocus: keyof LawPressure | null;
}

export interface ObservationHypothesis {
  geneId: string;
  generation: number;
  stance: string;
  targetElement: ElementCode;
  observationIntent: string;
  fitnessScore: number;
  evolutionDirective: 'PROMOTE_TO_ELITE' | 'CROSSOVER_MUTATE' | 'PRUNE_OBSOLETE';
  semanticNoveltyScore: number;
  saturated: boolean;
}

export interface HorizonForecast {
  issuedFromWindow: string;
  forWindowLabel: string;
  elementPressure: Record<ElementCode, number>;
  /** Weights from before the update that issued this forecast. Used if the next day falsifies it. */
  priorWeights: Record<ElementCode, number>;
  narrative: string;
}

export interface ModelGenome {
  generation: number;
  eta: number;
  weights: Record<ElementCode, number>;
  lawLambdas: [number, number, number];
  hypotheses: ObservationHypothesis[];
  lastForecast: HorizonForecast | null;
}

export interface EntityProfile {
  s2Did: string;
  entityName: string;
  s2Category: S2Category;
  domainType: DomainType;
  risks: Record<ElementCode, { raw: number; phi: number }>;
  laws: {
    law1FailOpen: number;
    law2SensoryRoughness: number;
    law3MomentumRight: number;
  };
  evidence: string;
}

export interface MonitoringTasks {
  elements: {
    code: ElementCode;
    nameZh: string;
    weight: number;
    defaultWeight: number;
    hazardDescription: string;
  }[];
  laws: {
    lambdas: [number, number, number];
    definitions: [string, string, string];
  };
  entities: {
    s2Did: string;
    entityName: string;
    s2Category: S2Category;
    domainType: DomainType;
  }[];
  hypotheses: {
    geneId: string;
    stance: string;
    targetElement: ElementCode;
    observationIntent: string;
  }[];
  previousForecast: HorizonForecast | null;
  versionWatches: {
    taskId: string;
    versionId: string;
    lab: 'ANTHROPIC' | 'OPENAI';
    versionKeyword: string;
    aliases: string[];
    featureNotes: string;
    watchPriority: 'HIGH' | 'ROUTINE';
    s2Did: string;
    disclosure: 'PUBLIC_VERSION' | 'UNDISCLOSED_CLASS' | 'LAB';
  }[];
}

export interface GrokBotPort {
  readonly mode: BotMode;
  runLane(input: GrokBotLaneInput): Promise<GrokBotLaneReport>;
}

export interface GrokBotLaneInput {
  lane: LaneDefinition;
  window: DailyWindow;
  /** Signals already clipped to this window. */
  signals: IntelSignal[];
  tasks: MonitoringTasks;
}

export interface GrokBotLaneReport {
  laneId: LaneId;
  botId: string;
  mode: BotMode;
  executionLabel: string;
  securityScore: number;
  status: 'COMPLETE' | 'QUIET';
  evidenceIds: string[];
  impactSummary: string;
  elementPressure: Partial<Record<ElementCode, number>>;
  lawPressure: LawPressure;
  forecastVerdict: ForecastVerdict;
  citations: { title: string; source: string; url: string }[];
}

export interface EntityDayScore {
  s2Did: string;
  entityName: string;
  ttiScore: number;
  severity: Severity;
}

export type AnalysisReader = 'BUILTIN' | 'DEEPSEEK' | 'DEEPSEEK_FALLBACK';

export interface DailyRunResult {
  window: DailyWindow;
  mode: BotMode;
  executionLabel: string;
  analysisReader: AnalysisReader;
  actuation: typeof DAILY_ACTUATION;
  laneReports: GrokBotLaneReport[];
  meanSecurityScore: number;
  entityScores: EntityDayScore[];
  meanTti: number;
  genomeBefore: ModelGenome;
  proposedGenome: ModelGenome;
  weightL1FromPrior: number;
  forecastVerdict: ForecastVerdict;
  versionScores: {
    versionId: string;
    lab: 'ANTHROPIC' | 'OPENAI';
    versionKeyword: string;
    featureLine: string;
    watchPriority: 'HIGH' | 'ROUTINE';
    s2Did: string;
    securityScore: number;
    status: 'QUIET' | 'MATCHED';
    matched: boolean;
    evidenceIds: string[];
  }[];
  synthesis: string;
  zeroActuationProofHash: string;
  generatedAt: string;
}

export interface TrendPoint {
  label: string;
  meanSecurityScore: number;
  meanTti: number;
  weightL1FromOrigin: number;
  genomeGeneration: number;
  forecastVerdict: ForecastVerdict;
}

export interface BaselineStore {
  originWeights: Record<ElementCode, number>;
  genome: ModelGenome;
  runs: DailyRunResult[];
  trend: TrendPoint[];
}
