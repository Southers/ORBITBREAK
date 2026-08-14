# ORBITBREAK

**Break orbit. Break isolation. Connect the tiny worlds.**

ORBITBREAK is a Three.js orbital adventure and score attack. You are a tiny rebel astronaut flying a forbidden courier ship between miniature worlds that an authoritarian Warden has forced into silence. Build relay links, turn isolated dioramas into a living trade network and defeat the Warden before it suppresses everything behind you.

**[Play the current GitHub Pages build](https://southers.github.io/ORBITBREAK/)**

## Current playable build

The public build is the proven score-attack foundation, not yet the locked Warden redesign. It currently offers five authored systems, eight-launch runs, deterministic slingshot scoring, occupied-world liberation, local personal bests and verified replay playback.

The next design pass keeps its gravity, replay, rendering and accessibility work while replacing the arbitrary launch budget with visible Warden pursuit. It adds limited surface repositioning, one mid-flight Breaker Burn, relay links, trade traffic, reversible recapture and one orbital final encounter.

The target is deliberately one dense authored sector rather than an infinite universe or a larger but shallower campaign. See `DESIGN.md` for the locked game and `JAM_PLAN.md` for the gated implementation order.

## Why Tiny Worlds matters

Every planet is a small self-contained society. The Warden keeps those societies weak by preventing travel and communication. The player's routes physically join them: lights return, inhabitants emerge and tiny ships begin carrying messages and goods between worlds. When the Warden cuts a route, that life visibly disappears; when the network becomes resilient, the worlds resist together.

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
npm run release:audit
```

## Current controls

- Drag backwards from the Runner and release to launch.
- Focus the game and use left/right or `A`/`D` to steer.
- Use up/down or `W`/`S` to adjust power; hold `Shift` for fine control.
- Press `Enter` or `Space` to launch; `Escape` cancels keyboard aiming.
- `R` resets the run, `M` toggles audio and `P` cycles motion preference.

Surface movement, Scout camera and Breaker Burn are planned and are not represented as live controls until implemented.

## Project guide

- `AGENTS.md` defines the implementation charter, invariants and scope boundaries.
- `DESIGN.md` locks the story, core loop, Warden, network, score and ending.
- `JAM_PLAN.md` defines milestone order, exit gates and cut rules.
- `RELEASE.md` contains current release evidence and approval boundaries.
- `src/content.js` contains the authored-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and approved playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
