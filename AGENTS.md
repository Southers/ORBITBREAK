# ORBITBREAK Agent Charter

## Objective

Build ORBITBREAK into a focused Three.js game about a tiny rebel astronaut reconnecting miniature worlds while a visible authoritarian Warden closes in.

Protect the core loop:

> scout → choose a world → reposition → launch → bend through gravity → act in flight → land → connect or liberate → outrun the Warden

Every major feature should strengthen at least one of three promises: expressive orbital skill, a growing living network, or understandable pursuit pressure.

## Current foundation

The public build is a polished deterministic score-attack prototype with five authored systems, slingshot scoring, replay validation and mobile controls. It is the technical and content foundation, not the locked final design.

Replace it in small playable checkpoints. Preserve working physics, tests and useful authored content while changing story, progression, camera and moment-to-moment play.

## External-action approval boundary

- Updating the existing GitHub Pages playtest after explicit approval is normal development.
- Keep release materials accurate only after the new loop is representative.
- Never perform a final external Submit, Publish, Enter or marketing action without the user's explicit confirmation at that moment.

## Locked design truths

- The Warden isolates worlds because connection creates freedom and disorder it cannot control.
- The Runner uses a forbidden courier ship, the Orbitbreaker, to cross the silence and establish relay links.
- A successful journey visibly changes the system: messages appear, settlements brighten and small trade ships travel between connected worlds.
- The Warden appears after the first hopeful connections and predictably suppresses vulnerable worlds behind the Runner.
- Pursuit advances on resolved flights, not wall-clock time. Scouting and accessibility never create hidden disadvantage.
- Landing links the origin and destination. Closed relay circuits form resilient loops; completing a new circuit pushes the Warden back and weakens its command vessel once per run.
- The run ends by reaching and disabling the Warden's mobile Command World. An unfinished run cannot enter the ranked board.
- Score rewards authored liberations, resilient connections and skilful slingshot chains. It never rewards waiting or same-body orbit farming.
- Ranked routes use the same deterministic fixed-step simulation as live play, prediction and replay validation.
- The story may imply a larger authority or more Wardens only after this sector reaches a complete ending.

## Non-negotiables

- Keep `main` playable at every checkpoint.
- Preserve deterministic fixed-step physics and one shared simulation for live flight, prediction and replay.
- Retain one-pointer/touch accessibility, equivalent keyboard control and fast recovery.
- Add only one new flight verb initially: a single deterministic Breaker Burn per flight.
- Constrain surface movement to the current world's orbital-plane circumference; do not build a free-roaming platform game.
- Make the Runner → launch craft → flight ship → Runner transformation readable without changing the physics identity.
- Telegraph the Warden's next move and every hostile obstacle before it can punish the player.
- Keep surface hostility brief and contextual: pylons, barriers or drones disabled with one Breaker Pulse, never health bars or a second combat game.
- Prefer one dense authored sector over an infinite procedural universe or several shallow chapters.
- Preserve the planet-wrapping liberation effect as the signature reward.
- Add every external asset and licence to `CREDITS.md` before committing it.
- Do not commit secrets, dependency folders, build output or disposable captures.

## Priority order

1. Prove walking/repositioning, transformation and Breaker Burn on one route.
2. Prove relay links, visible trade and deterministic Warden pursuit.
3. Prove that closed relay circuits create a meaningful defend-versus-expand choice.
4. Build one short hostile-world encounter using the same surface and pulse vocabulary.
5. Turn the Warden vessel into an orbital final encounter using established movement and gravity skills.
6. Retune slingshot, liberation, network and victory scoring around the new complete run.
7. Add Scout camera planning and a local personal-best ghost.
8. Raise world detail, inhabitants, trade traffic, sound, story delivery and mobile polish.
9. Prepare release evidence while leaving every external submission action user-controlled.

If work does not improve agency, jeopardy, route choice, visible consequence or the Tiny Worlds fantasy, defer it.

## Definition of done

For every meaningful checkpoint:

1. Run `npm test` and `npm run check`.
2. Play the complete affected loop at desktop and portrait-mobile aspect ratios.
3. Verify prediction/live agreement, landing, miss recovery, reset and any Warden transition.
4. Verify that new choices have distinct, understandable outcomes and no hidden real-time penalty.
5. For ranked work, verify replay determinism, rollback, anti-farming and honest results.
6. Update the existing design documents and credits when behaviour, story, scope or assets change.
7. Commit one small coherent change while `main` remains playable.

## Scope guardrails

Do not add free-surface exploration, health systems, weapon inventories, crafting, random infinite worlds, multiplayer, dialogue trees, permanent stat upgrades or multiple bosses before the one-sector Warden run is fun from beginning to end.

Additional sectors, modules, global ghosts and the larger super-AI are expansion hooks, not requirements for the first complete version.
