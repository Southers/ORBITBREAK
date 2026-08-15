import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSerializedReplay } from '../src/replay-validator.js';
import {
  loadReplayFixture,
  loadSerializedReplayFixture,
} from './fixtures/load-fixture.js';

const CompletedBreakerReachReplay = loadSerializedReplayFixture(
  'breaker-reach-complete.v2.json',
);
const CompletedSchemaV2BurnRouteReplay = CompletedBreakerReachReplay;
const ExpectedCompletedResult = loadReplayFixture(
  'breaker-reach-complete.v2.result.json',
);
const ShortcutReplay = loadSerializedReplayFixture(
  'breaker-reach-command-shortcut.v2.json',
);

test('validator derives the browser-completed route and score from input alone', () => {
  const Validation = validateSerializedReplay(CompletedBreakerReachReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, ExpectedCompletedResult);
});

test('validator rejects a forged origin even when the payload parses', () => {
  const ForgedReplay = JSON.parse(CompletedBreakerReachReplay);
  ForgedReplay.l[1][1] = 'frost';
  const Validation = validateSerializedReplay(JSON.stringify(ForgedReplay));

  assert.equal(Validation.valid, false);
  assert.match(Validation.reason, /impossible origin/);
});

test('validator rejects changed content, physics and unfinished routes', () => {
  for (const Mutation of [
    (Replay) => { Replay.c = 'forged-content'; },
    (Replay) => { Replay.p = 'forged-physics'; },
    (Replay) => { Replay.l.pop(); },
  ]) {
    const ForgedReplay = JSON.parse(CompletedBreakerReachReplay);
    Mutation(ForgedReplay);
    assert.equal(
      validateSerializedReplay(JSON.stringify(ForgedReplay)).valid,
      false,
    );
  }
});

test('validator derives a different outcome after velocity tampering', () => {
  const ForgedReplay = JSON.parse(CompletedBreakerReachReplay);
  ForgedReplay.l[0][4] = 1;
  ForgedReplay.l[0][5] = 18;
  const Validation = validateSerializedReplay(JSON.stringify(ForgedReplay));

  assert.equal(Validation.valid, false);
});

test('validator ignores a forged claimed total and returns the derived score', () => {
  const ForgedReplay = JSON.parse(CompletedBreakerReachReplay);
  ForgedReplay.score = 999999999;
  const Validation = validateSerializedReplay(JSON.stringify(ForgedReplay));

  assert.equal(Validation.valid, true);
  assert.equal(Validation.result.score, 10900);
});

test('validator rejects the former direct Command route without two unique circuits', () => {
  const Validation = validateSerializedReplay(ShortcutReplay);
  assert.equal(Validation.valid, false);
  assert.match(Validation.reason, /Command World/);
});

test('schema-v2 validator derives the repositioned route and its fixed-step Burn', () => {
  const Validation = validateSerializedReplay(CompletedSchemaV2BurnRouteReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, ExpectedCompletedResult);
});

test('schema-v2 validator rejects forged surface origins and Burns outside a flight', () => {
  const ForgedSurfaceReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  ForgedSurfaceReplay.l[0][2] += 0.2;
  const SurfaceValidation = validateSerializedReplay(JSON.stringify(ForgedSurfaceReplay));
  assert.equal(SurfaceValidation.valid, false);
  assert.match(SurfaceValidation.reason, /outside its recorded surface/);

  const LateBurnReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  LateBurnReplay.l[6][6] = 5000;
  const BurnValidation = validateSerializedReplay(JSON.stringify(LateBurnReplay));
  assert.equal(BurnValidation.valid, false);
  assert.match(BurnValidation.reason, /Burn outside its flight/);
});
