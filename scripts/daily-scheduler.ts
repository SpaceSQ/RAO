import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { closedDailyWindow, formatShanghaiOffset, nextShanghaiMidnight } from '../src/core/daily/clock.ts';
import { runOperatingCycle } from '../src/core/daily/service-run.ts';
import { replayDailyHistory } from '../src/core/daily/replay.ts';
import { toStoredDay } from '../src/core/history/archive.ts';
import { readRemoteDays, writeRemoteDays } from '../src/core/history/remote-store.ts';
import { WATCHLIST } from '../src/core/data/entities.ts';
import { PUBLIC_SIGNALS } from '../src/core/data/signals.ts';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const statusPath = path.join(dataDir, 'scheduler-status.json');
const logPath = path.join(dataDir, 'scheduler.log');

function loadEnvFiles() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name);
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) process.env[key] = value;
    }
  }
}

function logLine(line: string) {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
  console.log(line);
}

function writeStatus(nextFire: Date) {
  const window = closedDailyWindow(nextFire);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    statusPath,
    JSON.stringify(
      {
        armed: true,
        pid: process.pid,
        nextFireIso: formatShanghaiOffset(nextFire),
        nextWindowLabel: window.label,
        armedAt: new Date().toISOString(),
        lastEvent: 'armed',
      },
      null,
      2,
    ),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function executeDue(reason: string) {
  const now = new Date();
  const window = closedDailyWindow(now);
  logLine(`[rao-scheduler] start reason=${reason} window=${window.label}`);
  try {
    const report = await runOperatingCycle(now, process.env);
    const supabase =
      report.supabase === 'failed'
        ? `failed:${report.supabaseErrorClass ?? 'unknown'}`
        : report.supabase;
    const deepseek = report.deepseekErrorClass ? ` errorClass=${report.deepseekErrorClass}` : '';
    logLine(
      `[rao-scheduler] finish window=${report.windowLabel} reader=${report.reader}${deepseek} supabase=${supabase}`,
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    logLine(`[rao-scheduler] finish window=${window.label} reader=FAILED errorClass=${name} supabase=not_attempted`);
  }
}

async function backfillHistory() {
  const remote = await readRemoteDays(process.env);
  if (!remote.online) {
    logLine(`[rao-scheduler] backfill skipped errorClass=${remote.errorClass ?? 'offline'}`);
    return;
  }
  const replay = await replayDailyHistory({
    asOf: new Date(),
    signals: PUBLIC_SIGNALS,
    entities: WATCHLIST,
  });
  const have = new Set(remote.runs.map((day) => day.windowLabel));
  const missing = replay.runs.filter((run) => !have.has(run.window.label)).map((run) => toStoredDay(run));
  if (missing.length === 0) {
    logLine(`[rao-scheduler] backfill already_present count=${remote.runs.length}`);
    return;
  }
  for (let index = 0; index < missing.length; index += 8) {
    const chunk = missing.slice(index, index + 8);
    const saved = await writeRemoteDays(chunk, process.env);
    if (!saved.saved) {
      logLine(`[rao-scheduler] backfill failed errorClass=${saved.errorClass ?? 'unknown'}`);
      return;
    }
  }
  logLine(`[rao-scheduler] backfill wrote=${missing.length}`);
}

async function armAndWait(fireAt: Date) {
  const window = closedDailyWindow(fireAt);
  writeStatus(fireAt);
  logLine(`[rao-scheduler] armed next=${formatShanghaiOffset(fireAt)} window=${window.label}`);
  const wait = fireAt.getTime() - Date.now();
  if (wait <= 0) {
    await executeDue('immediate');
    return;
  }
  await sleep(wait);
  await executeDue('midnight');
}

async function main() {
  loadEnvFiles();
  const first = nextShanghaiMidnight(new Date());
  const pending = armAndWait(first);
  void backfillHistory().catch((error) => {
    const name = error instanceof Error ? error.name : 'Error';
    logLine(`[rao-scheduler] backfill failed errorClass=${name}`);
  });
  await pending;
  while (true) {
    try {
      await armAndWait(nextShanghaiMidnight(new Date()));
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      logLine(`[rao-scheduler] arm failed errorClass=${name}`);
      await sleep(5000);
    }
  }
}

process.on('SIGHUP', () => {
  logLine('[rao-scheduler] ignored SIGHUP');
});

void main().catch((error) => {
  const name = error instanceof Error ? error.name : 'Error';
  logLine(`[rao-scheduler] main failed errorClass=${name}`);
  process.exitCode = 1;
});
