import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateNormalizedSphericalDistance,
  calculateRestorationWaveProgress,
  calculateStagedGrowthProgress,
} from '../src/restoration.js';

test('spherical restoration distance distinguishes impact, horizon and antipode', () => {
  const ImpactDirection = { x: 1, y: 0, z: 0 };

  assert.equal(
    calculateNormalizedSphericalDistance(ImpactDirection, ImpactDirection),
    0,
  );
  assert.equal(
    calculateNormalizedSphericalDistance(ImpactDirection, { x: 0, y: 1, z: 0 }),
    0.5,
  );
  assert.equal(
    calculateNormalizedSphericalDistance(ImpactDirection, { x: -1, y: 0, z: 0 }),
    1,
  );
});

test('restoration wave progress is clamped and smoothly reaches its endpoints', () => {
  assert.equal(calculateRestorationWaveProgress(-1), 0);
  assert.equal(calculateRestorationWaveProgress(0), 0);
  assert.equal(calculateRestorationWaveProgress(0.5), 0.5);
  assert.equal(calculateRestorationWaveProgress(1), 1);
  assert.equal(calculateRestorationWaveProgress(2), 1);
});

test('surface growth starts behind the wave and completes in sequence', () => {
  assert.equal(calculateStagedGrowthProgress(0.35, 0.4), 0);
  assert.ok(calculateStagedGrowthProgress(0.45, 0.4) > 0);
  assert.ok(calculateStagedGrowthProgress(0.45, 0.4) < 1);
  assert.equal(calculateStagedGrowthProgress(0.6, 0.4), 1);
});
