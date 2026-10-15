import type { DailyWindow } from '@/core/daily/types';

export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Asia/Shanghai has no daylight-saving shift. Local midnight is UTC+8. */
export function shanghaiDayStart(instant: Date): Date {
  const localMs = instant.getTime() + SHANGHAI_OFFSET_MS;
  const startLocal = Math.floor(localMs / DAY_MS) * DAY_MS;
  return new Date(startLocal - SHANGHAI_OFFSET_MS);
}

export function formatShanghaiDate(instant: Date): string {
  const local = new Date(instant.getTime() + SHANGHAI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The last fully closed 24h window.
 * At 00:00 Asia/Shanghai this is the midnight that just occurred, back one day.
 * During the day it stays on that same completed window until the next midnight.
 */
export function closedDailyWindow(now: Date): DailyWindow {
  const end = shanghaiDayStart(now);
  const start = new Date(end.getTime() - DAY_MS);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: formatShanghaiDate(start),
  };
}

export function nextShanghaiMidnight(now: Date): Date {
  return new Date(shanghaiDayStart(now).getTime() + DAY_MS);
}

/** Wall time in Asia/Shanghai, fixed offset, no daylight saving. */
export function formatShanghaiOffset(instant: Date): string {
  const local = new Date(instant.getTime() + SHANGHAI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const hour = String(local.getUTCHours()).padStart(2, '0');
  const minute = String(local.getUTCMinutes()).padStart(2, '0');
  const second = String(local.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

export function msUntilNextShanghaiMidnight(now: Date): number {
  return Math.max(0, nextShanghaiMidnight(now).getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/** Closed windows from `from` inclusive up to, but not including, the Shanghai day that contains `until`. */
export function eachClosedWindow(from: Date, until: Date): DailyWindow[] {
  const windows: DailyWindow[] = [];
  let start = shanghaiDayStart(from);
  const endBound = shanghaiDayStart(until);
  while (start.getTime() < endBound.getTime()) {
    const end = new Date(start.getTime() + DAY_MS);
    windows.push({
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: formatShanghaiDate(start),
    });
    start = end;
  }
  return windows;
}

export function signalsInWindow<T extends { observedAt: string }>(signals: T[], window: DailyWindow): T[] {
  const start = Date.parse(window.startIso);
  const end = Date.parse(window.endIso);
  return signals.filter((signal) => {
    const at = Date.parse(signal.observedAt);
    return at >= start && at < end;
  });
}
