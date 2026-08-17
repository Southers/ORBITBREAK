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
  evaluateRelayPortLanding,
  resolveWardenAfterNonCommandFlight,
} from '../src/flight-resolver.js';
import {
  RelayPortBullseyeBonus,
  RelayPortCleanBonus,
  RunnerRadius,
  SurfaceRestLift,
} from '../src/sim-constants.js';
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

test('relay-port grading covers bullseye, clean, miss and portless worlds', () => {
  const WorldPosition = createVector(0, 0, 0);
  const PortWorld = {
    radius: 3,
    relayPort: { angleRadians: 0, halfWidthRadians: 0.9 },
  };
  const restAtAngle = (AngleRadians) => createVector(
    Math.cos(AngleRadians) * 3.4,
    Math.sin(AngleRadians) * 3.4,
    0,
  );

  const Bullseye = evaluateRelayPortLanding(PortWorld, restAtAngle(0.1), WorldPosition);
  assert.equal(Bullseye.insidePort, true);
  assert.equal(Bullseye.precisionTier, 'bullseye');
  assert.equal(Bullseye.precisionBonus, RelayPortBullseyeBonus);

  const Clean = evaluateRelayPortLanding(PortWorld, restAtAngle(0.6), WorldPosition);
  assert.equal(Clean.insidePort, true);
  assert.equal(Clean.precisionTier, 'clean');
  assert.equal(Clean.precisionBonus, RelayPortCleanBonus);

  const Miss = evaluateRelayPortLanding(PortWorld, restAtAngle(2.4), WorldPosition);
  assert.equal(Miss.hasPort, true);
  assert.equal(Miss.insidePort, false);
  assert.equal(Miss.precisionTier, null);
  assert.equal(Miss.precisionBonus, 0);

  const WrapMiss = evaluateRelayPortLanding(
    { radius: 3, relayPort: { angleRadians: Math.PI - 0.1, halfWidthRadians: 0.5 } },
    restAtAngle(-Math.PI + 0.2),
    WorldPosition,
  );
  assert.equal(WrapMiss.insidePort, true);

  const Portless = evaluateRelayPortLanding({ radius: 3 }, restAtAngle(2.4), WorldPosition);
  assert.equal(Portless.hasPort, false);
  assert.equal(Portless.insidePort, true);
  assert.equal(Portless.precisionBonus, 0);
});

test('every unrestored Breaker\'s Reach world authors a relay port', () => {
  const Definition = getAuthoredSystemDefinition('breaker-reach');
  for (const World of Definition.worlds) {
    if (World.initiallyRestored) {
      continue;
    }
    assert.ok(World.relayPort, `${World.id} must author a relay port`);
    assert.ok(Number.isFinite(World.relayPort.angleRadians));
    assert.ok(
      World.relayPort.halfWidthRadians > 0.3,
      `${World.id} port must stay generous`,
    );
  }
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
