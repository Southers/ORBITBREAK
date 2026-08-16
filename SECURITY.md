# ORBITBREAK public-surface security

This is the security note for the playable GitHub Pages game and the undeployed leaderboard adapter. It is not a permission to create production services.

## What is public

Anyone can load [https://southers.github.io/ORBITBREAK/](https://southers.github.io/ORBITBREAK/). That origin serves static HTML, CSS, JavaScript and vendored Three.js from this repository. There is no account system, no cookies, no analytics pixel and no production API.

The live candidate is a client-side simulation. Scores shown in the results panel are local until a verified replay is independently re-simulated. The committed leaderboard meta tag is empty, so the public build cannot submit or fetch online rankings.

## Trust boundary

Treat the browser as untrusted:

- Players can change local storage, personal-best JSON, ghosts and HUD copy. That only affects their machine.
- Ranked online results, when a service is later approved, must ignore claimed scores and re-simulate the input-only replay.
- `?system=` may load authored campaign chapters or leftover compatibility fixtures (`long-night`, `worldheart`, `first-light`). Unknown values fall back to Breaker's Reach.
- `?diagnostics=1` and `?leaderboardApi=` are ignored on the public host. Diagnostics require localhost. A query override may point only at loopback HTTP.

DOM updates use `textContent` and `createElement`. Callsigns are constrained to `A–Z`, `0–9`, underscore and hyphen before storage.

## Current hardening

- Vendored Three.js, no third-party CDN, no remote scripts.
- Fail-closed Content-Security-Policy and `no-referrer` via HTML meta tags, which GitHub Pages honours.
- A Permissions-Policy meta tag documents the intended camera/microphone/geolocation deny-list. GitHub Pages cannot emit that header, and the game never requests those permissions.
- Public `connect-src` allows same-origin plus local loopback only. Enabling a production leaderboard requires a deliberate CSP and meta-tag change.
- Cloudflare adapter POSTs require the allow-listed GitHub Pages origin, 12 KB body limits, IP rate limits and parameterized D1 writes. Unexpected store errors return a generic message.
- `workers_dev` is false so an accidental deploy does not publish a `*.workers.dev` preview URL.
- Replay payloads are capped at 8 KB and 64 launches, with a 15,000-step validation ceiling.

## What is not deployed

The Worker, D1 database and production ranking endpoint do not exist yet. Do not treat `server/cloudflare/` as a live service. Creating those resources remains a user-controlled external action.

If that service is approved later, remaining operator work includes Worker CPU traces, retention/deletion for callsigns and replays, and adding the exact HTTPS origin to both the HTML meta tag and CSP `connect-src`.

## Reporting

Open a GitHub issue or contact the repository owner. Do not file a public issue with secrets. This project has no bug bounty.
