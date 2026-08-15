# ORBITBREAK

**Break orbit. Break isolation. Connect the tiny worlds.**

ORBITBREAK is a Three.js orbital adventure and score attack. You are a tiny rebel astronaut flying a forbidden courier ship between miniature worlds that an authoritarian Warden has forced into silence. Build relay links, turn isolated dioramas into a living trade network and defeat the Warden before it suppresses everything behind you.

**[Play the current GitHub Pages build](https://southers.github.io/ORBITBREAK/)**

## Current playable build

The public build is the proven score-attack foundation, not yet the locked Warden redesign. It currently offers five authored systems, eight-launch runs, deterministic slingshot scoring, occupied-world liberation, local personal bests and verified replay playback.

The current development slice keeps the proven gravity and scoring loop while adding limited surface repositioning, a launch-planning camera that zooms out to the whole Reach so slingshot chains are visible before release, and one deterministic mid-flight Breaker Burn. Successful world-to-world landings now leave a luminous relay link, an answering message and a tiny courier travelling between the connected societies. Restored worlds populate with tiny inhabitants whose local walking rhythms differ by culture and respect reduced-motion settings. The third active relay reveals the Warden at the sector edge; its vulnerable target and remaining resolved-flight distance stay visible while scouting remains safe. Its iron-crown citadel, paired shield moons and red arrival/suppression pulses give that pursuit a distinct miniature-world silhouette. Each occupied culture also carries an authored pattern of red signal clamps—furnace teeth, root staples, ice drills, tide gates or watch batteries—that collapses through the liberation wave. On arrival the Warden visibly suppresses that frontier, restores its clamps, removes its inhabitants and halts its routes and trade; landing there again restores the original non-farmable connection. Returning across a new edge can close a gold resilient circuit, protect its worlds, push pursuit back and break one of the Warden's two visible shield layers. Breaker's Reach is the selected six-world sector; its mastery line now includes one brief Bastion surface barrier solved by walking to red pylons and firing a contextual Breaker Pulse. The eight-launch reserve is bonus fuel rather than a failure timer: it can reach zero while the run continues, and the ranked run instead ends when the Warden reaches the Runner on an unprotected target world. Two unique circuits now open the crown into a gold moving Command World; landing banks the final flight, then a short circumference approach and contextual Pulse break its core lattice before the replay-verified result is accepted. Disabling the lattice sends a short pooled response from the cooled core back across the restored worlds while their inhabitants celebrate. Ranked results separate **Flight** slingshots, **Network** liberation and first-circuit value, and **Victory** value from remaining Warden pursuit distance. The independent validator derives the same relay and Warden state from the input-only replay before accepting any score. A verified local personal best also supplies an optional dashed Scout/flight ghost made only from launch origins, so it reveals a route without revealing the aim solution.

The target is deliberately one dense authored sector rather than an infinite universe or a larger but shallower campaign. See `DESIGN.md` for the locked game, including the Alive Tiny Worlds plan for prosperity, scale and a hopeful act before the Warden, and `JAM_PLAN.md` for the gated implementation order.

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

- Drag the ship to aim and release away from it to launch. Drag back onto the ship, or press `Escape`, to cancel without spending the flight.
- Drag the current world's disk (not the ship) to walk the circumference; `Q`/`E` remain the keyboard walk.
- Drag empty space to pan. Pinch or mouse wheel to zoom. Plus/minus keys and the on-screen zoom buttons still work. `C` snaps the camera back to the Runner.
- Press `G` or tap Ghost to show or hide the verified local personal-best route while scouting or flying.
- During flight, drag from the ship to aim Breaker Burn in any direction, then release to fire. Tap the Burn button or press `Space` to Burn along heading.
- Focus the game and use left/right or `A`/`D` to steer.
- Use up/down or `W`/`S` to adjust power; hold `Shift` for fine control.
- Press `Q`/`E` to walk around the current world; hostile surface encounters name the shortest key toward their pylons. Press `Enter` or `Space` to launch; `Escape` cancels keyboard aiming.
- `R` resets the run, `M` toggles audio and `P` cycles motion preference.

## Project guide

- `AGENTS.md` defines the implementation charter, invariants and scope boundaries.
- `DESIGN.md` locks the story, core loop, Warden, network, score and ending.
- `JAM_PLAN.md` defines milestone order, exit gates, cut rules and the post-milestone judging gauntlet.
- `RELEASE.md` contains current release evidence and approval boundaries.
- `src/content.js` contains the authored-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and approved playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
