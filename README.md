# ORBITBREAK

**Break orbit. Break the Stillness. Bank the run.**

ORBITBREAK is a developing Three.js gravity score-attack game. Guide a tiny rebel astronaut across authored miniature systems, chain close planetary slingshots, liberate optional worlds for points and reach the Command World before a fixed launch budget expires.

The safe route completes the system. The dangerous route reaches the leaderboard.

## Current checkpoint

This repository has separated from WORLDSEED. Its deterministic fixed-step physics, authored-content pipeline, miniature rendering and one-pointer controls are preserved while the new game is built in small playable checkpoints.

Milestone 1 now replaces the seed marker with a procedural tiny astronaut and gives every authored system an eight-launch run budget. Every released shot spends one launch, including misses; the eighth shot is allowed to finish, succeeds at the Command World and otherwise triggers a short, automatic system restart. The default shell, objective and completion copy now establish the Runner and Stillness premise.

The planets and most chapter content remain the inherited WORLDSEED migration fixture while ORBITBREAK's slingshot scoring and first large system replace them. They should not be mistaken for the finished score-attack loop.

The locked target is deliberately small:

- one tiny astronaut controlled with drag and release — implemented;
- eight launches to reach the Command World — implemented;
- accurate but partial ranked trajectory prediction;
- deterministic slingshot points, close-pass tiers and multi-body chains;
- optional high-value occupied planets;
- score banking only on system completion;
- one large authored vertical-slice system;
- local personal bests before any validated online leaderboard.

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
