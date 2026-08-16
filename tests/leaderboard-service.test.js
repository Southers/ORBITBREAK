import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareLeaderboardEntries,
  createInMemoryLeaderboardStore,
  createLeaderboardRequestHandler,
  createLeaderboardService,
  normalizeCallsign,
} from '../server/leaderboard-service.js';
import { loadSerializedReplayFixture } from './fixtures/load-fixture.js';

const VerifiedReplay = loadSerializedReplayFixture('breaker-reach-complete.v2.json');

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
  assert.equal(Submission.entry.score, 10900);
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
    'https://scores.example/api/leaderboard?system=breaker-reach&content=breaker-reach-6',
  ));
  assert.equal((await ListResponse.json()).entries[0].score, 10900);

  const ReplayResponse = await Handler(new Request(
    `https://scores.example/api/replays/${Submission.entry.id}`,
  ));
  assert.equal((await ReplayResponse.json()).replay, VerifiedReplay);
  assert.equal((await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'OPTIONS',
  }))).status, 204);
});

test('HTTP boundary echoes only client-safe errors and hides internal failures', async () => {
  const Handler = createLeaderboardRequestHandler({
    service: {
      async submit() {
        throw new Error('D1_ERROR: no such column: secret_internal_detail');
      },
      async list({ systemIdentifier, contentVersion }) {
        return createService().list({ systemIdentifier, contentVersion });
      },
    },
    allowedOrigin: 'https://southers.github.io',
  });

  const MalformedResponse = await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  }));
  assert.equal(MalformedResponse.status, 400);
  assert.equal((await MalformedResponse.json()).error, 'Request body must be valid JSON.');

  const InternalFailureResponse = await Handler(new Request('https://scores.example/api/leaderboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callsign: 'ACE', replay: '{}' }),
  }));
  assert.equal(InternalFailureResponse.status, 500);
  assert.equal((await InternalFailureResponse.json()).error, 'Request failed.');

  const ValidationHandler = createLeaderboardRequestHandler({
    service: createService(),
    allowedOrigin: 'https://southers.github.io',
  });
  const BadCallsignResponse = await ValidationHandler(new Request('https://scores.example/api/leaderboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callsign: 'x', replay: VerifiedReplay }),
  }));
  assert.equal(BadCallsignResponse.status, 400);
  assert.match((await BadCallsignResponse.json()).error, /3–12/);

  const MissingQueryResponse = await ValidationHandler(new Request(
    'https://scores.example/api/leaderboard',
  ));
  assert.equal(MissingQueryResponse.status, 400);
  assert.equal(
    (await MissingQueryResponse.json()).error,
    'System and content version are required.',
  );
  assert.equal(MissingQueryResponse.headers.get('x-content-type-options'), 'nosniff');

  const InvalidList = await ValidationHandler(new Request(
    'https://scores.example/api/leaderboard?system=<script>&content=breaker-reach-4',
  ));
  assert.equal(InvalidList.status, 400);
  assert.equal((await InvalidList.json()).error, 'System identifier is invalid.');
});
