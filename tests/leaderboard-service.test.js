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
  v: 2, s: 'breaker-reach', c: 'breaker-reach-4',
  p: 'orbitbreak-fixed-step-v1', h: 120, o: 1,
  l: [
    [0, 'meadow', -20.169758592649977, -9.726411328046426, 17.089583142026537, 0.5967813936127666, 5],
    [45, 'ember', -13.45741319496786, -9.475808784347384, 18.2388825930985, 0.6369158148206426, null],
    [144, 'grove', 2.172876907139826, -4.235567739034147, -18.205543917241794, -1.2730556458302782, null],
    [301, 'meadow', -20.8933747416002, -7.742904631196904, 11.235821924693264, 14.381196253322678, null],
    [422, 'frost', -5.550710296381496, 5.539544938575729, 11.235821924693267, -14.381196253322672, null],
    [507, 'grove', 1.4600000000000004, -6, 14.478698460315043, 11.109896079409152, null],
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
  assert.equal(Submission.entry.score, 11650);
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
    'https://scores.example/api/leaderboard?system=breaker-reach&content=breaker-reach-4',
  ));
  assert.equal((await ListResponse.json()).entries[0].score, 11650);

  const ReplayResponse = await Handler(new Request(
    `https://scores.example/api/replays/${Submission.entry.id}`,
  ));
  assert.equal((await ReplayResponse.json()).replay, VerifiedReplay);
  assert.equal((await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'OPTIONS',
  }))).status, 204);
});
