import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitRun, createBaselineStore } from '../src/core/daily/baseline-store.ts';
import { closedDailyWindow, signalsInWindow } from '../src/core/daily/clock.ts';
import { runDailyCycle } from '../src/core/daily/cycle.ts';
import { runFleet } from '../src/core/daily/fleet.ts';
import { baseGenome } from '../src/core/daily/genome.ts';
import { createGrokBotPort, createGrokBotPortFromProcessEnv } from '../src/core/daily/grok-port.ts';
import { DAILY_LANES } from '../src/core/daily/lanes.ts';
import { sumElements } from '../src/core/daily/pressure.ts';
import { replayDailyHistory } from '../src/core/daily/replay.ts';
import type { GrokBotLaneReport, GrokBotPort, IntelSignal } from '../src/core/daily/types.ts';
import { WATCHLIST } from '../src/core/data/entities.ts';
import { PUBLIC_SIGNALS } from '../src/core/data/signals.ts';

function signal(partial: Pick<IntelSignal, 'id' | 'observedAt' | 'lanes' | 'intensity'>): IntelSignal {
  return {
    source: '测试观察',
    sourceUrl: '',
    title: partial.id,
    summary: '测试窗内只有影响类别，没有做法。',
    elementPressure: { E14_CARBON_SOVEREIGNTY: partial.intensity },
    lawPressure: { law1: 0.2 },
    ...partial,
  };
}

describe('daily operating cycle', () => {
  it('closes the previous Shanghai day at and after local midnight', () => {
    const atMidnight = closedDailyWindow(new Date('2026-10-14T00:00:00+08:00'));
    assert.equal(atMidnight.label, '2026-10-13');
    assert.equal(Date.parse(atMidnight.endIso) - Date.parse(atMidnight.startIso), 24 * 60 * 60 * 1000);

    const afternoon = closedDailyWindow(new Date('2026-10-14T16:19:00+08:00'));
    assert.equal(afternoon.label, '2026-10-13');
    assert.equal(afternoon.endIso, atMidnight.endIso);
  });

  it('runs 12 distinct read-only lanes and ignores intelligence outside the window', async () => {
    assert.ok(DAILY_LANES.length >= 10);
    assert.equal(DAILY_LANES.length, 12);
    const outside = signal({
      id: 'oct-12',
      observedAt: '2026-10-12T12:00:00+08:00',
      lanes: ['frontier-unsanctioned'],
      intensity: 1,
    });
    const inside = signal({
      id: 'oct-13',
      observedAt: '2026-10-13T12:00:00+08:00',
      lanes: ['governance-regimes'],
      intensity: 0.2,
    });
    const run = await runDailyCycle({
      now: new Date('2026-10-14T00:00:00+08:00'),
      signals: [outside, inside],
      genome: baseGenome(),
      entities: WATCHLIST,
      generatedAt: '2026-10-14T00:00:00.000Z',
    });
    assert.equal(run.laneReports.length, 12);
    assert.equal(new Set(run.laneReports.map((report) => report.laneId)).size, 12);
    assert.equal(run.mode, 'LOCAL_REHEARSAL');
    assert.match(run.executionLabel, /本地排练/);
    assert.equal(run.actuation, 'NONE');
    assert.equal(run.zeroActuationProofHash.length, 64);
    const frontier = run.laneReports.find((report) => report.laneId === 'frontier-unsanctioned');
    const governance = run.laneReports.find((report) => report.laneId === 'governance-regimes');
    assert.equal(frontier?.evidenceIds.includes('oct-12'), false);
    assert.equal(frontier?.securityScore, 6);
    assert.equal(governance?.evidenceIds.includes('oct-13'), true);
    assert.ok((governance?.securityScore ?? 0) > 6);
    assert.ok(Math.abs(sumElements(run.proposedGenome.weights) - 1) < 1e-9);
    assert.equal(run.entityScores.find((entity) => entity.entityName.includes('隔离失效'))?.severity, 'CRITICAL_RED_ANCHOR');
    assert.equal(signalsInWindow([outside, inside], run.window).length, 1);
  });

  it('fans the fleet out so at least 10 lanes are in flight together', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const port: GrokBotPort = {
      mode: 'LOCAL_REHEARSAL',
      async runLane(input) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 25));
        inFlight -= 1;
        const report = {
          laneId: input.lane.id,
          botId: `test-${input.lane.botIndex}`,
          mode: 'LOCAL_REHEARSAL',
          executionLabel: '本地排练，非云端 Grok 结果',
          securityScore: 1,
          status: 'QUIET',
          evidenceIds: [],
          impactSummary: input.lane.assignment,
          elementPressure: {},
          lawPressure: { law1: 0, law2: 0, law3: 0 },
          forecastVerdict: 'NOT_APPLICABLE',
          citations: [],
        } satisfies GrokBotLaneReport;
        return report;
      },
    };
    const reports = await runFleet({
      port,
      task: {
        window: closedDailyWindow(new Date('2026-10-14T00:00:00+08:00')),
        signals: [],
        tasks: {
          elements: [],
          laws: { lambdas: [0.85, 0.65, 0.95], definitions: ['a', 'b', 'c'] },
          entities: [],
          hypotheses: [],
          previousForecast: null,
        },
      },
    });
    assert.equal(reports.length, 12);
    assert.ok(maxInFlight >= 10);
  });

  it('keeps the cloud adapter closed unless an endpoint and credential exist', () => {
    assert.equal(createGrokBotPort().mode, 'LOCAL_REHEARSAL');
    assert.equal(createGrokBotPort({ endpoint: 'https://example.test', credential: '' }).mode, 'LOCAL_REHEARSAL');
    assert.equal(
      createGrokBotPort({ endpoint: 'https://example.test/score', credential: 'present' }).mode,
      'CLOUD_GROK',
    );
    assert.equal(createGrokBotPortFromProcessEnv({}).mode, 'LOCAL_REHEARSAL');
    assert.equal(
      createGrokBotPortFromProcessEnv({ RAO_GROK_ENDPOINT: 'https://example.test/score' }).mode,
      'LOCAL_REHEARSAL',
    );
    assert.equal(
      createGrokBotPortFromProcessEnv({ RAO_GROK_CREDENTIAL: 'present' }).mode,
      'LOCAL_REHEARSAL',
    );
    assert.equal(
      createGrokBotPortFromProcessEnv({
        RAO_GROK_ENDPOINT: 'https://example.test/score',
        RAO_GROK_CREDENTIAL: 'present',
      }).mode,
      'CLOUD_GROK',
    );
  });

  it('replays the public record into a trend and a trust-bounded genome', async () => {
    const store = await replayDailyHistory({
      asOf: new Date('2026-10-14T10:00:00+08:00'),
      signals: PUBLIC_SIGNALS,
      entities: WATCHLIST,
    });
    assert.ok(store.trend.length > 14);
    assert.equal(store.trend.at(-1)?.label, '2026-10-13');
    assert.equal(store.trend.some((point) => point.label === '2026-10-14'), false);

    const july27 = store.runs.find((run) => run.window.label === '2026-07-27');
    const july28 = store.runs.find((run) => run.window.label === '2026-07-28');
    const july29 = store.runs.find((run) => run.window.label === '2026-07-29');
    assert.ok(july27 && july28 && july29);
    assert.ok(july28.meanSecurityScore > july27.meanSecurityScore);
    assert.ok(july28.proposedGenome.weights.E14_CARBON_SOVEREIGNTY > july27.proposedGenome.weights.E14_CARBON_SOVEREIGNTY);
    assert.ok(
      july28.proposedGenome.weights.E14_CARBON_SOVEREIGNTY - july27.proposedGenome.weights.E14_CARBON_SOVEREIGNTY <= 0.025,
    );
    assert.equal(july29.forecastVerdict, 'FALSIFIED');
    assert.ok(
      july29.proposedGenome.weights.E14_CARBON_SOVEREIGNTY < july28.proposedGenome.weights.E14_CARBON_SOVEREIGNTY,
    );
    assert.equal(
      store.genome.hypotheses.some((item) => item.geneId === 'GENERIC_SURFACE_QUIZ'),
      false,
    );
    assert.equal(store.runs.every((run) => run.actuation === 'NONE' && run.mode === 'LOCAL_REHEARSAL'), true);

    const rerun = await runDailyCycle({
      now: new Date(july28.window.endIso),
      signals: PUBLIC_SIGNALS,
      genome: july28.genomeBefore,
      entities: WATCHLIST,
      generatedAt: july28.generatedAt,
    });
    const replaced = commitRun(store, rerun);
    assert.equal(replaced.trend.filter((point) => point.label === '2026-07-28').length, 1);
    for (const entity of WATCHLIST) assert.equal(entity.s2Did.length, 22);
  });
});
