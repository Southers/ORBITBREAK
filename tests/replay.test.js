import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PhysicsModelVersion,
  createReplayRecorder,
  finishReplay,
  getPersonalBestGhostStorageKey,
  getReplayStorageKey,
  parseReplay,
  recordReplayBurn,
  recordReplayLaunch,
  serializeReplay,
} from '../src/replay.js';

function createRecorder() {
  return createReplayRecorder({
    systemIdentifier: 'breakers-reach',
    contentVersion: 'breaker-reach-4',
    fixedStepHz: 120,
  });
}

test('replay captures exact ordered launch inputs without a claimed score', () => {
  let Replay = createRecorder();
  Replay = recordReplayLaunch(Replay, {
    stepIndex: 42,
    originIdentifier: 'meadow',
    originX: -10.25,
    originY: 3.5,
    velocityX: 12.345678901234,
    velocityY: -1.25,
  });
  Replay = recordReplayBurn(Replay, { stepIndex: 71 });
  Replay = finishReplay(Replay, 'complete');
  const SerializedReplay = serializeReplay(Replay);
  const WireReplay = JSON.parse(SerializedReplay);

  assert.equal(WireReplay.p, PhysicsModelVersion);
  assert.equal(WireReplay.l[0][2], -10.25);
  assert.equal(WireReplay.l[0][4], 12.345678901234);
  assert.equal(WireReplay.l[0][6], 71);
  assert.equal('score' in WireReplay, false);
  assert.deepEqual(parseReplay(SerializedReplay), Replay);
});

test('eight launches stay compact enough for storage and transport', () => {
  let Replay = createRecorder();
  for (let LaunchIndex = 0; LaunchIndex < 8; LaunchIndex += 1) {
    Replay = recordReplayLaunch(Replay, {
      stepIndex: 100 + (LaunchIndex * 420),
      originIdentifier: `world-${LaunchIndex}`,
      originX: LaunchIndex,
      originY: -LaunchIndex,
      velocityX: 10 + (LaunchIndex * 0.125),
      velocityY: -4 + (LaunchIndex * 0.25),
    });
  }
  Replay = finishReplay(Replay, 'complete');
  assert.ok(serializeReplay(Replay).length < 900);
});

test('replays reject non-monotonic time, invalid velocity and post-finish input', () => {
  const FirstLaunch = recordReplayLaunch(createRecorder(), {
    stepIndex: 20,
    originIdentifier: 'meadow',
    originX: 1,
    originY: 2,
    velocityX: 8,
    velocityY: 2,
  });
  assert.throws(() => recordReplayLaunch(FirstLaunch, {
    stepIndex: 20,
    originIdentifier: 'ember',
    originX: 3,
    originY: 4,
    velocityX: 8,
    velocityY: 2,
  }), /must increase/);
  assert.throws(() => recordReplayLaunch(createRecorder(), {
    stepIndex: 1,
    originIdentifier: 'meadow',
    originX: 1,
    originY: 2,
    velocityX: Infinity,
    velocityY: 0,
  }), /velocity/);
  assert.throws(() => recordReplayLaunch(createRecorder(), {
    stepIndex: 10000001,
    originIdentifier: 'meadow',
    originX: 1,
    originY: 2,
    velocityX: 1,
    velocityY: 1,
  }), /step/);
  assert.throws(() => recordReplayLaunch(finishReplay(FirstLaunch, 'failed'), {
    stepIndex: 30,
    originIdentifier: 'ember',
    originX: 3,
    originY: 4,
    velocityX: 1,
    velocityY: 1,
  }), /finished replay/);
  assert.throws(
    () => recordReplayBurn(recordReplayBurn(FirstLaunch, { stepIndex: 21 }), { stepIndex: 22 }),
    /only one Burn/,
  );
});

test('legacy launch-only replays remain parseable for existing verified runs', () => {
  const Legacy = JSON.stringify({
    v: 1,
    s: 'breakers-reach',
    c: 'breaker-reach-4',
    p: PhysicsModelVersion,
    h: 120,
    o: 1,
    l: [[10, 'meadow', 8, 2]],
  });
  const Parsed = parseReplay(Legacy);
  assert.equal(Parsed.schemaVersion, 1);
  assert.equal(Parsed.launches[0].originX, undefined);
});

test('parser fails closed on corrupt, oversized and unsupported payloads', () => {
  assert.throws(() => parseReplay('{'), /valid JSON/);
  assert.throws(() => parseReplay('x'.repeat(8193)), /payload is invalid/);
  assert.throws(() => parseReplay(JSON.stringify({ v: 99, l: [], o: 1 })), /unsupported/);
});

test('replay storage is isolated by system and content version', () => {
  assert.equal(
    getReplayStorageKey('breakers-reach', 'breaker-reach-4'),
    'orbitbreak.last-replay.breakers-reach.breaker-reach-4',
  );
  assert.equal(
    getPersonalBestGhostStorageKey('breakers-reach', 'breaker-reach-4'),
    'orbitbreak.best-ghost.breakers-reach.breaker-reach-4',
  );
});
