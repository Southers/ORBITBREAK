# ORBITBREAK

**Break orbit. Break isolation. Connect the tiny worlds.**

ORBITBREAK is a Three.js orbital adventure and score attack. You are a tiny rebel astronaut flying a forbidden courier ship between miniature worlds that an authoritarian Warden has forced into silence. Build relay links, turn isolated dioramas into a living trade network and defeat the Warden before it suppresses everything behind you.

**[Play the current GitHub Pages build](https://southers.github.io/ORBITBREAK/)**

## Current playable build

The public build is three dense Warden sectors. **Breaker's Reach** opens: scout, walk the rim, grab the ship to aim, slingshot, **Break** in flight, land, watch worlds wake, then outrun the Warden. A verified victory continues into **Shatterbelt**, then **Verdant Caravan**. Each sector uses the same loop: inner neighbourhood, further landing, hunt, gold circuits, moving Command Cut. Aiming frames the neighbourhood on a brighter map; pinch, wheel or the zoom buttons go from a close world to the whole authored sector. Haven, Ember and Grove are the Reach inner neighbourhood. Completing that cluster recedes the stillness veil; landing a further world reveals the Warden. Gold circuits protect, push pursuit back and crack Command's shields. After the first live link, Ember (and Kiln / Lantern in later sectors) keeps one leftover tooth to teach **Cut**; Bastion, Vault, Nest and Command still use the full cage. After the first loop, a gold ghost marks the next closing edge. Command lock is the finale gift once both shields crack. Bonus fuel is not a fail timer. Only a defeated Warden banks a ranked run. Local personal-best ghosts are optional; the public Breakers Board stays offline until a production endpoint is deliberately approved.

Living worlds grow houses, workshops and docks. Trade hulls pause at the pier. Story boards wait for the wrapping wave, then pause. Tide, Frost and Bastion speak on first link. After Command is cut, the Reach answers before the score card.

The target is three dense authored Warden sectors rather than an infinite universe or a larger but shallower campaign. Long Night and Worldheart remain query-only fixtures. See `DESIGN.md` for the locked game, including the Alive Tiny Worlds plan for prosperity, scale and a hopeful act before the Warden, and `JAM_PLAN.md` for the gated implementation order.

## Why Tiny Worlds matters

Every planet is a small self-contained society. The Warden keeps those societies weak by preventing travel and communication. The player's routes physically join them: lights return, inhabitants emerge and tiny ships begin carrying messages and goods between worlds. When the Warden cuts a route, that life visibly disappears; when the network becomes resilient, the worlds resist together.

## Run locally

The pinned Three.js ESM runtime is vendored, so no package installation is required to play. Serve the repository rather than opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Validate

```bash
npm test
npm run check
npm run lint
npm run typecheck
npm run release:audit
```

Optional: `npm run test:boot` loads the playable shell in headless Chromium, and `npm run leaderboard:benchmark` times the golden replay validator. `npm ci` is only needed for those tooling scripts.

## Current development controls

- Drag the ship to aim and release away from it to launch. Drag back onto the ship, or press `Escape`, to cancel without spending the flight.
- Drag the current world's disk (not the ship) to walk the circumference; `Q`/`E` remain the keyboard walk.
- Drag empty space to pan. Pinch or mouse wheel to zoom. Plus/minus keys and the on-screen zoom buttons still work. `C` snaps the camera back to the Runner.
- Press `G` or tap Ghost to show or hide the verified local personal-best route while scouting or flying.
- During flight, drag from the ship to **break** your line in any direction, then release to fire. Tap Break or press `Space` to break along heading.
- On Bastion or Command, drag from the ship through a clamp to cut it. A longer drag can take more than one. Drag back onto the ship, or press `Escape`, to cancel.
- Focus the game and use left/right or `A`/`D` to steer.
- Use up/down or `W`/`S` to adjust power; hold `Shift` for fine control.
- Press `Q`/`E` to walk around the current world. Press `Enter` or `Space` to launch; `Escape` cancels aiming or a cut.
- `R` resets the run, `M` toggles audio and `P` cycles motion preference.

## Project guide

- `AGENTS.md` defines the implementation charter, invariants and scope boundaries.
- `DESIGN.md` locks the story, core loop, Warden, network, score and ending.
- `JAM_PLAN.md` defines milestone order, exit gates, cut rules and the post-milestone judging gauntlet.
- `RELEASE.md` contains current release evidence and approval boundaries.
- `SECURITY.md` describes the public GitHub Pages surface and undeployed leaderboard boundary.
- `ARCHITECTURE.md` maps module layers, the host-object pattern and enforced boundaries.
- `src/content.js` contains the authored-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and approved playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
