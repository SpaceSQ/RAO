import { MODEL_VERSIONS } from '@/core/priority/version-registry';
import type { ModelVersionEntry } from '@/core/priority/version-registry';
import type { IntelSignal } from '@/core/daily/types';

export const QUIET_VERSION_SCORE = 6;

export interface VersionWatchTask {
  taskId: string;
  versionId: string;
  lab: ModelVersionEntry['lab'];
  versionKeyword: string;
  aliases: string[];
  featureNotes: string;
  watchPriority: ModelVersionEntry['watchPriority'];
  s2Did: string;
  disclosure: ModelVersionEntry['disclosure'];
}

export interface VersionWatchScore {
  versionId: string;
  lab: ModelVersionEntry['lab'];
  versionKeyword: string;
  featureLine: string;
  watchPriority: ModelVersionEntry['watchPriority'];
  s2Did: string;
  securityScore: number;
  status: 'QUIET' | 'MATCHED';
  matched: boolean;
  evidenceIds: string[];
}

/** One standing task per public version or undisclosed class. Rebuilt for every daily run. */
export function buildVersionWatchTasks(versions: ModelVersionEntry[] = MODEL_VERSIONS): VersionWatchTask[] {
  return versions
    .filter((entry) => entry.disclosure !== 'LAB')
    .map((entry) => ({
      taskId: `watch:${entry.id}`,
      versionId: entry.id,
      lab: entry.lab,
      versionKeyword: entry.versionKeyword,
      aliases: uniqueAliases(entry.versionKeyword, entry.aliases),
      featureNotes: entry.featureNotes,
      watchPriority: entry.watchPriority,
      s2Did: entry.s2Did,
      disclosure: entry.disclosure,
    }));
}

function uniqueAliases(keyword: string, aliases: string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const alias of [keyword, ...aliases]) {
    const trimmed = alias.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    list.push(trimmed);
  }
  return list.sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-keyword match. "Mythos 5" does not hit "Mythos 5.1" or "mythos-5-1". */
export function keywordHits(text: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(keyword)}(?!\\.\\d)(?!-\\d)(?![A-Za-z0-9])`,
    'i',
  );
  return pattern.test(text);
}

export function signalText(signal: Pick<IntelSignal, 'title' | 'summary'>): string {
  return `${signal.title}\n${signal.summary}`;
}

export function scorePriorityVersions(
  signals: IntelSignal[],
  tasks: VersionWatchTask[] = buildVersionWatchTasks(),
): VersionWatchScore[] {
  return tasks.map((task) => {
    const matched = signals.filter((signal) =>
      task.aliases.some((alias) => keywordHits(signalText(signal), alias)),
    );
    if (matched.length === 0) {
      return {
        versionId: task.versionId,
        lab: task.lab,
        versionKeyword: task.versionKeyword,
        featureLine: task.featureNotes,
        watchPriority: task.watchPriority,
        s2Did: task.s2Did,
        securityScore: QUIET_VERSION_SCORE,
        status: 'QUIET',
        matched: false,
        evidenceIds: [],
      };
    }
    const intensity = matched.reduce((total, signal) => total + signal.intensity, 0);
    const raised = Number(((1 - Math.exp(-intensity)) * 100).toFixed(2));
    return {
      versionId: task.versionId,
      lab: task.lab,
      versionKeyword: task.versionKeyword,
      featureLine: task.featureNotes,
      watchPriority: task.watchPriority,
      s2Did: task.s2Did,
      securityScore: Math.max(QUIET_VERSION_SCORE + 1, raised),
      status: 'MATCHED',
      matched: true,
      evidenceIds: matched.map((signal) => signal.id),
    };
  });
}
