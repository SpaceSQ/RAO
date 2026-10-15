import type { ElementCode } from '@/core/constants/fourteen-elements';
import type { ProbeModality, S2DID } from '@/types/rao';

export const OBSERVER_AS_OF = '2026-10-14T08:00:00.000Z';
export const ZERO_ACTUATION = 'NONE' as const;

export type SignalHorizon = 'CONFIRMED' | 'EMERGING' | 'FORECAST';
export type SignalKind = 'THREAT' | 'REGIME';

export interface IntelSignal {
  id: string;
  observedAt: string;
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  kind: SignalKind;
  horizon: SignalHorizon;
  elementPressure: Partial<Record<ElementCode, number>>;
  lawPressure: { law1?: number; law2?: number; law3?: number };
  modalityHint: ProbeModality;
}

export type EvolutionDirective = 'PROMOTE_TO_ELITE' | 'CROSSOVER_MUTATE' | 'PRUNE_OBSOLETE';

/** An observation hypothesis. This is not an evasion prompt. */
export interface ObservationGene {
  geneId: string;
  generation: number;
  targetElementCode: ElementCode;
  linkedElements: ElementCode[];
  stance: string;
  stanceLabel: string;
  /** Schema-compatible observation card. States what to watch, never how to bypass a safeguard. */
  observationCard: string;
  fitnessScore: number;
  evolutionDirective: EvolutionDirective;
  deploymentsCount: number;
  saturation: number;
  modality: ProbeModality;
}

export interface ModelGenome {
  generation: number;
  eta: number;
  weights: Record<ElementCode, number>;
  lawLambdas: [number, number, number];
  hypotheses: ObservationGene[];
  predictionError: number;
  changelog: string[];
  parentGeneration: number | null;
}

export interface ReasoningStep {
  premise: string;
  inference: string;
  consequence: string;
  confidence: number;
  falsifier: string;
}

export interface TrendForecast {
  asOf: string;
  horizonLabel: string;
  nowcastWeights: Record<ElementCode, number>;
  forecastWeights: Record<ElementCode, number>;
  elementVelocity: Record<ElementCode, number>;
  lawPressure: { law1: number; law2: number; law3: number };
  bornHypotheses: ObservationGene[];
  trace: ReasoningStep[];
  narrative: string;
}

export interface ScoredEntity {
  s2Did: S2DID;
  ttiScore: number;
  severity: 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL_RED_ANCHOR';
  baseElementSum: number;
  sigmaActivated: number;
  lawsMultiplier: number;
}

export interface PulseLogEntry {
  id: string;
  at: string;
  intervalMs: number;
  lambda: number;
  lorenz: { x: number; y: number; z: number };
  targetDid: S2DID;
  targetName: string;
  stance: string;
  modality: ProbeModality;
  ttiScore: number;
  winner: 'CT_OBSERVER' | 'T_TARGET_MODEL';
  note: string;
}
