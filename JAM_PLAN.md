# ORBITBREAK Development Plan

This plan deliberately proves one competitive system before adding a campaign. The final external Submit, Publish or announcement action always remains user-controlled.

## Milestone 0 — Clean foundation

- Preserve WORLDSEED unchanged in its original repository.
- Import only its playable deterministic engine, tests and vendored runtime.
- Replace the project charter, design, roadmap, README and credits.
- Remove inherited submission media and release-specific scripts.
- Rebrand the development shell while clearly labelling the inherited content as a migration fixture.

Exit: ORBITBREAK has an independent repository, coherent scope and a passing playable baseline.

## Milestone 1 — Runner and launch pressure

- Replace the seed representation and language with a readable tiny Runner.
- Add an authored eight-launch budget.
- Consume one launch for every released shot.
- Fail and quickly restart the system when the budget reaches zero before completion.
- Make reaching the Command World bank and finish the attempt.

Exit: failure has an immediate, understandable cost and the system has a clear end.

Checkpoint: implemented with a procedural helmeted Runner that preserves the proven collision radius, an authored eight-launch budget across all five migration systems, one-launch-per-release consumption, last-flight settlement, Command World completion and a clear exhausted-run reset. Pure run-state tests cover launch use, ordinary settlement, exhaustion, final-launch completion and invalid transitions. Desktop and portrait-mobile browser passes verify the Runner/HUD, successful landing, miss recovery, eight-shot failure and automatic fresh-run reset with clean consoles.

## Milestone 2 — Skill and scoring

- Limit ranked prediction to an accurate initial segment.
- Detect enter/exit slingshots through deterministic body influence bands.
- Add authored values, deep-pass tiers and distinct-body chain multipliers.
- Bank a flight chain only on safe landing and roll it back on failure.
- Prevent the same body from scoring more than once per flight.
- Add optional occupied-world liberation points.

Exit: repeating the same route with better judgement can produce a meaningfully better score.

Checkpoint: implemented with a 1.33-second exact ranked preview, deterministic enter/exit influence bands, Assist/Deep/Razor tiers, authored body values, distinct-body chain multipliers, safe-landing banking, miss/hazard rollback, occupied-world bonuses and unused-launch completion points. Same-body anti-farming and prediction/live sampling share one scoring contract. Landing precision remains deferred until the large-system target zones exist. Pure scoring/content tests cover band entry and exit, depth tiers, chaining, anti-farming, banking, rollback, completion and invalid authored values. Desktop browser play verifies a 1,350-point Ember Razor Assist banked with Tide liberation for 2,350 total, plus a two-body 2,500-point chain visibly lost to the Void; portrait mobile verifies the score HUD and a real one-pointer landing. Browser consoles are clean.

## Milestone 3 — Large-system vertical slice

- Build one multi-viewport authored system with six to eight meaningful bodies.
- Provide a conservative completion route.
- Provide at least one riskier route with a materially higher score ceiling.
- Include a living anchor, optional occupied worlds, a high-value gravity body, a Void threat and the Command World.
- Add camera framing and a compact scanner suitable for desktop and portrait mobile.

Exit: a playtester can explore, complete, understand why they lost and identify a route worth replaying.

Checkpoint: implemented as Breaker's Reach, the new default arena. Six worlds span more than 35 world units and are framed through a Runner-following exploration camera, compact live scanner and clamped offscreen route labels. The low route has a deterministic four-launch completion and an opening Haven→Ember shot that resolves inside the ranked preview. The high opening stays deliberately unresolved, threads authored Ember and Grove assists, and can bank 2,550 slingshot points plus Tide's 1,000 liberation bonus. Deterministic tests cover the safe opening, high-score chain and complete four-launch route. A full desktop browser run completed Haven → Ember → Grove → Tide → Command in four launches for 7,000 points, including the 4,000 unused-launch bonus. Portrait mobile verified a real exact-preview landing. Both aspect ratios verify camera tracking, scanner movement, edge labels, HUD separation, render budget and clean consoles.

## Milestone 4 — Results and local competition

- Show a transparent score breakdown.
- Record local personal bests by system and content version.
- Rank by score, then launches, then accumulated flight time.
- Label practice assists and exclude them from ranked results.
- Add immediate replay and clean reset flows.

Exit: the vertical slice supports repeatable score attack without an online service.

Checkpoint: implemented with a transparent slingshot/liberation/unused-launch breakdown, deterministic airborne flight time, explicit ranked state and content-versioned local personal bests. Ranking compares score, then launches used, then flight time; corrupt storage fails closed and worse runs never replace a better result. The primary completion action is now Run again, with campaign continuation secondary. Pure tests cover ranking, persistence, version isolation and corrupt data. Desktop browser play saved a new 7,000-point best with a 0 + 3,000 + 4,000 breakdown, replayed immediately with the best retained, and correctly treated an identical second completion as non-record. The 390×844 results layout fits without scrolling, preserves focus and has a clean console.

## Milestone 5 — Liberation presentation

- Replace inherited WORLDSEED content and Worldheart language.
- Give the Runner readable launch, flight, landing and failure animation.
- Turn the restoration wave into a distinct liberation event.
- Add concise Stillness occupation and liberation story lines.
- Tune sound, camera, feedback and mobile presentation around scoring.

Exit: the game looks and sounds like ORBITBREAK rather than a renamed prototype.

## Milestone 6 — Validated online leaderboard

- Record compact deterministic replays with content and physics versions.
- Build a validator that reruns launches and derives the score independently.
- Submit only validated completed runs.
- Add short callsigns, basic moderation constraints and replay viewing.

Exit: online scores are reproducible and materially harder to falsify than client totals.

## Milestone 7 — Authored expansion and release polish

- Add systems only when each introduces a new spatial scoring problem.
- Connect systems with a concise campaign route toward the Stillpoint.
- Profile loading, resizing, orientation changes, backgrounding and WebGL recovery.
- Complete accessibility, credits, public build and release materials.
- Prepare—but do not perform—the final user-controlled submission or announcement.

Exit: ORBITBREAK is cohesive, reliable and ready for the user to decide how and when to release it.

## Validation gate

For every milestone:

1. Run `npm test` and `npm run check`.
2. Play the affected loop at desktop and portrait-mobile aspect ratios.
3. Verify deterministic prediction/live agreement, launch use, landing, miss recovery, reset and completion.
4. Verify scoring changes with deterministic tests and an understandable on-screen breakdown.
5. Keep `main` playable.

## Cut order

Cut campaign breadth, additional systems, online services, daily challenges, secondary story and cosmetic rewards before cutting launch pressure, slingshot skill, score clarity, deterministic physics, mobile reliability or the liberation payoff.
