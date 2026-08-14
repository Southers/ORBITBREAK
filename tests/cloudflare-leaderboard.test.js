import test from 'node:test';
import assert from 'node:assert/strict';

import { createD1LeaderboardStore } from '../server/cloudflare/d1-store.js';
import Worker from '../server/cloudflare/worker.js';

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

class FakeD1Statement {
  constructor(Database, Sql) {
    this.database = Database;
    this.sql = Sql;
    this.values = [];
  }

  bind(...Values) {
    this.values = Values;
    return this;
  }

  async first() {
    if (this.sql.includes('replay_digest = ?')) {
      const Record = this.database.records.find((Entry) => Entry.replay_digest === this.values[0]);
      return Record ? { id: Record.id } : null;
    }
    const Record = this.database.records.find((Entry) => Entry.id === this.values[0]);
    return Record ? { ...Record } : null;
  }

  async run() {
    if (!this.sql.includes('INSERT INTO leaderboard_entries')) {
      throw new Error('Unexpected fake D1 write.');
    }
    const [
      id, callsign, system_identifier, content_version, score, launches_used,
      flight_time_ms, slingshot_score, liberation_score, completion_bonus,
      collected_stardust_count, replay, replay_digest, created_at,
    ] = this.values;
    if (this.database.records.some((Entry) => Entry.replay_digest === replay_digest)) {
      throw new Error('UNIQUE constraint failed: leaderboard_entries.replay_digest');
    }
    this.database.records.push({
      id, callsign, system_identifier, content_version, score, launches_used,
      flight_time_ms, slingshot_score, liberation_score, completion_bonus,
      collected_stardust_count, replay, replay_digest, created_at,
    });
    return { success: true };
  }

  async all() {
    const [SystemIdentifier, ContentVersion, Limit] = this.values;
    return {
      results: this.database.records
        .filter((Entry) => (
          Entry.system_identifier === SystemIdentifier
          && Entry.content_version === ContentVersion
        ))
        .slice(0, Limit)
        .map((Entry) => {
          const { replay, replay_digest, ...PublicEntry } = Entry;
          return PublicEntry;
        }),
    };
  }
}

class FakeD1Database {
  constructor() {
    this.records = [];
  }

  prepare(Sql) {
    return new FakeD1Statement(this, Sql);
  }
}

const ExampleRecord = {
  id: 'record-1', callsign: 'ACE', systemIdentifier: 'breaker-reach',
  contentVersion: 'breaker-reach-4', score: 11650, launchesUsed: 6,
  flightTimeMilliseconds: 5892, slingshotScore: 1750, networkScore: 5900,
  victoryScore: 4000, collectedStardustCount: 2, replay: VerifiedReplay,
  createdAt: '2026-08-14T12:00:00.000Z',
};

test('D1 adapter stores a replay digest and maps durable records', async () => {
  const Database = new FakeD1Database();
  const Store = createD1LeaderboardStore(Database);
  assert.equal(await Store.hasReplay(VerifiedReplay), false);
  await Store.insert(ExampleRecord);

  assert.equal(await Store.hasReplay(VerifiedReplay), true);
  assert.equal(Database.records[0].replay_digest.length, 64);
  assert.deepEqual((await Store.list('breaker-reach', 'breaker-reach-4', 20))[0], {
    ...ExampleRecord,
    replay: undefined,
  });
  assert.deepEqual(await Store.getById('record-1'), ExampleRecord);
});

test('D1 adapter converts unique digest races into duplicate replay errors', async () => {
  const Store = createD1LeaderboardStore(new FakeD1Database());
  await Store.insert(ExampleRecord);
  await assert.rejects(
    () => Store.insert({ ...ExampleRecord, id: 'record-2' }),
    (ErrorData) => ErrorData.code === 'DUPLICATE_REPLAY',
  );
});

test('Worker rejects wrong origins, large bodies and rate-limited submissions before validation', async () => {
  const Environment = {
    ALLOWED_ORIGIN: 'https://southers.github.io',
    DB: new FakeD1Database(),
    SUBMISSION_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const WrongOriginResponse = await Worker.fetch(new Request(
    'https://scores.example/api/leaderboard',
    { method: 'POST', headers: { origin: 'https://attacker.example' } },
  ), Environment);
  assert.equal(WrongOriginResponse.status, 403);

  const LargeResponse = await Worker.fetch(new Request(
    'https://scores.example/api/leaderboard',
    { method: 'POST', headers: { origin: Environment.ALLOWED_ORIGIN, 'content-length': '12001' } },
  ), Environment);
  assert.equal(LargeResponse.status, 413);

  const StreamedLargeResponse = await Worker.fetch(new Request(
    'https://scores.example/api/leaderboard',
    {
      method: 'POST',
      headers: { origin: Environment.ALLOWED_ORIGIN },
      body: 'x'.repeat(12001),
    },
  ), Environment);
  assert.equal(StreamedLargeResponse.status, 413);

  Environment.SUBMISSION_RATE_LIMITER.limit = async () => ({ success: false });
  const LimitedResponse = await Worker.fetch(new Request(
    'https://scores.example/api/leaderboard',
    { method: 'POST', headers: { origin: Environment.ALLOWED_ORIGIN } },
  ), Environment);
  assert.equal(LimitedResponse.status, 429);
});

test('Worker accepts a valid replay through the D1 service boundary', async () => {
  const Database = new FakeD1Database();
  const Environment = {
    ALLOWED_ORIGIN: 'https://southers.github.io',
    DB: Database,
    SUBMISSION_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const ResponseData = await Worker.fetch(new Request(
    'https://scores.example/api/leaderboard',
    {
      method: 'POST',
      headers: {
        origin: Environment.ALLOWED_ORIGIN,
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.10',
      },
      body: JSON.stringify({ callsign: 'ACE', replay: VerifiedReplay }),
    },
  ), Environment);

  assert.equal(ResponseData.status, 201);
  const Result = await ResponseData.json();
  assert.equal(Result.entry.score, 11650);
  assert.equal(Result.entry.launchesUsed, 6);
  assert.equal(Result.entry.replay, undefined);
  assert.equal(Database.records.length, 1);
  assert.equal(Database.records[0].callsign, 'ACE');
  assert.equal(Database.records[0].replay_digest.length, 64);
});
