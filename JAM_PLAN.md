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

Checkpoint: implemented with a rigid luminous control grid and three-band Stillness cage around every occupied world. The spherical colour wave now visibly breaks that cage, triggers a target-centred flash and stronger camera/audio response, and always resolves into the world's concise liberation memory—even when opening the Command World route. The Runner has distinct braced aim, thruster-led flight, liberation and red recovery poses without changing its physics footprint. Slingshot tiers and chains now receive rising procedural confirmations. Pure presentation tests cover phase priority, poses, cage removal and flash bounds. A complete desktop route again finished Haven → Ember → Grove → Tide → Command in four launches for 7,000 points; the moving liberation frame showed the cage/wave contrast and the finished run retained its full results flow. The 390×844 pass verified exact-preview launch, flight, liberation, miss recovery and reset with no overflow. Peak observed desktop rendering remained below budget at 160 draw calls and the browser console was clean.

## Milestone 6 — Validated online leaderboard

- Record compact deterministic replays with content and physics versions.
- Build a validator that reruns launches and derives the score independently.
- Submit only validated completed runs.
- Add short callsigns, basic moderation constraints and replay viewing.

Exit: online scores are reproducible and materially harder to falsify than client totals.

Checkpoint A — replay capture: implemented as a versioned input-only wire format. Every released shot records its fixed-step index, launch origin and exact velocity; the header binds it to the system, content version, physics model and 120 Hz step. Completed runs persist the payload locally, failed runs remain observable until reset, and neither format contains a client-claimed score. Strict parsing rejects corrupt, oversized, non-monotonic or post-finish inputs. Eight representative shots serialize below 700 bytes. A real four-launch desktop completion produced a 308-byte payload with the expected four origins and retained the 7,000-point result; portrait mobile recorded one launch and cleared it on reset with no overflow or console errors. The independent validator remains the next gate before any service work.

Checkpoint B — offline validation: implemented as a DOM-free re-simulation module built on the same fixed-step physics, collision, campaign, run-budget and scoring helpers. It derives score, breakdown, launch use, flight time and stardust from input alone, rejects version mismatch, forged origins, changed velocities, unfinished routes, exhaustion and post-completion input, and never reads the browser's claimed result. Local personal bests now update only when the derived result exactly matches live play. The real browser-captured four-launch route independently validated at 7,000 points (3,000 liberation + 4,000 unused launches) and 2,842 ms; desktop and 390×844 results both show Verified with clean consoles and no mobile overflow. This proves the validation contract, not a server deployment; transport, callsigns, replay viewing and an online service remain separate decisions.

Checkpoint C — local replay viewing: implemented with a Watch replay action on verified results. Playback resets the system and injects the captured inputs at their original fixed-step times through the live game rather than approximating the path. A visible shot counter distinguishes playback, aiming stays disabled and Reset exits immediately. The browser-captured four-shot route automatically reconstructed every liberation, returned to the Command World at 7,000 and independently verified again; 390×844 results fit all three actions without overflow. Pure tests cover timing, ordered consumption and origin mismatch. Online transport and callsigns remain intentionally unstarted.

Checkpoint D — provider-neutral service contract: implemented without deploying an external service. The Fetch-standard boundary accepts callsign + replay only, independently derives stored results, rejects invalid and duplicate runs, ranks by the locked score/launch/time order, omits replay bytes from list responses and exposes them through a separate watch route. Callsigns are constrained and minimally blocked. HTTP/CORS, forged-total, duplicate, list and replay-fetch behaviour are covered with an in-memory test adapter. A production adapter still requires durable indexes, replay digests, request/rate limits and a chosen host; no account or endpoint has been created.

Checkpoint E — Cloudflare production adapter: prepared locally without creating or deploying an external resource. A Worker wraps the provider-neutral service, rejects wrong origins and oversized declared or streamed bodies, rate-limits submissions before validation, and persists only derived results through a D1 adapter. The migration adds a unique SHA-256 replay digest and an index matching score → launches → flight-time ranking; duplicate races resolve to a safe conflict. Unit coverage exercises the D1 mapping, abuse boundaries and a complete accepted 7,000-point replay. Wrangler 4.123.0 bundles the Worker successfully in dry-run mode. Production CPU measurement, account/database creation and endpoint deployment remain separate gates controlled with the user.

Checkpoint F — in-game leaderboard flow: implemented against an optional endpoint without claiming that a public board exists. Verified live results can open the Breakers Board, enter a constrained callsign, submit the replay-only payload, read score → launches → flight-time rankings and fetch any listed route into the existing verified live playback. Remote routes cannot expose the submission form after playback. Without an endpoint the same panel explicitly reports offline and preserves the local best. A loopback-only in-memory server and local query override support browser testing without weakening production configuration. A real 7,000-point four-launch run banked, rendered two ranked rows at 390×844 and replayed a fetched route through all four launches back to a verified 7,000-point finish; desktop and mobile panels stayed within their viewports with clean diagnostics. Production CPU proof and user-approved resource creation/deployment remain the final Milestone 6 gates.

Checkpoint G — local CPU gate: a reproducible Node V8 benchmark now warms the exact server validator 20 times and measures 200 complete four-launch re-simulations. The development machine recorded 0.17 ms mean, 0.28 ms p95 and 0.58 ms maximum against the Workers Free 10 ms allowance, while the bundled Worker remains 19.27 KB gzip. That is strong local headroom but not production proof: real Worker traces and D1 latency still require an approved external deployment. No account resource or endpoint was created.

## Milestone 7 — Authored expansion and release polish

- Add systems only when each introduces a new spatial scoring problem.
- Connect systems with a concise campaign route toward the Worldheart.
- Profile loading, resizing, orientation changes, backgrounding and WebGL recovery.
- Complete accessibility, credits, public build and release materials.
- Prepare—but do not perform—the final user-controlled submission or announcement.

Exit: ORBITBREAK is cohesive, reliable and ready for the user to decide how and when to release it.

Checkpoint A — Shatterbelt authored-system conversion: the inherited Broken Belt fixture is now a wide timing-focused system with six named worlds, one tactical Seedstone, a moving Sentinel and a Command World. A dependable Relay → Kiln → Drift → Vault route completes in four launches for 7,700. The higher Relay → Loom route collects all three Stardust, waits for the Sentinel window and earns a 2,400-point Deep Assist around Shard before converging on Drift and Vault for 10,400. Deterministic tests cover both complete routes, the opening choices, Stardust collection and blocked/open Sentinel timing with prediction/live collision-step agreement. Real desktop play completed and independently verified both scores; 390×844 play completed the safe route, verified miss recovery and Reset, fit the result panel without scrolling and stayed within the 39-draw-call peak. No new external assets were introduced. The remaining inherited systems are still migration fixtures.

Checkpoint B — Verdant Caravan authored-system conversion: Wandering Garden is now a wide moving-launch-node arena rather than another compact migration layout. The reliable Bower → Lantern → Nest → Dew road completes in four launches for 7,400. The alternate opening collects all three Stardust at Canopy, intercepts Pollen Moon at its live orbital phase and spends that moving launchpad on Crown via Nest's influence band. A normal live Assist completed and independently verified at 8,300; the deterministic Razor line earns 2,400 slingshot points and reaches 9,900. Tests cover both complete routes, the moving-body collision step, three-Stardust opening and route choices. Desktop play verified the safe and arbitrary-phase moon routes with clean diagnostics. At 390×844 the centred four-shot road verified at 7,400, an edge-angle miss recovered correctly, the result fit without scrolling and the peak remained within 41 draw calls. No external assets were added. Long Night and Worldheart remain migration fixtures.

Checkpoint C — Long Night authored-system conversion: the former compact fixture is now a wide chain-mastery arena. The forgiving Vigil → Pyre → Lumen → Umbra route completes in four launches for 7,600. The alternate opening collects all three Stardust at Hollow, then a 56%-power flight extends to 442 fixed steps beyond the ranked preview, exits Lumen at Razor depth and Beacon with the distinct-body multiplier, and banks 4,350 only on reaching Umbra. Beacon adds a final assist on the verified 14,850 mastery run. Deterministic tests cover both complete routes, exact two-event order and values, hidden-arc length and live/prediction landing-step agreement. Desktop play exposed and corrected an overly brittle Umbra landing basin before verifying both scores. At 390×844 the safe route verified at 7,600, the result fit without scrolling, a void miss recovered, Reset restored eight launches and the peak stayed within 40 draw calls with no warnings or errors. No external assets were added. Worldheart remains the final migration fixture.

Checkpoint D — Worldheart authored finale: the last migration fixture is now a wide recombination arena that pays off the campaign without adding a new subsystem. The reliable Confluence → Kindle → Chorus → Dawn road bends around Starwell and reaches the unlocked core in four launches for 9,200. The alternate Memory opening collects all three Stardust, intercepts the moving one-use Memory Moon, converts a long partial-preview flight into a 4,700-point Chorus → Starwell chain, then routes Dawn → Starwell → core with a final Dawn deep pass for a robust 14,600. Deterministic tests cover both complete routes, moving-body prediction/live collision-step agreement, exact chain order and values, Arc collection and core unlocking. Desktop and 390×844 browser runs completed and independently verified the 9,200 road; portrait replay reproduced all four launches and the same result. The mobile result fits exactly within 390×844, Reset restores eight launches, a void miss recovers to Confluence, the finale renders in 21 draw calls and the console has no warnings or errors. No external assets were added; all five campaign systems are now authored ORBITBREAK content.

Checkpoint E — keyboard and focus accessibility: focused canvas play now exposes full ranked aiming without changing the pointer contract. Left/right or A/D steer in 2° steps, up/down or W/S adjust power in 4% steps, Shift provides 0.5°/1% fine control, Enter or Space launches and Escape cancels without consuming a launch. The keyboard path reuses the live trajectory predictor and the exact pointer release path, so launch use, physics, scoring and replay validation remain shared. Results and rankings contain Tab and Shift+Tab focus, rankings restore focus on Escape, and hidden instructions describe every key. Pure tests cover aim initialization, wrapping, fine steering, power bounds and drag-vector conversion. A desktop keyboard-only Breaker's Reach run reached the Command World and independently verified at 6,000 after a Wayfarer timing miss; pointer input still landed on Ember at the expected velocity. At 390×844, touch and keyboard aim both retained landing locks with no overflow; live rotation to 844×390 preserved the active aim and resizing state, rendering stayed inside the 190-call budget and the console remained clean. Existing OS reduced-motion handling, background aim cancellation, adaptive pixel ratio and WebGL recovery remain in place. No external assets were added.

Checkpoint F — release-preparation gate: `npm run release:audit` now fails closed on missing local HTML assets, remote runtime dependencies, mismatched build identifiers, incomplete metadata, a broken five-system campaign, migration content versions, malformed authored content, missing credits or removed approval boundaries. A procedural orbit-mark SVG supplies the local favicon, and `RELEASE.md` centralises accurate platform copy, controls, capture beats, automated/manual checks, known gated items and four unchecked user-approval actions. The refreshed README describes the complete campaign rather than the old migration checkpoint. The audit passes for build `20260814-ob11`, all 105 tests and syntax checks pass, and the validator benchmark remains below 1 ms maximum across 200 local runs. Desktop and 390×844 startup sweeps loaded all five campaign systems at eight launches with no overflow, stayed below the 190-call render ceiling and produced no warnings or errors. No public build, production service, platform entry, capture upload or announcement was created.

## Validation gate

For every milestone:

1. Run `npm test` and `npm run check`.
2. Play the affected loop at desktop and portrait-mobile aspect ratios.
3. Verify deterministic prediction/live agreement, launch use, landing, miss recovery, reset and completion.
4. Verify scoring changes with deterministic tests and an understandable on-screen breakdown.
5. Keep `main` playable.

## Cut order

Cut campaign breadth, additional systems, online services, daily challenges, secondary story and cosmetic rewards before cutting launch pressure, slingshot skill, score clarity, deterministic physics, mobile reliability or the liberation payoff.
