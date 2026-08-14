import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WardenPursuitEvents,
  chooseWardenTarget,
  createWardenPursuitState,
  resetWardenAfterSuppression,
  resolveWardenPursuit,
} from '../src/warden.js';

test('the third active relay reveals the Warden without also advancing it', () => {
  let State = createWardenPursuitState({ startingDistance: 4 });
  State = resolveWardenPursuit(State, { activeRelayCount: 2, targetWorldIdentifier: 'ember' });
  assert.equal(State.status, 'hidden');
  assert.equal(State.distance, 4);

  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  assert.equal(State.status, 'pursuing');
  assert.equal(State.distance, 4);
  assert.equal(State.targetWorldIdentifier, 'grove');
  assert.equal(State.lastEvent, WardenPursuitEvents.revealed);
});

test('later resolved flights advance once while a first circuit closure retreats once', () => {
  let State = createWardenPursuitState({ startingDistance: 3 });
  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  assert.equal(State.distance, 2);
  assert.equal(State.lastEvent, WardenPursuitEvents.advanced);

  State = resolveWardenPursuit(State, {
    activeRelayCount: 3,
    targetWorldIdentifier: 'grove',
    firstCircuitClosed: true,
  });
  assert.equal(State.distance, 3);
  assert.equal(State.lastEvent, WardenPursuitEvents.retreated);

  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  assert.equal(State.distance, 0);
  assert.equal(State.lastEvent, WardenPursuitEvents.arrived);
  State = resetWardenAfterSuppression(State, 'haven');
  assert.equal(State.distance, 3);
  assert.equal(State.targetWorldIdentifier, 'haven');
  assert.equal(State.lastEvent, WardenPursuitEvents.suppressed);
});

test('the authored frontier nearest the command edge is targeted deterministically', () => {
  const Worlds = [
    { id: 'haven', position: { x: -24, y: -10 } },
    { id: 'ember', position: { x: -10, y: -9 } },
    { id: 'grove', position: { x: 4, y: -6 } },
  ];
  assert.equal(chooseWardenTarget(Worlds, ['haven', 'grove']), 'grove');
  assert.equal(chooseWardenTarget(Worlds, []), null);
});
