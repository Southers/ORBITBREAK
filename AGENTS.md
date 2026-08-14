# ORBITBREAK Agent Charter

## Objective

Build ORBITBREAK into a focused Three.js score-attack game about a tiny astronaut outrunning an authoritarian force across miniature planetary systems.

Protect the core loop:

> choose a route → launch → bend through gravity → chain slingshots → land or liberate → reach the Command World and bank the run

ORBITBREAK must gain depth from spatial judgement, a strict launch budget and risky score routes—not from layered currencies, upgrades or procedural content.

## Current foundation

The repository begins with the deterministic physics, authored-content pipeline, miniature rendering, one-pointer input and automated tests imported from WORLDSEED. The inherited five-chapter content is a playable migration fixture, not the ORBITBREAK design target.

Do not break the fixture while replacing it in small checkpoints.

## External-action approval boundary

- Development builds and private repository updates are normal development work.
- Keep release materials accurate only after ORBITBREAK has a representative playable build.
- Never perform a final external Submit, Publish, Enter or marketing action without the user's explicit confirmation at that moment.

## Locked game rules

- A ranked system provides an authored fixed launch budget, initially eight.
- Every launch consumes one, including misses.
- The run fails if the budget reaches zero before the Runner reaches the Command World.
- The Command World banks the score; uncompleted runs do not enter ranked results.
- Occupied worlds are optional, authored score destinations.
- A slingshot scores only after the Runner enters and exits a body's scoring band without collision.
- Slingshot value is authored from route difficulty and gravity strength; deeper safe passes pay more.
- Distinct slingshots chained within one flight multiply that flight's value.
- A body scores at most once per flight, preventing orbit farming.
- A successful landing banks the flight chain. A miss loses that flight's unbanked points.
- Ranked prediction is accurate but deliberately short. Any full-preview assist is practice-only and unranked.

## Non-negotiables

- Keep `main` playable at every checkpoint.
- Preserve deterministic fixed-step physics and use the same simulation for live flight and the visible prediction segment.
- Retain one-pointer/touch controls, keyboard reset/mute and fast failure recovery.
- Make scoring events deterministic, legible and reproducible from a compact replay.
- Keep hazards deterministic and clearly represented by trustworthy feedback.
- Prefer large authored systems and deliberate routes over an infinite procedural universe.
- Preserve the planet-wrapping transformation as the signature liberation reward.
- Represent the player as a readable tiny astronaut without sacrificing mobile clarity.
- Add every external asset and licence to `CREDITS.md` before committing it.
- Do not commit secrets, dependency folders, build output or disposable captures.

## Priority order

1. Replace the seed fantasy with the Runner and liberation premise.
2. Prove the eight-launch fail/complete loop.
3. Add deterministic slingshot detection, chaining, banking and anti-farming tests.
4. Build one large authored system with a safe route and a materially harder scoring route.
5. Add an honest results screen and local personal-best leaderboard.
6. Tune partial prediction, landing difficulty and route values through playtesting.
7. Add replay recording and server-side deterministic validation before any online leaderboard.
8. Expand into additional authored systems only after the vertical slice is replayable for score.
9. Polish mobile reliability, performance, accessibility and release presentation.

If work does not strengthen the shot, route gamble, score clarity, completion pressure or liberation payoff, defer it.

## Definition of done

For every meaningful checkpoint:

1. Run `npm test` and `npm run check`.
2. Play the complete affected loop at desktop and portrait-mobile aspect ratios.
3. Verify prediction/live agreement, launch consumption, landing, miss recovery, reset and completion.
4. For scoring work, verify deep/normal passes, distinct-body chains, banking, failed-flight rollback and same-body anti-farming.
5. For route work, verify one safe completion route and one riskier higher-scoring route.
6. Update design documentation and credits when behaviour, story, scope or assets change.
7. Commit one small coherent change while `main` remains playable.

## Scope guardrails

Do not add regression, pursuit meters, fuel systems, walking, combat, inventory, crafting, multiplayer, random infinite worlds, upgrade trees, complex dialogue or sprawling menus before the first score-attack system is proven fun.

