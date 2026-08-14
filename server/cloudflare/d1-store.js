const PublicColumns = `
  id, callsign, system_identifier, content_version, score, launches_used,
  flight_time_ms, slingshot_score, liberation_score, completion_bonus,
  collected_stardust_count, created_at
`;

async function digestReplay(SerializedReplay) {
  const Digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(SerializedReplay),
  );
  return [...new Uint8Array(Digest)]
    .map((Byte) => Byte.toString(16).padStart(2, '0'))
    .join('');
}

function mapRow(Row) {
  return {
    id: Row.id,
    callsign: Row.callsign,
    systemIdentifier: Row.system_identifier,
    contentVersion: Row.content_version,
    score: Row.score,
    launchesUsed: Row.launches_used,
    flightTimeMilliseconds: Row.flight_time_ms,
    slingshotScore: Row.slingshot_score,
    networkScore: Row.liberation_score,
    victoryScore: Row.completion_bonus,
    collectedStardustCount: Row.collected_stardust_count,
    replay: Row.replay,
    createdAt: Row.created_at,
  };
}

/** Durable adapter for a Cloudflare D1 binding. */
export function createD1LeaderboardStore(Database) {
  if (!Database?.prepare) {
    throw new Error('A D1 database binding is required.');
  }
  return {
    async hasReplay(SerializedReplay) {
      const ReplayDigest = await digestReplay(SerializedReplay);
      const Existing = await Database.prepare(
        'SELECT id FROM leaderboard_entries WHERE replay_digest = ? LIMIT 1',
      ).bind(ReplayDigest).first();
      return Existing !== null;
    },

    async insert(Record) {
      const ReplayDigest = await digestReplay(Record.replay);
      try {
        await Database.prepare(`
          INSERT INTO leaderboard_entries (
            id, callsign, system_identifier, content_version, score, launches_used,
            flight_time_ms, slingshot_score, liberation_score, completion_bonus,
            collected_stardust_count, replay, replay_digest, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          Record.id,
          Record.callsign,
          Record.systemIdentifier,
          Record.contentVersion,
          Record.score,
          Record.launchesUsed,
          Record.flightTimeMilliseconds,
          Record.slingshotScore,
          Record.networkScore,
          Record.victoryScore,
          Record.collectedStardustCount,
          Record.replay,
          ReplayDigest,
          Record.createdAt,
        ).run();
      } catch (CaughtError) {
        if (String(CaughtError?.message).includes('UNIQUE')) {
          const DuplicateError = new Error('Replay was already submitted.');
          DuplicateError.code = 'DUPLICATE_REPLAY';
          throw DuplicateError;
        }
        throw CaughtError;
      }
      return { ...Record };
    },

    async list(SystemIdentifier, ContentVersion, Limit) {
      const Query = await Database.prepare(`
        SELECT ${PublicColumns}
        FROM leaderboard_entries
        WHERE system_identifier = ? AND content_version = ?
        ORDER BY score DESC, launches_used ASC, flight_time_ms ASC, created_at ASC, id ASC
        LIMIT ?
      `).bind(SystemIdentifier, ContentVersion, Limit).all();
      return (Query.results ?? []).map(mapRow);
    },

    async getById(Identifier) {
      const Row = await Database.prepare(`
        SELECT ${PublicColumns}, replay
        FROM leaderboard_entries
        WHERE id = ?
        LIMIT 1
      `).bind(Identifier).first();
      return Row ? mapRow(Row) : null;
    },
  };
}
