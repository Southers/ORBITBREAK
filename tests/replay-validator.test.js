import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSerializedReplay } from '../src/replay-validator.js';

const CompletedBreakerReachReplay = JSON.stringify({
  v: 1,
  s: 'breaker-reach',
  c: 'breaker-reach-1',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [108, 'meadow', 18.288242289175088, 0.6416927119009118],
    [450, 'ember', 18.289101298583088, 0.6417249200732145],
    [790, 'grove', 18.18743573681574, 2.5679869775427595],
    [1130, 'tide', 11.983741479291645, 13.798477634983227],
  ],
});

test('validator derives the browser-completed route and score from input alone', () => {
  const Validation = validateSerializedReplay(CompletedBreakerReachReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, {
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-1',
    score: 7000,
    launchesUsed: 4,
    flightTimeMilliseconds: 2842,
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
