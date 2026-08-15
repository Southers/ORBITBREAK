# ORBITBREAK

**Break orbit. Break isolation. Connect the tiny worlds.**

ORBITBREAK is a Three.js orbital adventure and score attack. You are a tiny rebel astronaut flying a forbidden courier ship between miniature worlds that an authoritarian Warden has forced into silence. Build relay links, turn isolated dioramas into a living trade network and defeat the Warden before it suppresses everything behind you.

**[Play the current GitHub Pages build](https://southers.github.io/ORBITBREAK/)**

## Current playable build

The public GitHub Pages build at [southers.github.io/ORBITBREAK](https://southers.github.io/ORBITBREAK/) tracks `main`. It is the complete Breaker's Reach Warden sector, not the older eight-launch score-attack prototype.

Play the locked loop: walk the current world's rim, launch, spend one Breaker Burn, land to create a relay, outrun a telegraphed Warden and close two unique circuits to board the moving Command World. Ranked results separate **Flight** slingshots, **Network** liberation and first-circuit value, and **Victory** value from remaining pursuit distance. An independent validator re-simulates the input-only replay before accepting a score. A verified local personal best can supply an optional dashed Scout/flight ghost made only from launch origins, so it reveals a route without revealing the aim solution. The online leaderboard stays offline until a production service is separately approved.

Restored worlds populate with tiny inhabitants whose local walking rhythms differ by culture and respect reduced-motion settings. Occupation scars, couriers and suppression are visible on the miniature worlds themselves. Shatterbelt, Verdant Caravan, Long Night and Worldheart remain direct-query compatibility fixtures.

The target is deliberately one dense authored sector rather than an infinite universe or a larger but shallower campaign. See `DESIGN.md` for the locked game, `JAM_PLAN.md` for the gated implementation order and `SECURITY.md` for the public-surface review.

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

## Current development controls

- Trace tangentially around the current world to reposition the Runner; pull radially away and release to launch.
- Drag empty space to pan Scout view. Use the wheel, plus/minus keys or the on-screen zoom buttons to zoom; press `C` or tap Scout/Runner to toggle and snap back.
- Press `G` or tap Ghost to show or hide the verified local personal-best route while scouting or flying.
- Tap the Breaker Burn button once during flight, or press `Space`, to spend the flight's deterministic correction.
- Focus the game and use left/right or `A`/`D` to steer.
- Use up/down or `W`/`S` to adjust power; hold `Shift` for fine control.
- Press `Q`/`E` to walk around the current world; hostile surface encounters name the shortest key toward their pylons. Press `Enter` or `Space` to launch; `Escape` cancels keyboard aiming.
- `R` resets the run, `M` toggles audio and `P` cycles motion preference.

## Project guide

- `AGENTS.md` defines the implementation charter, invariants and scope boundaries.
- `DESIGN.md` locks the story, core loop, Warden, network, score and ending.
- `JAM_PLAN.md` defines milestone order, exit gates, cut rules and the post-milestone judging gauntlet.
- `RELEASE.md` contains current release evidence and approval boundaries.
- `SECURITY.md` describes the public playtest surface and what remains undeployed.
- `src/content.js` contains the authored-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and approved playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
