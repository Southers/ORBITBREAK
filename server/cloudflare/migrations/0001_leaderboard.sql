CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  callsign TEXT NOT NULL CHECK (length(callsign) BETWEEN 3 AND 12),
  system_identifier TEXT NOT NULL,
  content_version TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  launches_used INTEGER NOT NULL CHECK (launches_used >= 1),
  flight_time_ms INTEGER NOT NULL CHECK (flight_time_ms >= 0),
  slingshot_score INTEGER NOT NULL CHECK (slingshot_score >= 0),
  liberation_score INTEGER NOT NULL CHECK (liberation_score >= 0),
  completion_bonus INTEGER NOT NULL CHECK (completion_bonus >= 0),
  collected_stardust_count INTEGER NOT NULL CHECK (collected_stardust_count >= 0),
  replay TEXT NOT NULL CHECK (length(replay) <= 8192),
  replay_digest TEXT NOT NULL UNIQUE CHECK (length(replay_digest) = 64),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leaderboard_rank_idx
ON leaderboard_entries (
  system_identifier,
  content_version,
  score DESC,
  launches_used ASC,
  flight_time_ms ASC,
  created_at ASC
);
