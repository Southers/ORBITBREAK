# Leaderboard service boundary

`leaderboard-service.js` is a provider-neutral, Fetch-standard API contract. It does not deploy or persist anything by itself.

## Routes

- `POST /api/leaderboard` with `{ "callsign": "RUNNER_7", "replay": "..." }`
- `GET /api/leaderboard?system=breaker-reach&content=breaker-reach-1&limit=20`
- `GET /api/replays/:id`
- `OPTIONS` for the configured GitHub Pages origin

The submit route discards any claimed score, validates and re-simulates the replay, then stores only the independently derived result. The public list omits replay payloads; a replay is fetched separately when a player chooses to watch it.

## Required production adapter

A provider adapter must implement `hasReplay`, `insert`, `list` and `getById`. Production storage must also provide:

- a unique digest/index for each exact replay to prevent duplicate submissions;
- indexes matching system + content version + score + launches + flight time;
- rate limiting before replay validation to bound CPU abuse;
- request/body limits at least as strict as the 8 KB parser limit;
- configured CORS for `https://southers.github.io` rather than a wildcard;
- retention and deletion controls for callsigns and replay payloads;
- server-generated identifiers and timestamps.

The in-memory adapter exists only for automated tests and local integration. It must never be presented as an online leaderboard.
