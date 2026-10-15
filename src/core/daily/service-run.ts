import { completeDeepseekRead, resolveDeepseekAccess } from '@/core/daily/deepseek-server';
import { buildVersionWatchTasks } from '@/core/priority/version-watch';
import { DAILY_LANES } from '@/core/daily/lanes';
import { closedDailyWindow, signalsInWindow } from '@/core/daily/clock';
import { runDailyCycle } from '@/core/daily/cycle';
import { createGrokBotPortFromProcessEnv } from '@/core/daily/grok-port';
import { replayDailyHistory } from '@/core/daily/replay';
import type { AnalysisReader } from '@/core/daily/types';
import { WATCHLIST } from '@/core/data/entities';
import { PUBLIC_SIGNALS } from '@/core/data/signals';
import { toStoredDay } from '@/core/history/archive';
import { writeRemoteDays } from '@/core/history/remote-store';

export interface OperatingRunReport {
  windowLabel: string;
  reader: AnalysisReader;
  deepseekErrorClass?: string;
  supabase: 'saved' | 'failed' | 'unconfigured';
  supabaseErrorClass?: string;
}

/** One closed Shanghai day in the real operating mode: Deepseek when configured, then Supabase. */
export async function runOperatingCycle(
  now: Date,
  env: Record<string, string | undefined> = process.env,
): Promise<OperatingRunReport> {
  const window = closedDailyWindow(now);
  const prior = await replayDailyHistory({
    asOf: new Date(window.startIso),
    signals: PUBLIC_SIGNALS,
    entities: WATCHLIST,
  });
  const clipped = signalsInWindow(PUBLIC_SIGNALS, window);
  const access = resolveDeepseekAccess({ env });
  let reader: AnalysisReader = 'BUILTIN';
  let notes: { laneId: (typeof DAILY_LANES)[number]['id']; securityScore: number; impactSummary: string }[] = [];
  let deepseekErrorClass: string | undefined;
  if (access) {
    const result = await completeDeepseekRead(access, {
      window,
      citations: clipped.map((signal) => ({
        id: signal.id,
        title: signal.title,
        summary: signal.summary,
        source: signal.source,
        url: signal.sourceUrl,
        lanes: signal.lanes,
      })),
      versionWatches: buildVersionWatchTasks().map((task) => ({
        lab: task.lab,
        versionKeyword: task.versionKeyword,
        aliases: task.aliases,
        featureNotes: task.featureNotes,
      })),
      lanes: DAILY_LANES.map((lane) => ({
        id: lane.id,
        nameZh: lane.nameZh,
        assignment: lane.assignment,
      })),
    });
    if (result.ok) {
      reader = 'DEEPSEEK';
      notes = result.notes;
    } else {
      reader = 'DEEPSEEK_FALLBACK';
      deepseekErrorClass = result.errorClass;
    }
  }
  const run = await runDailyCycle({
    now,
    signals: PUBLIC_SIGNALS,
    genome: prior.genome,
    entities: WATCHLIST,
    port: createGrokBotPortFromProcessEnv(env),
    analysisReader: reader,
    readerNotes: notes,
    generatedAt: now.toISOString(),
  });
  const saved = await writeRemoteDays([toStoredDay(run)], env);
  return {
    windowLabel: run.window.label,
    reader: run.analysisReader,
    deepseekErrorClass,
    supabase: !saved.configured ? 'unconfigured' : saved.saved ? 'saved' : 'failed',
    supabaseErrorClass: saved.errorClass,
  };
}
