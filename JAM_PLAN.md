# ORBITBREAK Milestone Plan

This plan converts the current score-attack foundation into one complete story-driven sector. Each milestone must leave the game playable. The final external Submit, Publish, Enter or announcement action always remains user-controlled.

## Proven foundation

Keep and reuse what already works:

- deterministic 120 Hz gravity shared by play, prediction and replay validation;
- pointer, touch and ranked keyboard aiming;
- slingshot bands, chain scoring, safe-landing banking and anti-farming;
- authored content validation and five systems of reusable world material;
- procedural Runner, occupation cages and planet-wrapping liberation;
- camera tracking, scanner, results, local bests and verified replay playback;
- optional provider-neutral leaderboard code, not deployed;
- adaptive performance, accessibility and desktop/mobile test coverage.

The fixed eight-launch campaign and inherited five-chapter structure are no longer design constraints.

## Milestone 0 — Lock the new north star

- Resolve the Warden's motive, the Runner's role and why relays change the worlds.
- Define pursuit as deterministic flight-driven pressure rather than a wall-clock timer.
- Define how connections, unique resilient circuits, recapture and the final encounter fit one loop.
- Bound surface movement, Breaker Burn and hostile encounters so they add agency without creating another game.
- Rewrite only the existing charter, design, plan and README; preserve credits and implementation history in Git.

Exit: the story, mechanics, score and scope describe one coherent game with no contradictory timer, combat or campaign promises.

## Milestone 1 — Runner agency vertical slice

- Add clockwise/counter-clockwise circumference walking on one current world.
- Make radial launch and tangential walking gestures reliably distinct on mouse and touch.
- Add Scout pan/zoom and a clear snap-to-Runner action.
- Stage Runner → launch craft → ship → Runner as presentation around one unchanged physics body.
- Add one deterministic Breaker Burn per flight and record it in replay inputs.
- Rebuild one short route to require a deliberate launch position and reward a well-timed Burn.

Exit: moving, planning, launching and correcting are enjoyable before pursuit or more content is added.

Stop condition: if walking creates input ambiguity or busywork after focused tuning, reduce it to a fast circumference reposition gesture. Do not expand it into platforming.

## Milestone 2 — Hope, network and pursuit

- Turn successful new landings into permanent visible origin-to-destination relay links.
- Add messages, lights and a small trade ship that prove a live connection changes both worlds.
- Introduce the Warden only after the player has seen the first hopeful exchange.
- Spend the third-relay pursuit beat on its entrance; thereafter advance it once after ordinary resolved flights, while a first circuit closure replaces that move with one step back.
- Let it suppress and visibly darken an exposed frontier world; allow deterministic recapture.
- Make one closed circuit protect its worlds, push the Warden back and remove one shield layer exactly once.

Exit: a three-to-four-world slice creates an understandable expand-versus-reinforce decision, and the first recapture feels consequential rather than arbitrary.

Stop condition: do not add hostile worlds, abilities or more map content until a new player can predict the Warden and explain why the loop protected them.

## Milestone 3 — One complete sector

- Build a dense six-to-nine-world authored sector from the strongest existing content.
- Provide a conservative route, a fragile fast route and a difficult high-score route.
- Add exactly one brief hostile surface encounter using circumference movement and a contextual Breaker Pulse.
- Replace the old launch-budget loss condition with the Warden reaching the Runner.
- Turn the Warden vessel into the mobile Command World.
- Use two unique completed circuits to expose it; finish with a shield-moon slingshot, landing and final Pulse.
- Provide a fast reset and a complete unranked story-mode path if ranked pressure proves too punishing for first-time players.

Exit: the game has a beginning, escalation, reversible setback, final confrontation and ending in one five-to-eight-minute run.

Stop condition: one polished hostile encounter and one boss are sufficient. Do not add weapons, health bars, random encounters or another Warden.

## Milestone 4 — Score attack and ghosts

- Retune the existing score into Flight, Network and Victory categories.
- Preserve deterministic slingshot tiers, distinct-body chains, rollback and anti-farming.
- Award authored liberation values, unique-circuit bonuses and remaining-pursuit victory value.
- Bank ranked results only after the Warden is defeated.
- Update the replay schema and independent validator for walking origin, Burn and Warden state.
- Show the local personal-best route as an optional Scout/flight ghost.
- Keep the public leaderboard offline until production validation and deployment are separately approved.

Exit: safer completion and ambitious leaderboard play are both legitimate, visibly different routes through the same authored sector.

## Milestone 5 — Tiny Worlds story and art pass

- Give every retained planet a distinct miniature culture, terrain silhouette and occupation scar.
- Add readable inhabitants, local motion, relay infrastructure and trade traffic within the render budget.
- Deliver the locked story beats through broadcasts, awakening lines, environmental change and network activity.
- Make the Warden's arrival, suppression and defeat the three strongest non-launch visual beats.
- Improve sound layers, camera transitions, impact, ship transformation and the final collective response.
- Remove or rename inherited content that contradicts the new story.

Exit: screenshots communicate tiny societies, isolation, connection and authoritarian threat without explanatory text.

## Milestone 6 — Reliability and release handoff

- Tune route fairness and score values through repeated fresh-player runs.
- Verify desktop, portrait mobile, resize, orientation, backgrounding, reduced motion and WebGL recovery.
- Run the full deterministic replay, scoring, Warden and content test suite.
- Refresh README, credits, release copy and authentic media to match the final playable build.
- Update the approved GitHub Pages playtest only with explicit approval.
- Prepare the jam reply and hand it to the user; do not post it.

Exit: the build is cohesive, reliable and ready for the user to decide whether and when to submit.

## Validation gate

For every implementation milestone:

1. Run `npm test` and `npm run check`.
2. Play the affected loop at desktop and portrait-mobile aspect ratios.
3. Verify deterministic prediction/live/replay agreement, landing, miss recovery and reset.
4. Verify pursuit targets and transitions are telegraphed and reproducible.
5. Verify a new choice has at least two understandable outcomes.
6. Keep `main` playable and commit one coherent checkpoint.

## Cut order

Cut global ghosts and online services first, then extra world dispositions, secondary story lines, additional trade-ship variety and secondary planets. If necessary, simplify the surface Pulse and shorten the sector.

Never cut control clarity, Breaker Burn, visible network growth, predictable Warden pressure, the first recapture, the orbital finale, deterministic physics, fast recovery, mobile reliability or the liberation wave.
