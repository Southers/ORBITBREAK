# ORBITBREAK

**Break orbit. Break the Stillness. Bank the run.**

ORBITBREAK is a developing Three.js gravity score-attack game. Guide a tiny rebel astronaut across authored miniature systems, chain close planetary slingshots, liberate optional worlds for points and reach the Command World before a fixed launch budget expires.

The safe route completes the system. The dangerous route reaches the leaderboard.

## Current checkpoint

This repository has separated from WORLDSEED. Its deterministic fixed-step physics, authored-content pipeline, miniature rendering and one-pointer controls are preserved while the new game is built in small playable checkpoints.

Milestones 1–5 now establish the complete vertical-slice loop. A procedural tiny astronaut has eight launches; every release spends one, including misses, and the eighth flight is allowed to finish. The exact ranked prediction ends after 1.33 seconds, so longer routes demand judgement. Passing into and back out of a planet's influence band earns Assist, Deep or Razor points, distinct planets build a chain and the same body scores only once per flight. A safe landing banks the visible at-risk score; a miss or asteroid impact loses it. Liberating an optional world and reaching the Command World add clear bonuses.

Breaker's Reach is now the default ORBITBREAK vertical slice: six worlds span several camera views, a compact scanner keeps distant routes readable, and offscreen labels point toward authored choices. A four-launch low route reaches the Command World with room for recovery; the high opening bends around Ember and Grove before Tide for a much larger bank. The later campaign chapters remain inherited WORLDSEED migration fixtures and should not be mistaken for finished ORBITBREAK content.

Completed runs now show exactly how many points came from slingshots, liberated worlds and unused launches, plus deterministic airborne time. Ranked personal bests persist locally per system/content version and compare score, launches, then flight time. Run again is the primary results action.

Occupied worlds now carry an unmistakable Stillness control grid and orbital cage. Landing breaks the cage under the spherical liberation wave, restores the world's colour and motion, and reveals a concise story memory. The Runner braces while aiming, flies under twin thrusters, celebrates a liberation and visibly tumbles on recovery; the animation never changes deterministic physics.

The leaderboard foundation now records each attempt as a compact deterministic replay: versioned fixed-step launch timing, origin and exact velocity only. Completed payloads persist locally; they do not trust or contain the displayed score. A DOM-free validator rebuilds the authored system, re-simulates those inputs and derives every result field independently. Only an exact match receives Verified and may update the local personal best. Verified routes can be watched immediately through the live simulation from the result screen. The same validation contract must run server-side before any future online score is accepted.

A provider-neutral leaderboard service contract now covers constrained callsigns, validated submission, locked ranking, top-list reads and on-demand replay fetches. Its in-memory store is test-only: no external service or public board exists until a durable provider, abuse limits and deployment are deliberately configured.

The locked target is deliberately small:

- one tiny astronaut controlled with drag and release — implemented;
- eight launches to reach the Command World — implemented;
- accurate but partial ranked trajectory prediction — implemented;
- deterministic slingshot points, close-pass tiers and multi-body chains — implemented;
- optional high-value occupied planets — implemented in Breaker's Reach;
- safe-landing banking with miss rollback — implemented;
- one large authored vertical-slice system — implemented as Breaker's Reach;
- transparent results and versioned local personal bests — implemented;
- distinct occupation, Runner and liberation presentation — implemented;
- compact versioned replay recording — implemented;
- independent replay validation and verified local results — implemented;
- verified local replay viewing — implemented;
- the smallest viable validated online service — next.

See `DESIGN.md` for the complete rules and `JAM_PLAN.md` for implementation order.

## Run locally

The pinned Three.js ESM runtime is vendored, so no package installation or third-party CDN is required. Serve the repository rather than opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Validate

```bash
npm test
npm run check
```

## Controls in the migration fixture

- Drag backwards from the glowing player marker and release to launch.
- `R` resets the run.
- `M` toggles audio.
- The footer buttons provide the same actions on touch devices.

## Project guide

- `AGENTS.md` defines scope, priorities and quality gates.
- `DESIGN.md` locks the gameplay loop, scoring and leaderboard contract.
- `JAM_PLAN.md` defines milestone order and cut rules.
- `src/content.js` contains the inherited authored-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
