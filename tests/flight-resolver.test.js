import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthoredSystemRuntime, getAuthoredSystemDefinition } from '../src/content.js';
import { createVector } from '../src/physics.js';
import { connectRelayWorlds, createRelayNetworkState, isRelayWorldLive } from '../src/network.js';
import { createWardenPursuitState } from '../src/warden.js';
import { validateSerializedReplay } from '../src/replay-validator.js';
import {
  calculateSurfaceRestPosition,
  createStartingPosition,
  resolveWardenAfterNonCommandFlight,
} from '../src/flight-resolver.js';
import { RunnerRadius, SurfaceRestLift } from '../src/sim-constants.js';
import {
  loadReplayFixture,
  loadSerializedReplayFixture,
} from './fixtures/load-fixture.js';

test('surface rest uses a stable +X fallback when the impact sits on the body centre', () => {
  const Body = { radius: 3 };
  const Centre = createVector(10, -4, 0);
  const Rest = calculateSurfaceRestPosition(Body, Centre, Centre);
  assert.equal(Rest.x, 10 + 3 + RunnerRadius + SurfaceRestLift);
  assert.equal(Rest.y, -4);
  assert.equal(Rest.z, 0);
});

test('Breaker\'s Reach starting position sits on Haven facing Ember', () => {
  const Runtime = createAuthoredSystemRuntime(
    getAuthoredSystemDefinition('breaker-reach'),
    { createVector },
  );
  const Start = createStartingPosition(Runtime);
  const Haven = Runtime.worlds.find((World) => World.id === 'meadow');
  const Distance = Math.hypot(Start.x - Haven.position.x, Start.y - Haven.position.y);
  assert.ok(Math.abs(Distance - (Haven.radius + RunnerRadius + SurfaceRestLift)) < 1e-9);
});

test('shared resolver derives the golden completed Breaker\'s Reach result', () => {
  const Serialized = loadSerializedReplayFixture('breaker-reach-complete.v2.json');
  const Expected = loadReplayFixture('breaker-reach-complete.v2.result.json');
  const Validation = validateSerializedReplay(Serialized);
  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, Expected);
});

test('Warden catch fires when pursuit arrives on the Runner\'s vulnerable world', () => {
  const Runtime = createAuthoredSystemRuntime(
    getAuthoredSystemDefinition('breaker-reach'),
    { createVector },
  );
  const NetworkState = createRelayNetworkState('meadow');
  connectRelayWorlds(NetworkState, 'meadow', 'ember');
  connectRelayWorlds(NetworkState, 'meadow', 'grove');
  Runtime.worlds.find((World) => World.id === 'ember').restored = true;
  Runtime.worlds.find((World) => World.id === 'grove').restored = true;

  const WardenState = {
    ...createWardenPursuitState({ startingDistance: 1 }),
    status: 'pursuing',
    targetWorldIdentifier: 'grove',
  };
  const Resolution = resolveWardenAfterNonCommandFlight({
    runtime: Runtime,
    networkState: NetworkState,
    wardenState: WardenState,
    currentNodeIdentifier: 'grove',
    firstCircuitClosed: false,
    isWorldheartOpen: false,
  });
  assert.equal(Resolution.caught, true);
  assert.equal(isRelayWorldLive(NetworkState, 'grove'), true);
});
