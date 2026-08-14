import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareLeaderboardEntries,
  createInMemoryLeaderboardStore,
  createLeaderboardRequestHandler,
  createLeaderboardService,
  normalizeCallsign,
} from '../server/leaderboard-service.js';

const VerifiedReplay = JSON.stringify({
  v: 1, s: 'breaker-reach', c: 'breaker-reach-1',
  p: 'orbitbreak-fixed-step-v1', h: 120, o: 1,
  l: [
    [108, 'meadow', 18.288242289175088, 0.6416927119009118],
    [450, 'ember', 18.289101298583088, 0.6417249200732145],
    [790, 'grove', 18.18743573681574, 2.5679869775427595],
    [1130, 'tide', 11.983741479291645, 13.798477634983227],
  ],
});

function createService() {
  let Identifier = 0;
  return createLeaderboardService({
    store: createInMemoryLeaderboardStore(),
    now: () => new Date('2026-08-14T12:00:00.000Z'),
    createIdentifier: () => `replay-${Identifier += 1}`,
  });
}

test('service accepts a verified replay and stores only its derived result', async () => {
  const Service = createService();
  const Submission = await Service.submit({
    callsign: '  runner_7 ',
    replay: VerifiedReplay,
    score: 999999999,
  });

  assert.equal(Submission.accepted, true);
  assert.equal(Submission.entry.callsign, 'RUNNER_7');
  assert.equal(Submission.entry.score, 7000);
  assert.equal(Submission.entry.replay, undefined);
  assert.equal(Submission.rank, 1);
  assert.equal((await Service.getReplay(Submission.entry.id)).replay, VerifiedReplay);
});

test('service rejects invalid and duplicate replay submissions', async () => {
  const Service = createService();
  assert.equal((await Service.submit({ callsign: 'ACE', replay: '{}' })).status, 422);
  assert.equal((await Service.submit({ callsign: 'ACE', replay: VerifiedReplay })).status, 201);
  assert.equal((await Service.submit({ callsign: 'BEE', replay: VerifiedReplay })).status, 409);
});

test('callsigns are constrained and minimally moderated', () => {
  assert.equal(normalizeCallsign(' orbit-1 '), 'ORBIT-1');
  assert.throws(() => normalizeCallsign('x'), /3–12/);
  assert.throws(() => normalizeCallsign('bad space'), /3–12/);
  assert.throws(() => normalizeCallsign('NAZI_1'), /not available/);
});

test('online ordering matches score, launches, flight time and stable age', () => {
  const BaseEntry = {
    id: 'a', score: 7000, launchesUsed: 4,
    flightTimeMilliseconds: 3000, createdAt: '2026-08-14T12:00:00.000Z',
  };
  const Entries = [
    { ...BaseEntry, id: 'slow', flightTimeMilliseconds: 3200 },
    { ...BaseEntry, id: 'high', score: 8000 },
    { ...BaseEntry, id: 'more-launches', launchesUsed: 5 },
    BaseEntry,
  ].sort(compareLeaderboardEntries);
  assert.deepEqual(Entries.map((Entry) => Entry.id), [
    'high', 'a', 'slow', 'more-launches',
  ]);
});

test('HTTP contract supports submit, ranked list, replay fetch and CORS', async () => {
  const Service = createService();
  const Handler = createLeaderboardRequestHandler({
    service: Service,
    allowedOrigin: 'https://southers.github.io',
  });
  const SubmitResponse = await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callsign: 'ACE', replay: VerifiedReplay }),
  }));
  const Submission = await SubmitResponse.json();
  assert.equal(SubmitResponse.status, 201);
  assert.equal(SubmitResponse.headers.get('access-control-allow-origin'), 'https://southers.github.io');

  const ListResponse = await Handler(new Request(
    'https://scores.example/api/leaderboard?system=breaker-reach&content=breaker-reach-1',
  ));
  assert.equal((await ListResponse.json()).entries[0].score, 7000);

  const ReplayResponse = await Handler(new Request(
    `https://scores.example/api/replays/${Submission.entry.id}`,
  ));
  assert.equal((await ReplayResponse.json()).replay, VerifiedReplay);
  assert.equal((await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'OPTIONS',
  }))).status, 204);
});
