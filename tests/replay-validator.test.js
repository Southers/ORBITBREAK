import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSerializedReplay } from '../src/replay-validator.js';

const CompletedBreakerReachReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-4',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [0, 'meadow', -20.169758592649977, -9.726411328046426, 18.2388825930985, 0.6369158148206426, null],
    [45, 'ember', -13.45741319496786, -9.475808784347384, 18.2388825930985, 0.6369158148206426, null],
    [144, 'grove', 2.172876907139826, -4.235567739034147, -18.205543917241794, -1.2730556458302782, null],
    [301, 'meadow', -20.8933747416002, -7.742904631196904, 11.235821924693264, 14.381196253322678, null],
    [422, 'frost', -5.550710296381496, 5.539544938575729, 11.235821924693267, -14.381196253322672, null],
    [507, 'grove', 1.4600000000000004, -6, 14.478698460315043, 11.109896079409152, null],
  ],
});

const CompletedSchemaV2BurnRouteReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-4',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [0, 'meadow', -20.169758592649977, -9.726411328046426, 17.089583142026537, 0.5967813936127666, 5],
    [45, 'ember', -13.45741319496786, -9.475808784347384, 18.2388825930985, 0.6369158148206426, null],
    [144, 'grove', 2.172876907139826, -4.235567739034147, -18.205543917241794, -1.2730556458302782, null],
    [301, 'meadow', -20.8933747416002, -7.742904631196904, 11.235821924693264, 14.381196253322678, null],
    [422, 'frost', -5.550710296381496, 5.539544938575729, 11.235821924693267, -14.381196253322672, null],
    [507, 'grove', 1.4600000000000004, -6, 14.478698460315043, 11.109896079409152, null],
  ],
});

test('validator derives the browser-completed route and score from input alone', () => {
  const Validation = validateSerializedReplay(CompletedBreakerReachReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, {
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-4',
    score: 11650,
    launchesUsed: 6,
    flightTimeMilliseconds: 5925,
    slingshotScore: 1750,
    networkScore: 5900,
    liberationScore: 3400,
    circuitScore: 2500,
    victoryScore: 4000,
    completionBonus: 4000,
    collectedStardustCount: 2,
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
  assert.equal(Validation.result.score, 11650);
});

test('validator rejects the former direct Command route without two unique circuits', () => {
  const ShortcutReplay = JSON.stringify({
    v: 2,
    s: 'breaker-reach',
    c: 'breaker-reach-4',
    p: 'orbitbreak-fixed-step-v1',
    h: 120,
    o: 1,
    l: [
      [0, 'meadow', -25.622854125084285, -13.480221902220736, 1.1808072956659474, 6.696674801492126, 50],
      [258, 'frost', -2.373812497227245, 10.771031250462126, 18.001689109936624, 3.0002815183227707, null],
      [328, 'bastion', 12.471332729194861, 10.057334541610278, 8.161648117874234, -16.323296235748465, null],
      [394, 'tide', 19.962296546092517, 0.7660668914832669, 13.565118169010786, 12.208606352109706, null],
    ],
  });

  const Validation = validateSerializedReplay(ShortcutReplay);
  assert.equal(Validation.valid, false);
  assert.match(Validation.reason, /Command World/);
});

test('schema-v2 validator derives the repositioned route and its fixed-step Burn', () => {
  const Validation = validateSerializedReplay(CompletedSchemaV2BurnRouteReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, {
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-4',
    score: 11650,
    launchesUsed: 6,
    flightTimeMilliseconds: 5892,
    slingshotScore: 1750,
    networkScore: 5900,
    liberationScore: 3400,
    circuitScore: 2500,
    victoryScore: 4000,
    completionBonus: 4000,
    collectedStardustCount: 2,
  });
});

test('schema-v2 validator rejects forged surface origins and Burns outside a flight', () => {
  const ForgedSurfaceReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  ForgedSurfaceReplay.l[0][2] += 0.2;
  const SurfaceValidation = validateSerializedReplay(JSON.stringify(ForgedSurfaceReplay));
  assert.equal(SurfaceValidation.valid, false);
  assert.match(SurfaceValidation.reason, /outside its recorded surface/);

  const LateBurnReplay = JSON.parse(CompletedSchemaV2BurnRouteReplay);
  LateBurnReplay.l[5][6] = 1000;
  const BurnValidation = validateSerializedReplay(JSON.stringify(LateBurnReplay));
  assert.equal(BurnValidation.valid, false);
  assert.match(BurnValidation.reason, /Burn outside its flight/);
});
