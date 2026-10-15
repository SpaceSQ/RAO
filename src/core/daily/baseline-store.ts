import { l1Distance } from '@/core/daily/pressure';
import { cloneGenome } from '@/core/daily/genome';
import type { BaselineStore, DailyRunResult, ModelGenome, TrendPoint } from '@/core/daily/types';
import type { ElementCode } from '@/core/constants/fourteen-elements';

export function trendPoint(run: DailyRunResult, origin: Record<ElementCode, number>): TrendPoint {
  return {
    label: run.window.label,
    meanSecurityScore: run.meanSecurityScore,
    meanTti: run.meanTti,
    weightL1FromOrigin: Number(l1Distance(origin, run.proposedGenome.weights).toFixed(4)),
    genomeGeneration: run.proposedGenome.generation,
    forecastVerdict: run.forecastVerdict,
  };
}

export function createBaselineStore(origin: ModelGenome): BaselineStore {
  const genome = cloneGenome(origin);
  return {
    originWeights: { ...genome.weights },
    genome,
    runs: [],
    trend: [],
  };
}

/** Replace the same civil date in place so a manual rerun does not duplicate the series. */
export function commitRun(store: BaselineStore, run: DailyRunResult): BaselineStore {
  const runs = store.runs
    .filter((item) => item.window.label !== run.window.label)
    .concat(run)
    .sort((a, b) => a.window.label.localeCompare(b.window.label));
  const latest = runs[runs.length - 1];
  return {
    originWeights: store.originWeights,
    genome: cloneGenome(latest.proposedGenome),
    runs,
    trend: runs.map((item) => trendPoint(item, store.originWeights)),
  };
}
