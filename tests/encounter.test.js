import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHostileEncounterState,
  getHostileEncounterAngularDistance,
  isHostilePulseReady,
  resolveHostilePulse,
} from '../src/encounter.js';

test('a hostile pylon is a short deterministic walk ahead of the landing point', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
  });
  assert.ok(Math.abs(State.pylonSurfaceAngle - (Math.PI / 6)) < 1e-12);
  assert.ok(getHostileEncounterAngularDistance(State, 0) > State.pulseRangeRadians);
  assert.equal(isHostilePulseReady(State, 0), false);
  assert.equal(isHostilePulseReady(State, 25 * (Math.PI / 180)), true);
});

test('the contextual Pulse resolves once and cannot be fired from out of range', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: Math.PI - 0.1,
  });
  assert.equal(resolveHostilePulse(State, 0), State);
  const Resolved = resolveHostilePulse(State, State.pylonSurfaceAngle);
  assert.equal(Resolved.completed, true);
  assert.equal(isHostilePulseReady(Resolved, State.pylonSurfaceAngle), false);
});
