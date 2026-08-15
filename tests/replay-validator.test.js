import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSerializedReplay } from '../src/replay-validator.js';

const CompletedBreakerReachReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-5',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [0, 'meadow', -18.383711059475825, -9.29153176447292, 12.5, 0, null],
    [81, 'ember', -9.39128652337041, -9.582336791038667, 8.99174750423314, 8.683229630737465, null],
    [246, 'grove', 3.5196755693207544, -5.6697576825922, -12.5, -1.5308084989341915e-15, null],
    [582, 'meadow', -24.941610661576874, -10.468304421196311, 4.592425496802575e-16, 7.5, 612],
    [854, 'frost', -6.028288379931077, 6.744597165098799, 8.683229630737465, -8.99174750423314, null],
    [985, 'grove', 3.506030257999854, -2.350692592029089, 8.364132579485728, 9.289310318467429, null],
    [1119, 'tide', 15.074880278671033, 0.4940867834126872, 11.669755331215022, 4.4795993693162535, null],
  ],
});

const CompletedSchemaV2BurnRouteReplay = CompletedBreakerReachReplay;

const ExpectedCompletedResult = {
  systemIdentifier: 'breaker-reach',
  contentVersion: 'breaker-reach-5',
  score: 10900,
  launchesUsed: 7,
    flightTimeMilliseconds: 11217,
  slingshotScore: 0,
  networkScore: 6900,
  liberationScore: 4400,
  circuitScore: 2500,
  victoryScore: 4000,
  completionBonus: 4000,
  collectedStardustCount: 0,
};

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
  const ShortcutReplay = JSON.stringify({
    v: 2,
    s: 'breaker-reach',
    c: 'breaker-reach-5',
    p: 'orbitbreak-fixed-step-v1',
    h: 120,
    o: 1,
    l: [
      [0, 'meadow', -18.383711059475825, -9.29153176447292, 12.5, 0, null],
      [81, 'ember', -9.39128652337041, -9.582336791038667, 8.364132579485728, 9.289310318467429, null],
      [247, 'grove', 3.0988007181811215, -4.723286061785807, 10.112712429686843, 7.347315653655914, null],
      [753, 'tide', 20.245878648434797, 4.404189904417844, 11.137581552354598, 5.674881246744334, null],
    ],
  });

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
