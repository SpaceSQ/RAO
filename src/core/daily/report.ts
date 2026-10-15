import { MANUAL_PUBLISH_NOTE, PUBLIC_HOST, CHANNEL_BRAND, EXPERIMENT_NOTE } from '@/core/site';
import type { DailyRunResult } from '@/core/daily/types';

/** Staff copy this text. Nothing in here calls a publishing API. */
export function buildDailyReport(run: DailyRunResult): string {
  const lanes = run.laneReports
    .map((report) => `- ${report.laneId} · ${report.securityScore.toFixed(0)} · ${report.status} · ${report.impactSummary}`)
    .join('\n');
  const versions = run.versionScores
    .map((score) => `- ${score.lab} · ${score.versionKeyword} · ${score.securityScore.toFixed(0)} · ${score.status}`)
    .join('\n');
  const entities = run.entityScores
    .map((entity) => `- ${entity.entityName} · ${entity.s2Did} · TTI ${entity.ttiScore.toFixed(2)} · ${entity.severity}`)
    .join('\n');
  return [
    `# ${CHANNEL_BRAND}`,
    `主机：${PUBLIC_HOST}`,
    EXPERIMENT_NOTE,
    `日窗：${run.window.label}`,
    `执行：${run.executionLabel}`,
    `分析器：${run.analysisReader}`,
    `行动权：${run.actuation}`,
    '',
    run.synthesis,
    '',
    '## 车道',
    lanes,
    '',
    '## Anthropic / OpenAI 版本关键词',
    versions,
    '',
    '## 观察名单',
    entities,
    '',
    MANUAL_PUBLISH_NOTE,
  ].join('\n');
}
