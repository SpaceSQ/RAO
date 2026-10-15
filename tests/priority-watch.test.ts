import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runDailyCycle } from '../src/core/daily/cycle.ts';
import { baseGenome } from '../src/core/daily/genome.ts';
import { replayDailyHistory } from '../src/core/daily/replay.ts';
import { WATCHLIST } from '../src/core/data/entities.ts';
import { PUBLIC_SIGNALS } from '../src/core/data/signals.ts';
import { MODEL_VERSIONS, PRIORITY_REGISTRY } from '../src/core/priority/version-registry.ts';
import { buildVersionWatchTasks, keywordHits, scorePriorityVersions } from '../src/core/priority/version-watch.ts';
import { S2_CATEGORIES } from '../src/types/rao.ts';

describe('priority version watch', () => {
  it('registers only public names or the undisclosed class, with 22-character DIDs', () => {
    assert.equal(S2_CATEGORIES[6], 'MYTH');
    assert.equal(PRIORITY_REGISTRY.some((entry) => entry.s2Category === 'ORG'), true);
    assert.equal(MODEL_VERSIONS.every((entry) => entry.s2Category === 'SILICON'), true);
    assert.equal(MODEL_VERSIONS.some((entry) => entry.disclosure === 'UNDISCLOSED_CLASS'), true);
    assert.equal(MODEL_VERSIONS.some((entry) => entry.versionKeyword === '未公开内部研究检查点'), true);
    assert.equal(MODEL_VERSIONS.some((entry) => /mythos/i.test(entry.id) === false && entry.versionKeyword.includes('虚构')), false);
    for (const entry of PRIORITY_REGISTRY) {
      assert.equal(entry.s2Did.length, 22);
      assert.notEqual(entry.s2Category, 'MATH');
    }
    const tasks = buildVersionWatchTasks();
    assert.equal(tasks.length, MODEL_VERSIONS.length);
    assert.ok(tasks.length >= 10);
    assert.equal(tasks.some((task) => task.versionKeyword === 'Claude Mythos 5'), true);
    assert.equal(tasks.some((task) => task.versionKeyword === 'Claude Mythos Preview'), true);
    assert.equal(tasks.some((task) => task.versionKeyword === 'GPT-5.6 Sol'), true);
    assert.equal(tasks.some((task) => task.versionKeyword === 'GPT-6 Astra'), true);
    assert.equal(tasks.some((task) => task.disclosure === 'UNDISCLOSED_CLASS' && task.versionKeyword.includes('GPT-')), false);
  });

  it('does not let a shorter version keyword swallow the next decimal', () => {
    assert.equal(keywordHits('评估配置 Claude Mythos 5 被点名', 'Mythos 5'), true);
    assert.equal(keywordHits('Claude Mythos 5.1 是另一档', 'Mythos 5'), false);
    assert.equal(keywordHits('Claude Mythos 5.1 是另一档', 'Mythos 5.1'), true);
    assert.equal(keywordHits('Claude Mythos Preview 被临时停用', 'Mythos 5'), false);
    assert.equal(keywordHits('Claude Mythos Preview 被临时停用', 'Mythos Preview'), true);
    assert.equal(keywordHits('gpt-5.6-sol 出现在公开记录', 'gpt-5.6-sol'), true);
    assert.equal(keywordHits('gpt-5.6-sol 出现在公开记录', 'gpt-5.6-terra'), false);
  });

  it('raises only the versions named inside the closed window', async () => {
    const quiet = await runDailyCycle({
      now: new Date('2026-10-14T00:00:00+08:00'),
      signals: PUBLIC_SIGNALS,
      genome: baseGenome(),
      entities: WATCHLIST,
      generatedAt: '2026-10-14T00:00:00.000Z',
    });
    assert.equal(quiet.versionScores.length, MODEL_VERSIONS.length);
    assert.equal(quiet.versionScores.every((score) => score.matched === false && score.status === 'QUIET'), true);
    assert.equal(quiet.actuation, 'NONE');

    const named = await runDailyCycle({
      now: new Date('2026-07-29T00:00:00+08:00'),
      signals: PUBLIC_SIGNALS,
      genome: baseGenome(),
      entities: WATCHLIST,
      generatedAt: '2026-07-29T00:00:00.000Z',
    });
    const mythos5 = named.versionScores.find((score) => score.versionKeyword === 'Claude Mythos 5');
    const mythos51 = named.versionScores.find((score) => score.versionKeyword === 'Claude Mythos 5.1');
    const sol = named.versionScores.find((score) => score.versionKeyword === 'GPT-5.6 Sol');
    const internal = named.versionScores.find((score) => score.versionKeyword === '未公开内部研究检查点');
    assert.equal(mythos5?.matched, true);
    assert.ok((mythos5?.securityScore ?? 0) > 6);
    assert.deepEqual(mythos5?.evidenceIds, ['aisi-inc-2026-07-28']);
    assert.equal(sol?.matched, true);
    assert.equal(mythos51?.matched, false);
    assert.equal(mythos51?.status, 'QUIET');
    assert.equal(internal?.matched, false);
    const frontier = named.laneReports.find((report) => report.laneId === 'frontier-unsanctioned');
    assert.match(frontier?.impactSummary ?? '', /Claude Mythos 5/);
    assert.match(frontier?.impactSummary ?? '', /版本关键词命中/);

    const direct = scorePriorityVersions(
      [
        {
          id: 'note',
          observedAt: '2026-10-13T12:00:00+08:00',
          source: '观察员',
          sourceUrl: '',
          title: 'GPT-6 Astra 长时程任务',
          summary: '公开说明仍停留在能力类别。',
          lanes: ['excessive-agency'],
          elementPressure: {},
          lawPressure: {},
          intensity: 0.4,
        },
      ],
      buildVersionWatchTasks(),
    );
    assert.equal(direct.find((score) => score.versionKeyword === 'GPT-6 Astra')?.matched, true);
    assert.equal(direct.find((score) => score.versionKeyword === 'GPT-6 Sol')?.matched, false);
  });

  it('keeps the standing tasks on a replayed daily run', async () => {
    const store = await replayDailyHistory({
      asOf: new Date('2026-07-30T08:00:00+08:00'),
      signals: PUBLIC_SIGNALS,
      entities: WATCHLIST,
    });
    const july28 = store.runs.find((run) => run.window.label === '2026-07-28');
    assert.ok(july28);
    assert.equal(july28.versionScores.filter((score) => score.matched).length, 2);
    assert.equal(july28.versionScores.filter((score) => score.status === 'QUIET').length, MODEL_VERSIONS.length - 2);
  });
});
