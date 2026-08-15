# Leaderboard service boundary

`leaderboard-service.js` is a provider-neutral, Fetch-standard API contract. It does not deploy or persist anything by itself.

## Routes

- `POST /api/leaderboard` with `{ "callsign": "RUNNER_7", "replay": "..." }`
- `GET /api/leaderboard?system=breaker-reach&content=breaker-reach-4&limit=20`
- `GET /api/replays/:id`
- `OPTIONS` for the configured GitHub Pages origin

The submit route discards any claimed score, validates and re-simulates the replay, reconstructs its relay circuits and Warden pursuit state, then stores only the independently derived Flight, Network, Victory and ranking result. The public list omits replay payloads; a replay is fetched separately when a player chooses to watch it.

## Cloudflare production candidate

`cloudflare/worker.js` is the prepared production adapter. It runs the same validator inside a Cloudflare Worker, persists independently derived results in D1 and adds the first abuse boundaries before validation:

- GitHub Pages origin allow-listing on every mutating request, including POSTs with no Origin header;
- a 12 KB declared and streamed request-body limit around the stricter 8 KB replay limit;
- six submission attempts per source IP per minute through a Workers rate-limit binding;
- SHA-256 replay digests backed by a D1 unique constraint;
- a composite D1 index matching the locked ranking order.

No Cloudflare account, database, endpoint or deployment has been created. `wrangler.jsonc` deliberately omits `database_id` until the user approves creating that external resource, and `"workers_dev": false` keeps an accidental deploy from publishing a `*.workers.dev` preview URL. Wrangler 4.123.0 successfully bundles the Worker in local `--dry-run` mode at 96.29 KB (19.27 KB gzip).

For local adapter development, Wrangler 4.36 or later is required for rate-limit bindings:

```bash
npx --yes wrangler@4.123.0 d1 migrations apply orbitbreak-leaderboard --local --config server/cloudflare/wrangler.jsonc
npx --yes wrangler@4.123.0 dev --config server/cloudflare/wrangler.jsonc
```

On `localhost` or `127.0.0.1` only, the game accepts `?leaderboardApi=http://127.0.0.1:8787` as a temporary endpoint override. Public builds ignore that query parameter and use only the committed meta configuration.

An approved production setup must first create the D1 database, add the returned `database_id` to `wrangler.jsonc`, apply the migration remotely, measure validation CPU against the Workers Free limit, and only then deploy. Those commands intentionally remain a user-controlled external step.

Provider rationale and current limits: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Production requirements

A provider adapter must implement `hasReplay`, `insert`, `list` and `getById`. Production storage must also provide:

- a unique digest/index for each exact replay to prevent duplicate submissions;
- indexes matching system + content version + score + launches + flight time;
- rate limiting before replay validation to bound CPU abuse;
- request/body limits at least as strict as the 8 KB parser limit;
- configured CORS for `https://southers.github.io` rather than a wildcard;
- retention and deletion controls for callsigns and replay payloads;
- server-generated identifiers and timestamps.

The in-memory adapter exists only for automated tests and local integration. It must never be presented as an online leaderboard. The Cloudflare adapter is still a deployment candidate until its CPU use is measured in the real runtime and the user explicitly approves creating the account resources.

For an intentionally temporary in-memory browser smoke test, run `npm run leaderboard:dev` beside the static server, then add `?leaderboardApi=http://127.0.0.1:8787` to the local game URL. Scores disappear when that process stops.

`npm run leaderboard:benchmark` re-simulates the reference four-launch route 20 times for warmup and 200 measured times. On the development machine's Node V8 runtime it measured 0.17 ms mean and 0.28 ms p95 on 14 August 2026, leaving substantial local headroom beneath the Workers Free 10 ms request CPU allowance. This is a reproducible proxy, not a substitute for production Worker traces after an approved deployment.
