import { eachClosedWindow } from '@/core/daily/clock';
import { commitRun, createBaselineStore } from '@/core/daily/baseline-store';
import { runDailyCycle } from '@/core/daily/cycle';
import { LocalRehearsalPort } from '@/core/daily/grok-port';
import { baseGenome } from '@/core/daily/genome';
import type { BaselineStore, EntityProfile, GrokBotPort, IntelSignal } from '@/core/daily/types';

export const HISTORY_START = new Date('2026-07-20T00:00:00+08:00');

export interface ReplayInput {
  asOf: Date;
  signals: IntelSignal[];
  entities: EntityProfile[];
  from?: Date;
  port?: GrokBotPort;
}

/** Replay every closed Shanghai day so the living baseline is a series, not a single snapshot. */
export async function replayDailyHistory(input: ReplayInput): Promise<BaselineStore> {
  const windows = eachClosedWindow(input.from ?? HISTORY_START, input.asOf);
  let store = createBaselineStore(baseGenome());
  for (const window of windows) {
    const run = await runDailyCycle({
      now: new Date(window.endIso),
      signals: input.signals,
      genome: store.genome,
      entities: input.entities,
      port: input.port ?? new LocalRehearsalPort(),
      generatedAt: window.endIso,
    });
    if (run.window.label !== window.label) {
      throw new Error(`Replay window mismatch: expected ${window.label}, got ${run.window.label}`);
    }
    store = commitRun(store, run);
  }
  return store;
}
