import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passwordsMatch, readAdminSession, signAdminSession, ADMIN_USERNAME } from '../src/core/auth/admin.ts';
import { eachClosedWindow, signalsInWindow } from '../src/core/daily/clock.ts';
import { runDailyCycle } from '../src/core/daily/cycle.ts';
import { deepseekUserPayload, emptyKeyReaderLine, mergeReaderNotes } from '../src/core/daily/analysis-reader.ts';
import { baseGenome } from '../src/core/daily/genome.ts';
import { replayDailyHistory } from '../src/core/daily/replay.ts';
import { buildDailyReport } from '../src/core/daily/report.ts';
import { DAILY_LANES } from '../src/core/daily/lanes.ts';
import { WATCHLIST } from '../src/core/data/entities.ts';
import { PUBLIC_SIGNALS, UNDATED_PRIORS } from '../src/core/data/signals.ts';
import { historyServiceStatus } from '../src/core/history/archive.ts';
import { LAB_ORGS, MODEL_VERSIONS } from '../src/core/priority/version-registry.ts';
import { closedDailyWindow, formatShanghaiOffset, nextShanghaiMidnight } from '../src/core/daily/clock.ts';
import { chatCompletionsUrl } from '../src/core/daily/analysis-reader.ts';
import { resolveDeepseekAccess } from '../src/core/daily/deepseek-server.ts';
import { PUBLIC_HOST, surfaceAllowsWrite } from '../src/core/site.ts';

const AS_OF = new Date('2026-10-14T20:36:00+08:00');

describe('service boundary', () => {
  it('counts seeded series points and does not fetch live', async () => {
    const windows = eachClosedWindow(new Date('2026-07-20T00:00:00+08:00'), AS_OF);
    const daysWithSignals = windows.filter((window) => signalsInWindow(PUBLIC_SIGNALS, window).length > 0);
    assert.equal(windows.length, 86);
    assert.equal(daysWithSignals.length, 4);
    assert.equal(PUBLIC_SIGNALS.length, 4);
    assert.equal(UNDATED_PRIORS.length, 2);
    assert.equal(MODEL_VERSIONS.length, 26);
    assert.equal(LAB_ORGS.length, 2);
    assert.equal(WATCHLIST.length, 6);
    assert.equal(DAILY_LANES.length, 12);

    const seeded = await replayDailyHistory({ asOf: AS_OF, signals: PUBLIC_SIGNALS, entities: WATCHLIST });
    const cleared = await replayDailyHistory({ asOf: AS_OF, signals: [], entities: WATCHLIST });
    assert.equal(seeded.trend.length, 86);
    assert.equal(cleared.trend.length, 86);
    assert.equal(seeded.trend.length * 2, 172);
    assert.equal(seeded.runs.every((run) => run.mode === 'LOCAL_REHEARSAL' && run.analysisReader === 'BUILTIN'), true);
    assert.equal(cleared.runs.every((run) => run.mode === 'LOCAL_REHEARSAL' && run.actuation === 'NONE'), true);
    assert.ok(cleared.trend.every((point) => Number.isFinite(point.meanSecurityScore) && Number.isFinite(point.meanTti)));
  });

  it('keeps one admin, a manual report, and the built-in reader', async () => {
    assert.equal(ADMIN_USERNAME, 'rao-admin');
    assert.equal(surfaceAllowsWrite('public'), false);
    assert.equal(surfaceAllowsWrite('embed-report'), false);
    assert.equal(surfaceAllowsWrite('embed-data'), false);
    assert.equal(surfaceAllowsWrite('admin'), true);
    assert.deepEqual(historyServiceStatus({}), { online: false, store: 'local' });
    assert.match(emptyKeyReaderLine(), /内置本地模型/);
    assert.match(emptyKeyReaderLine(), /未调用 Deepseek/);

    const env = { RAO_ADMIN_PASSWORD: 'secret', RAO_SESSION_SECRET: 'secret' };
    assert.equal(passwordsMatch('secret', 'secret'), true);
    assert.equal(passwordsMatch('other', 'secret'), false);
    const token = signAdminSession(env, 1_000);
    assert.equal(readAdminSession(token, env, 1_000), true);
    assert.equal(readAdminSession(token, env, 1_000 + 13 * 60 * 60 * 1000), false);

    const run = await runDailyCycle({
      now: new Date('2026-10-14T00:00:00+08:00'),
      signals: [],
      genome: baseGenome(),
      entities: WATCHLIST,
      generatedAt: '2026-10-14T00:00:00.000Z',
    });
    assert.equal(run.analysisReader, 'BUILTIN');
    assert.match(run.executionLabel, /本地排练/);
    const report = buildDailyReport(run);
    assert.equal(PUBLIC_HOST, process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || 'https://rao.space2.world');
    assert.match(report, new RegExp(PUBLIC_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(report, /千家网人工智能频道/);
    assert.match(report, /重点观察/);
    assert.equal(report.includes('优先观察'), false);
    assert.match(report, /手工发布/);
    assert.equal(report.includes('立即注册'), false);
    const payload = deepseekUserPayload({
      window: run.window,
      citations: [],
      versionWatches: [],
      lanes: [],
    });
    assert.equal(JSON.stringify(payload).includes('apiKey'), false);
    const merged = mergeReaderNotes(run.laneReports, [
      { laneId: 'governance-regimes', securityScore: 44, impactSummary: '只记影响。' },
    ]);
    assert.equal(merged.find((item) => item.laneId === 'governance-regimes')?.securityScore, 44);
    assert.equal(merged.every((item) => item.mode === 'LOCAL_REHEARSAL'), true);
  });

  it('arms the Shanghai midnight window and prefers an empty browser key over nothing', () => {
    const fireAt = nextShanghaiMidnight(new Date('2026-10-14T22:52:00+08:00'));
    assert.equal(formatShanghaiOffset(fireAt), '2026-10-15T00:00:00+08:00');
    assert.equal(closedDailyWindow(fireAt).label, '2026-10-14');
    assert.equal(closedDailyWindow(fireAt).startIso, new Date('2026-10-14T00:00:00+08:00').toISOString());
    assert.equal(chatCompletionsUrl('https://api.deepseek.com/v1'), 'https://api.deepseek.com/v1/chat/completions');
    const fromEnv = resolveDeepseekAccess({
      browserKey: '',
      browserBase: '',
      env: { DEEPSEEK_API_KEY: 'present', DEEPSEEK_API_BASE: 'https://api.deepseek.com/v1' },
    });
    assert.equal(fromEnv?.source, 'env');
    assert.equal(fromEnv?.base, 'https://api.deepseek.com/v1');
    assert.equal(resolveDeepseekAccess({ browserKey: 'browser', env: { DEEPSEEK_API_KEY: 'present' } })?.source, 'browser');
    assert.equal(resolveDeepseekAccess({ env: {} }), null);
  });
});
