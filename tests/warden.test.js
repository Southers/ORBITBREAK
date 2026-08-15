import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WardenPursuitEvents,
  chooseWardenTarget,
  createWardenPursuitState,
  resetWardenAfterSuppression,
  resolveWardenPursuit,
  shouldRevealWarden,
  shouldWardenCatchRunner,
} from '../src/warden.js';

test('the Warden stays hidden until the inner cluster and one further world are live', () => {
  assert.equal(shouldRevealWarden({ innerClusterLive: false, furtherWorldLive: false }), false);
  assert.equal(shouldRevealWarden({ innerClusterLive: true, furtherWorldLive: false }), false);
  assert.equal(shouldRevealWarden({ innerClusterLive: false, furtherWorldLive: true }), false);
  assert.equal(shouldRevealWarden({ innerClusterLive: true, furtherWorldLive: true }), true);

  let State = createWardenPursuitState({ startingDistance: 4 });
  State = resolveWardenPursuit(State, { activeRelayCount: 3, targetWorldIdentifier: 'grove' });
  assert.equal(State.status, 'hidden');
  assert.equal(State.distance, 4);

  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'tide',
    shouldReveal: true,
  });
  assert.equal(State.status, 'pursuing');
  assert.equal(State.distance, 4);
  assert.equal(State.targetWorldIdentifier, 'tide');
  assert.equal(State.lastEvent, WardenPursuitEvents.revealed);
});

test('circuits closed before the hunt still break shields without revealing', () => {
  let State = createWardenPursuitState({ startingDistance: 4 });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 3,
    targetWorldIdentifier: 'grove',
    firstCircuitClosed: true,
  });
  assert.equal(State.status, 'hidden');
  assert.equal(State.shieldLayers, 1);
  assert.equal(State.distance, 4);
  assert.equal(State.lastEvent, WardenPursuitEvents.retreated);
});

test('later resolved flights advance once while a first circuit closure retreats once', () => {
  let State = createWardenPursuitState({ startingDistance: 3 });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'grove',
    shouldReveal: true,
  });
  State = resolveWardenPursuit(State, { activeRelayCount: 4, targetWorldIdentifier: 'grove' });
  assert.equal(State.distance, 2);
  assert.equal(State.lastEvent, WardenPursuitEvents.advanced);

  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'grove',
    firstCircuitClosed: true,
  });
  assert.equal(State.distance, 3);
  assert.equal(State.shieldLayers, 1);
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

test('breaking the second shield exposes the command and freezes pursuit', () => {
  let State = createWardenPursuitState({ startingDistance: 3 });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'grove',
    shouldReveal: true,
  });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 3,
    targetWorldIdentifier: 'grove',
    firstCircuitClosed: true,
  });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'frost',
    firstCircuitClosed: true,
  });

  assert.equal(State.status, 'exposed');
  assert.equal(State.shieldLayers, 0);
  assert.equal(State.targetWorldIdentifier, null);

  const ExposedState = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'bastion',
  });
  assert.equal(ExposedState.status, 'exposed');
  assert.equal(ExposedState.distance, State.distance);
  assert.equal(ExposedState.targetWorldIdentifier, null);
  assert.equal(ExposedState.lastEvent, WardenPursuitEvents.exposed);
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

test('arrival catches only the unprotected Runner on the targeted world', () => {
  let State = createWardenPursuitState({ startingDistance: 1 });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'grove',
    shouldReveal: true,
  });
  State = resolveWardenPursuit(State, {
    activeRelayCount: 4,
    targetWorldIdentifier: 'grove',
  });
  assert.equal(shouldWardenCatchRunner(State, 'grove'), true);
  assert.equal(shouldWardenCatchRunner(State, 'haven'), false);
  assert.equal(shouldWardenCatchRunner(State, 'grove', ['grove']), false);
});
