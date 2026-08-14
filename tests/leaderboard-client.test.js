import test from 'node:test';
import assert from 'node:assert/strict';

import { createLeaderboardClient } from '../src/leaderboard-client.js';

test('leaderboard client stays explicitly offline without an endpoint', async () => {
  const Client = createLeaderboardClient({ fetch: async () => assert.fail('fetch should not run') });
  assert.equal(Client.configured, false);
  await assert.rejects(
    () => Client.list({ systemIdentifier: 'breaker-reach', contentVersion: 'breaker-reach-3' }),
    /not connected/,
  );
});

test('leaderboard client lists, submits and fetches replays through the contract', async () => {
  const Requests = [];
  const Client = createLeaderboardClient({
    baseUrl: 'https://scores.example/',
    fetch: async (Input, Init) => {
      const Url = new URL(Input);
      Requests.push({ url: Url, init: Init });
      if (Url.pathname.startsWith('/api/replays/')) {
        return Response.json({ id: 'record/1', callsign: 'ACE', replay: '{"v":1}' });
      }
      if (Init.method === 'POST') {
        return Response.json({ accepted: true, rank: 1 }, { status: 201 });
      }
      return Response.json({ entries: [{ id: 'record/1', callsign: 'ACE', score: 7000 }] });
    },
  });

  assert.equal(Client.configured, true);
  assert.equal((await Client.list({
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-3',
    limit: 5,
  }))[0].score, 7000);
  assert.equal((await Client.submit({ callsign: 'ace', replay: '{"v":1}' })).rank, 1);
  assert.equal((await Client.getReplay('record/1')).callsign, 'ACE');

  assert.equal(Requests[0].url.searchParams.get('system'), 'breaker-reach');
  assert.equal(Requests[0].url.searchParams.get('content'), 'breaker-reach-3');
  assert.deepEqual(JSON.parse(Requests[1].init.body), { callsign: 'ace', replay: '{"v":1}' });
  assert.equal(Requests[2].url.pathname, '/api/replays/record%2F1');
});

test('leaderboard client preserves useful server errors and rejects unsafe endpoints', async () => {
  assert.throws(
    () => createLeaderboardClient({ baseUrl: 'http://scores.example', fetch: async () => {} }),
    /HTTPS/,
  );
  const Client = createLeaderboardClient({
    baseUrl: 'https://scores.example',
    fetch: async () => Response.json({ error: 'Replay was already submitted.' }, { status: 409 }),
  });
  await assert.rejects(
    () => Client.submit({ callsign: 'ACE', replay: '{}' }),
    /already submitted/,
  );
});
