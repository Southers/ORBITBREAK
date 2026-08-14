import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSerializedReplay } from '../src/replay-validator.js';

const CompletedBreakerReachReplay = JSON.stringify({
  v: 1,
  s: 'breaker-reach',
  c: 'breaker-reach-3',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [108, 'meadow', 18.288242289175088, 0.6416927119009118],
    [450, 'ember', 18.289101298583088, 0.6417249200732145],
    [790, 'grove', 18.18743573681574, 2.5679869775427595],
    [1130, 'tide', 10.368391466289856, 15.018620389428841],
  ],
});

const CompletedSchemaV2BurnRouteReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-3',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [
      0, 'meadow', -25.622854125084285, -13.480221902220736,
      1.1808072956659474, 6.696674801492126, 50,
    ],
    [
      258, 'frost', -2.373812497227245, 10.771031250462126,
      18.001689109936624, 3.0002815183227707, null,
    ],
    [
      328, 'bastion', 12.471332729194861, 10.057334541610278,
      8.161648117874234, -16.323296235748465, null,
    ],
    [
      394, 'tide', 19.962296546092517, 0.7660668914832669,
      13.565118169010786, 12.208606352109706, null,
    ],
  ],
});

test('validator derives the browser-completed route and score from input alone', () => {
  const Validation = validateSerializedReplay(CompletedBreakerReachReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, {
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-3',
    score: 7000,
    launchesUsed: 4,
    flightTimeMilliseconds: 2975,
    slingshotScore: 0,
    liberationScore: 3000,
    completionBonus: 4000,
    collectedStardustCount: 0,
  });
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
  ForgedReplay.l[0][2] = 1;
  ForgedReplay.l[0][3] = 18;
  const Validation = validateSerializedReplay(JSON.stringify(ForgedReplay));

  assert.equal(Validation.valid, false);
});

test('validator ignores a forged claimed total and returns the derived score', () => {
  const ForgedReplay = JSON.parse(CompletedBreakerReachReplay);
  ForgedReplay.score = 999999999;
  const Validation = validateSerializedReplay(JSON.stringify(ForgedReplay));

  assert.equal(Validation.valid, true);
  assert.equal(Validation.result.score, 7000);
});

test('schema-v2 validator derives the repositioned route and its fixed-step Burn', () => {
  const Validation = validateSerializedReplay(CompletedSchemaV2BurnRouteReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, {
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-3',
    score: 7900,
    launchesUsed: 4,
    flightTimeMilliseconds: 3892,
    slingshotScore: 0,
    liberationScore: 3900,
    completionBonus: 4000,
    collectedStardustCount: 1,
  });
});

test('schema-v2 validator rejects forged surface origins and Burns outside a flight', () => {
  const ForgedSurfaceReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  ForgedSurfaceReplay.l[0][2] += 0.2;
  const SurfaceValidation = validateSerializedReplay(JSON.stringify(ForgedSurfaceReplay));
  assert.equal(SurfaceValidation.valid, false);
  assert.match(SurfaceValidation.reason, /outside its recorded surface/);

  const LateBurnReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  LateBurnReplay.l[1][6] = 394;
  const BurnValidation = validateSerializedReplay(JSON.stringify(LateBurnReplay));
  assert.equal(BurnValidation.valid, false);
  assert.match(BurnValidation.reason, /Burn outside its flight/);
});
