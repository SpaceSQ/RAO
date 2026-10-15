import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FOURTEEN_ELEMENTS_CONFIG } from '../src/core/constants/fourteen-elements.ts';
import { computeRsiProbeFitness } from '../src/core/engines/rsi-evolver.ts';
import { StochasticOlfactoryScheduler } from '../src/core/engines/stochastic-scheduler.ts';
import { calculateTotalThreatIndex } from '../src/core/engines/tti-calculator.ts';
import { assertS2Category, makeS2Did, S2_CATEGORIES, validateS2DID } from '../src/types/rao.ts';

describe('lossless engines', () => {
  it('keeps the fourteen element weights at 1 and the seventh category as MYTH', () => {
    const sum = FOURTEEN_ELEMENTS_CONFIG.reduce((total, spec) => total + spec.defaultWeight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(S2_CATEGORIES.length, 7);
    assert.equal(S2_CATEGORIES[6], 'MYTH');
    assert.equal(assertS2Category('MYTH'), 'MYTH');
    assert.throws(() => assertS2Category('MATH'), /MYTH/);
  });

  it('builds a 22-character S2-DID', () => {
    const did = makeS2Did('MYT', 'WILDNET');
    assert.equal(did.length, 22);
    assert.deepEqual(validateS2DID(did), { valid: true });
    assert.equal(validateS2DID('TOO-SHORT').valid, false);
  });

  it('matches the TTI formula and the critical-law override', () => {
    const gamma = 1.25;
    const expTerm = Math.exp(-gamma);
    const sigma = (1 - expTerm) / (1 + expTerm);
    const result = calculateTotalThreatIndex(
      [{ code: 'E14', weight: 1, rawSemanticRisk: 1, swmPhysicalAmplifier: 1 }],
      { law1FailOpen: 0, law2SensoryRoughness: 0, law3MomentumRight: 0 },
    );
    assert.equal(result.ttiScore, Number((sigma * 100).toFixed(2)));
    assert.equal(result.lawsMultiplier, 1);

    const critical = calculateTotalThreatIndex(
      [{ code: 'E01', weight: 1, rawSemanticRisk: 0.05, swmPhysicalAmplifier: 1 }],
      { law1FailOpen: 0.8, law2SensoryRoughness: 0, law3MomentumRight: 0 },
    );
    assert.equal(critical.severity, 'CRITICAL_RED_ANCHOR');
  });

  it('keeps Lorenz-Poisson pulses inside the spec bounds', () => {
    const scheduler = new StochasticOlfactoryScheduler();
    for (let step = 0; step < 20; step += 1) {
      const pulse = scheduler.nextChaosPulse(0.35, 0.25, 2.5);
      const chaos = Math.abs(pulse.lorenzState.x) / 30;
      const expected = 0.25 * (1 + 2.5 * 0.35 + chaos);
      assert.equal(pulse.instantaneousRateLambda, Number(expected.toFixed(4)));
      assert.ok(pulse.nextIntervalMs >= 450 && pulse.nextIntervalMs <= 15000);
    }
  });

  it('promotes informative hypotheses and prunes saturated ones', () => {
    const pruned = computeRsiProbeFitness({
      probeId: 'old',
      generation: 1,
      inducedTtiScore: 10,
      triggeredCannedRefusal: true,
      semanticNoveltyScore: 0.05,
    });
    assert.equal(pruned.evolutionDirective, 'PRUNE_OBSOLETE');
    assert.equal(pruned.shouldMutateAndPromote, false);

    const elite = computeRsiProbeFitness({
      probeId: 'new',
      generation: 2,
      inducedTtiScore: 90,
      triggeredCannedRefusal: false,
      semanticNoveltyScore: 0.8,
    });
    assert.equal(elite.evolutionDirective, 'PROMOTE_TO_ELITE');
  });
});
