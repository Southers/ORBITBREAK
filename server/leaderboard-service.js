import { validateSerializedReplay } from '../src/replay-validator.js';

const MaximumLeaderboardLimit = 50;
const BlockedCallsignFragments = [
  'FUCK', 'SHIT', 'CUNT', 'NAZI', 'RAPE', 'NIGG',
];

export function normalizeCallsign(Value) {
  if (typeof Value !== 'string') {
    throw new Error('Callsign must be text.');
  }
  const Callsign = Value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,11}$/.test(Callsign)) {
    throw new Error('Callsign must be 3–12 letters, numbers, underscores or hyphens.');
  }
  if (BlockedCallsignFragments.some((Fragment) => Callsign.includes(Fragment))) {
    throw new Error('Callsign is not available.');
  }
  return Callsign;
}

export function compareLeaderboardEntries(First, Second) {
  return (Second.score - First.score)
    || (First.launchesUsed - Second.launchesUsed)
    || (First.flightTimeMilliseconds - Second.flightTimeMilliseconds)
    || (First.createdAt.localeCompare(Second.createdAt))
    || (First.id.localeCompare(Second.id));
}

/** Small deterministic store used in tests and local development only. */
export function createInMemoryLeaderboardStore() {
  const Records = [];
  return {
    async hasReplay(SerializedReplay) {
      return Records.some((Record) => Record.replay === SerializedReplay);
    },
    async insert(Record) {
      Records.push({ ...Record });
      return { ...Record };
    },
    async list(SystemIdentifier, ContentVersion, Limit) {
      return Records
        .filter((Record) => (
          Record.systemIdentifier === SystemIdentifier
          && Record.contentVersion === ContentVersion
        ))
        .sort(compareLeaderboardEntries)
        .slice(0, Limit)
        .map((Record) => ({ ...Record }));
    },
    async getById(Identifier) {
      const Record = Records.find((Candidate) => Candidate.id === Identifier);
      return Record ? { ...Record } : null;
    },
  };
}

function publicEntry(Record) {
  const { replay, ...PublicRecord } = Record;
  return PublicRecord;
}

export function createLeaderboardService({
  store,
  now = () => new Date(),
  createIdentifier = () => crypto.randomUUID(),
}) {
  if (!store) {
    throw new Error('Leaderboard store is required.');
  }
  return {
    async submit({ callsign, replay }) {
      const Callsign = normalizeCallsign(callsign);
      const Validation = validateSerializedReplay(replay);
      if (!Validation.valid) {
        return { accepted: false, status: 422, error: Validation.reason };
      }
      if (await store.hasReplay(replay)) {
        return { accepted: false, status: 409, error: 'Replay was already submitted.' };
      }
      const Result = Validation.result;
      const Record = {
        id: createIdentifier(),
        callsign: Callsign,
        systemIdentifier: Result.systemIdentifier,
        contentVersion: Result.contentVersion,
        score: Result.score,
        launchesUsed: Result.launchesUsed,
        flightTimeMilliseconds: Result.flightTimeMilliseconds,
        slingshotScore: Result.slingshotScore,
        networkScore: Result.networkScore,
        victoryScore: Result.victoryScore,
        collectedStardustCount: Result.collectedStardustCount,
        replay,
        createdAt: now().toISOString(),
      };
      let SavedRecord;
      try {
        SavedRecord = await store.insert(Record);
      } catch (CaughtError) {
        if (CaughtError?.code === 'DUPLICATE_REPLAY') {
          return { accepted: false, status: 409, error: 'Replay was already submitted.' };
        }
        throw CaughtError;
      }
      const RankedRecords = await store.list(
        Result.systemIdentifier,
        Result.contentVersion,
        MaximumLeaderboardLimit,
      );
      const Rank = RankedRecords.findIndex((Entry) => Entry.id === SavedRecord.id) + 1;
      return {
        accepted: true,
        status: 201,
        entry: publicEntry(SavedRecord),
        rank: Rank || null,
      };
    },

    async list({ systemIdentifier, contentVersion, limit = 20 }) {
      if (typeof systemIdentifier !== 'string' || typeof contentVersion !== 'string') {
        throw new Error('System and content version are required.');
      }
      const SafeLimit = Math.max(1, Math.min(
        MaximumLeaderboardLimit,
        Number.isInteger(limit) ? limit : 20,
      ));
      const Records = await store.list(systemIdentifier, contentVersion, SafeLimit);
      return Records.map(publicEntry);
    },

    async getReplay(Identifier) {
      if (typeof Identifier !== 'string' || Identifier.length < 1 || Identifier.length > 96) {
        return null;
      }
      const Record = await store.getById(Identifier);
      return Record ? {
        id: Record.id,
        callsign: Record.callsign,
        replay: Record.replay,
      } : null;
    },
  };
}

function jsonResponse(Body, Status, CorsHeaders) {
  return new Response(JSON.stringify(Body), {
    status: Status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...CorsHeaders,
    },
  });
}

/** Fetch-standard HTTP boundary suitable for a Worker or edge-function adapter. */
export function createLeaderboardRequestHandler({ service, allowedOrigin }) {
  const CorsHeaders = {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
  return async function handleRequest(RequestData) {
    if (RequestData.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CorsHeaders });
    }
    const Url = new URL(RequestData.url);
    try {
      if (RequestData.method === 'POST' && Url.pathname === '/api/leaderboard') {
        const Body = await RequestData.json();
        const Submission = await service.submit(Body);
        return jsonResponse(Submission, Submission.status, CorsHeaders);
      }
      if (RequestData.method === 'GET' && Url.pathname === '/api/leaderboard') {
        const Entries = await service.list({
          systemIdentifier: Url.searchParams.get('system'),
          contentVersion: Url.searchParams.get('content'),
          limit: Number.parseInt(Url.searchParams.get('limit') ?? '20', 10),
        });
        return jsonResponse({ entries: Entries }, 200, CorsHeaders);
      }
      if (RequestData.method === 'GET' && Url.pathname.startsWith('/api/replays/')) {
        const Replay = await service.getReplay(decodeURIComponent(
          Url.pathname.slice('/api/replays/'.length),
        ));
        return Replay
          ? jsonResponse(Replay, 200, CorsHeaders)
          : jsonResponse({ error: 'Replay not found.' }, 404, CorsHeaders);
      }
      return jsonResponse({ error: 'Not found.' }, 404, CorsHeaders);
    } catch (CaughtError) {
      return jsonResponse({
        error: CaughtError instanceof Error ? CaughtError.message : 'Request failed.',
      }, 400, CorsHeaders);
    }
  };
}
