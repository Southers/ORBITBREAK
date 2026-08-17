# ORBITBREAK Architecture

This document maps the module layout after the architecture-hardening pass, explains the
boundaries the tooling enforces, and records the extraction pattern used to keep
`src/main.js` a thin orchestration shell. Read `DESIGN.md` for what the game is;
read this for how the code is arranged.

## Layer map

Dependencies point downward only. A module may import from its own layer or any layer
below it, never above.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Orchestration          src/main.js                                   │
│   wiring, fixed-step loop, resetGame, Warden resolution, listeners   │
├──────────────────────────────────────────────────────────────────────┤
│ Browser shell          hud, story-director, aim-preview,             │
│   (DOM/window/Three)   landing-director, camera-controller,          │
│                        input-controller, hostile-surface, scanner,   │
│                        route-presentation, records-ui, frame-visuals,│
│                        restoration-visuals,                          │
│                        environment, world-geometry,                  │
│                        living-world-visuals, warden-visuals,         │
│                        player-visuals, audio, leaderboard-client,    │
│                        preferences, performance                      │
├──────────────────────────────────────────────────────────────────────┤
│ Presentation rules     src/presentation.js                           │
│   pure functions: layout bounds, coach copy, pose/stage selection    │
├──────────────────────────────────────────────────────────────────────┤
│ Ranked simulation      physics, sim-constants, controls, encounter,  │
│   (framework-free)     scoring, run, network, warden, campaign,      │
│                        sector, restoration, flight-resolver, replay, │
│                        replay-playback, replay-validator, ghost,     │
│                        records, content, content/**                  │
└──────────────────────────────────────────────────────────────────────┘
```

Servers (`server/`) reuse the ranked-simulation layer directly: the Cloudflare
leaderboard worker re-simulates submitted replays with the same modules the browser
runs, which is what makes online scores honest.

### Ranked simulation (bottom layer)

Everything that affects a ranked result lives here and is framework-free: no `three`,
no `document`, no `window`, no imports from `presentation.js` or the shell. ESLint
enforces this (see “Enforced boundaries”).

- `sim-constants.js` — the deterministic contract: `FixedPhysicsStepHertz = 120` and
  shared radii. Live flight, aim prediction, replay playback and server-side
  validation all run this one fixed step.
- `physics.js` — velocity integration, gravity, collision and trajectory prediction.
- `flight-resolver.js` — the shared per-step flight resolver used by the live loop,
  the replay validator and the golden-fixture tests.
- `controls.js`, `encounter.js` — deterministic input shaping (drag→velocity, keyboard
  aim, surface walking) and the hostile-clamp Destroy model.
- `run.js`, `scoring.js`, `network.js`, `warden.js`, `campaign.js`, `sector.js`,
  `restoration.js` — run budget, slingshot/liberation/circuit scoring, relay graph,
  Warden pursuit state machine, route/emblem rules, cluster rules, restoration wave
  math.
- `replay.js`, `replay-playback.js`, `replay-validator.js`, `ghost.js`, `records.js` —
  input-only replay recording, playback injection, full re-simulation validation,
  ghost waypoints and personal-best persistence rules.
- `content.js` + `content/schema.js` + `content/runtime.js` + `content/systems/*` —
  authored systems validated by a schema and instantiated into a mutable runtime.

### Presentation rules

`presentation.js` is pure data-in/data-out: label collision bounds, coach copy
selection, Runner pose/form curves, prosperity stages, camera framing parameters.
It may be imported by the shell and by `main.js`, never by the ranked simulation.

### Browser shell

Each shell module is either a scene factory (builds meshes once, returns handles and
an update/reset API) or a controller created with the host-object pattern described
below. The current controllers and their single responsibilities:

| Module | Owns |
| --- | --- |
| `hud.js` | Fuel lights, first-run captions, toasts, live region, dataset diagnostic contract |
| `story-director.js` | Opening briefing, queued story boards, reveal-hold ordering |
| `aim-preview.js` | Fixed-step aim preview and slingshot band visuals |
| `input-controller.js` | Pointer/keyboard/pinch gestures, Destroy and Breaker Burn intents |
| `camera-controller.js` | Sector planning camera, Scout zoom, live follow |
| `landing-director.js` | Landing/liberation presentation, attach VFX, finale pulse |
| `hostile-surface.js` | Destroy preview/guide, clamp pylons, encounter lifecycle, surface walking |
| `scanner.js` | Diagnostic spatial projection and accessible snapshot strings |
| `route-presentation.js` | Route choices, target beacons, aim/scout route and tactical labels |
| `records-ui.js` | Personal best, route ghost, victory summary, leaderboard panel, replay watching |
| `frame-visuals.js` | Per-frame stardust, biome motion, trail, Runner/ship pose |
| `restoration-visuals.js` | Liberation wave, staged growth, range veil, restoration-complete moment |
| `environment.js`, `world-geometry.js`, `living-world-visuals.js`, `warden-visuals.js`, `player-visuals.js` | Scene factories for lighting, worlds, inhabitants/trade, Warden, Runner |

### Orchestration (`src/main.js`)

What deliberately remains in `main.js`:

- module wiring: DOM lookups, scene setup, factory instantiation and host objects;
- the fixed-step simulation driver (`simulateSeedFixedStep`), replay injection and
  flight settling — the code that decides what happened;
- Warden resolution after resolved flights and the world-restoration state machine
  (`updateWorldRestorationVisuals` triggers phase transitions, victory and encounters);
- `resetGame`, the frame loop, performance budget, event listeners and preferences.

This is the code whose job is sequencing between systems; extracting it would only
move the coupling somewhere less visible.

## The host-object pattern

Controllers are factories: `createX(THREE, host)` (or `createX(host)` when Three.js
is not needed). The host is an object literal built in `main.js` that exposes exactly
what the module may touch. Rules learned the hard way:

1. **Reassigned `let`s cross the boundary as accessors.** Define `get`/`set` pairs on
   the host; inside the module read `host.X` at call time. Never destructure an
   accessor into a local — it freezes the value at factory time.
2. **Stable `const`s and function declarations are destructured once** at the top of
   the factory for readability and speed.
3. **Late-bound wrappers break initialisation cycles.** If a host entry refers to a
   `const` that is created later in `main.js` (for example a function destructured
   from a controller created further down), wrap it:
   `updateBreakerBurnInterface: (...Args) => updateBreakerBurnInterface(...Args)`.
   Function *declarations* are hoisted and can be referenced directly.
4. **Never `Object.assign` a host** — it evaluates getters once and drops setters.
5. **Placement matters.** A factory call must appear after every plain `const` it
   references and before the first host object that references its destructured
   results. Keep the destructuring next to the factory call so call sites stay
   unchanged.

Module-internal state that nothing else reads (for example the scanner’s projection
bounds or the trail-particle ring index) moves into the module as private variables
instead of host accessors.

## Enforced boundaries

- `eslint.config.js` defines `BrowserShellFiles` (the only modules allowed to use
  `document`, `window` or import `three`) and `RankedSimulationFiles` (additionally
  forbidden from importing `presentation.js`, `audio.js` or `main.js`).
  `npm run lint` checks every file under `src/`.
- `npm run typecheck` runs `tsc` with `checkJs` over the project.
- `npm run check` syntax-checks every shipped module; new modules must be added to it.
- `npm test` includes golden replay fixtures (`tests/fixtures/*.v2.json`): the
  Breaker’s Reach completion replay must re-derive its exact banked score through the
  shared resolver. Any drift in the ranked layer fails the suite.
- `npm run release:audit` (also run inside `npm test`) asserts string-level contracts
  against specific source files. It is rename-hostile by design: **when moving code
  between modules, update the corresponding `readRepositoryFile` source and
  `requireCondition` references in `server/release-audit.js`.**
- `npm run test:boot` boots `index.html` headlessly and fails on any console error —
  the fastest way to catch a broken host wiring or TDZ mistake.

## Determinism contract

One simulation, three consumers:

- **Live flight** advances `FixedPhysicsStepSeconds` at 120 Hz inside
  `simulateSeedFixedStep`, accumulating real time and stepping deterministically.
- **Prediction** (aim preview, committed trajectory) calls `predictTrajectory` with
  the same step and the same body set (`getActiveTacticalBodyDefinitions`).
- **Replay** records inputs only (launch velocity + burn step) and replays them
  through the same resolver; `replay-validator.js` re-simulates a full run headlessly
  and is what the leaderboard worker executes server-side.

Anything that could bifurcate these paths (new forces, new collision rules, new
pickup logic) belongs in the ranked layer and must flow through
`flight-resolver.js`, never be added to the shell.

## Adding or moving code

1. Decide the layer. If it changes a ranked result, it goes below the line and stays
   framework-free. If it draws or narrates, it is shell.
2. For a new shell controller, follow the host-object pattern above and instantiate
   it in `main.js` at a position that satisfies rule 5.
3. Add the file to the `check` script in `package.json`; the lint glob picks up
   `src/**` automatically, but a DOM/Three-using module must be listed in
   `BrowserShellFiles`.
4. Update `server/release-audit.js` for any moved audit-tracked strings.
5. Run the full gate: `npm test`, `npm run check`, `npm run lint`,
   `npm run typecheck`, `npm run release:audit`, `npm run test:boot` — then play the
   affected loop at desktop and portrait-mobile aspect ratios per `AGENTS.md`.
