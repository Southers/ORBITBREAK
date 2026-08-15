# ORBITBREAK Release Brief

This is the canonical release-preparation document. It keeps public copy, capture requirements,
quality gates and external-action approvals separate from implementation work.

## Store copy

**Title:** ORBITBREAK

**Tagline:** Break orbit. Break isolation. Connect the tiny worlds.

**Short description:** Fly a forbidden courier ship between tiny occupied worlds. Bend through gravity, build resilient relay circuits and break the Warden's moving Command World.

**Long description:**

The Stillness has locked living worlds inside silent orbital cages. You are the Runner: one tiny rebel astronaut, a forbidden courier ship and a route nobody else can fly.

Walk around miniature worlds to choose a launch point, pull back and release—or aim entirely by keyboard—then spend one deterministic Breaker Burn in flight. Safe landings awaken distinct little societies, bank your score and become new launch points. Close planetary passes earn Assist, Deep and Razor bonuses; threading distinct worlds in one flight multiplies the chain. Miss the landing or strike a moving hazard and every unbanked point from that shot is gone.

Every successful route leaves a relay behind. Close two unique circuits before the pursuing Warden reaches an unprotected world: the first network pushes it back and the second tears open its iron crown. Intercept the moving Command World, circle to its exposed lattice and fire the final Pulse. Runs are short, deterministic and built for immediate replay. The safe route completes the system; deliberate surface position, timing and deeper gravity lines build the strongest score.

**Feature bullets:**

- One dense six-world sector with distinct route choices and a complete Warden arc.
- Deterministic 120 Hz gravity shared by live flight and trajectory prediction.
- Tiny cultures that visibly awaken, trade, resist suppression and answer the final Pulse.
- Resilient relay circuits, a pursuing Warden and a moving Command World finale.
- Bonus-fuel score attacks with fast miss recovery, transparent banking and Warden-arrival failure.
- Assist, Deep and Razor slingshots plus distinct-body chain multipliers.
- Mouse, pen, touch and complete keyboard play, plus persistent reduced-motion controls.
- Versioned replays that independently re-simulate every verified result and an optional local-best route ghost.
- Procedural Three.js art, animation and Web Audio with no downloaded asset pack.

## Controls copy

- Pointer/touch: trace around a world to walk; pull backwards from the Runner and release to launch; tap Burn once in flight.
- Keyboard: Q/E walks; left/right or A/D steers; up/down or W/S sets power; Shift enables fine control; Enter/Space launches; Space Burns in flight; Escape cancels.
- C toggles Scout view; wheel, plus/minus or the visible zoom buttons adjust it. G toggles the verified local-best ghost when available.
- R resets the attempt. M toggles audio. P cycles System, Reduced and Full motion. Footer buttons provide the same actions on touch screens.

## Media capture plan

Capture clean game frames without browser chrome, debug overlays or disposable tuning parameters.

1. **Hero, 16:9:** Breaker's Reach during the high Ember → Grove slingshot, with the Runner, partial trajectory, scanner, UNBANKED score and chain feedback all readable.
2. **Liberation, 16:9:** a world halfway through the spherical colour wave while the Stillness cage visibly breaks.
3. **Moving route, 16:9:** Verdant Caravan with Pollen Moon, Crown and the changing trajectory in one composition.
4. **Mastery, 16:9:** Long Night or Worldheart during a two-body chain with both score callouts visible.
5. **Finale, 16:9:** the opened iron crown, final Command Pulse and pooled response before the results dialog covers the scene.
6. **Results, 16:9:** a Verified score with breakdown, constellation and earned emblem visible.
7. **Portrait, 9:16:** live 390×844 play showing the scanner, route label, aim meter and reachable touch controls.

Suggested 40-second trailer beat sheet:

- 0–4s: title and eight-launch premise.
- 4–11s: drag, partial prediction and first landing.
- 11–18s: Razor pass and chain score.
- 18–24s: Stillness cage breaking under liberation.
- 24–31s: moving moon or Sentinel timing decision.
- 31–37s: Command World intercept, circumference approach and final Pulse.
- 37–40s: Verified result, tagline and platform URL.

## Automated gates

- `npm test`
- `npm run check`
- `npm run release:audit`
- `npm run leaderboard:benchmark`
- Cloudflare Worker dry run from `server/README.md` before any approved deployment.

## Manual release checklist

- Complete the safe and mastery Breaker's Reach routes; smoke-test archived authored systems as compatibility fixtures.
- Verify pointer, touch and keyboard aim; surface walking; Scout zoom; Burn; landing; hazard/void recovery; zero-bonus-fuel continuation; Warden catch; Reset; audio, ghost and replay.
- Verify desktop, 390×844 portrait and 844×390 landscape without overflow.
- Verify System, Reduced and Full motion modes, including local persistence and unchanged ranked state.
- On a local `?diagnostics=1` build, start aiming and press Shift+B; confirm the aim cancels without launching and play resumes.
- On the same local diagnostic build, press Shift+G; confirm WebGL loss is reported, restored and rendering resumes.
- Press Shift+F on that local build; confirm the pixel-ratio cap degrades one step and restores one step without changing score or launches.
- Confirm draw calls remain under the 190-call ceiling.
- Confirm the Breakers Board says offline when no endpoint is configured.
- Re-run credits review after every asset, font, shader, sound or capture is added.
- Record the final commit SHA, public build URL, leaderboard endpoint status and rules/version used for release.

## Current local candidate evidence

- Build `20260815-ob66` passes 157 deterministic tests, syntax checks, the five-system release audit and the 200-run validator benchmark.
- A complete desktop Breaker's Reach route reached both circuits, the moving Command World and a verified 12,250 result at 176/190 peak draw calls.
- A fresh 390×844 route reached the same verified ending at 174/190, with no overflow and all visible controls at least 44px high.
- 844×390 and 390×844 resize/orientation changes publish the correct layout and 1.5 device-pixel-ratio cap.
- Explicit reduced motion preserves the deterministic Haven-to-Ember launch and landing.
- Local-only diagnostics prove background aim cancellation/resume, WebGL loss/restoration and adaptive-quality degradation/recovery.
- Breaker's Reach results use authored Command, Solidarity and Wayfinder emblems and report bonus fuel without presenting zero as a failure condition.
- The selected sector ends with replay and ranking actions; four archived authored systems remain direct-query compatibility fixtures and pass startup smoke checks.
- Keyboard aim uses the shared fixed-step predictor to suggest a bounded lead on the exposed moving Command World, with direct-aim fallback and unchanged ranked inputs.
- Every fresh run opens with the Warden's `TRAVEL IS FORBIDDEN · SILENCE KEEPS YOU SAFE` broadcast over the route coach; desktop and 390×844 portrait then delivered Ember's first answer without overflow or blocked controls.
- The third relay now answers with the Warden's defining `CONNECTION IS DISORDER · MOVEMENT IS DISOBEDIENCE` broadcast while the complete second answer, target and four-flight forecast remain readable beneath it.
- Grove's `We thought we were alone` answer now remains in the same instruction as the Warden's target and four-flight arrival forecast instead of being overwritten by it.
- Once that first network branches, Grove now explains that closing the Haven circuit requires walking its far rim and aiming back around Ember; it also identifies Haven as deliberately beyond the ranked preview, so `LONG ARC` reads as a commitment rather than a failed prediction.
- After Haven expands to Frost, the live coach now promotes both valid closures—direct Ember or alternate-arc Grove—and explains that either second gold loop exposes Command instead of hiding the objective behind unrelated suggestions.
- The composite Warden panel and transient story/status toast are polite atomic live regions, so assistive technology receives each complete update rather than a changed fragment.
- The Command approach now states `A network cannot be imprisoned`; its final Pulse reveals `WARDEN NODE DISCONNECTED · SECTOR WARDENS: 11`, and the verified result carries the authored reminder that the worlds were never alone.
- Hostile surface guidance now names the current shortest `Q` or `E` direction in both visible copy and the accessible Pulse control; a fresh 390×844 Command approach reached Pulse range in seven prompted steps.
- A verified result now labels its own run score separately from a stronger stored personal best, preventing the prominent record badge from contradicting the score and breakdown beside it.
- Critical route and story instructions now use 12px type, stronger contrast and an explicit 1.35 line height; the release audit protects that readability floor.
- New-world prediction badges name the destination as a target—such as `EMBER TARGET`—instead of reusing `LOCKED`, the story's word for Warden imprisonment.
- Permanent relay links now pulse within a brighter 70–90% opacity range, keeping the cyan network and protected gold circuits readable at portrait scale without extra draw calls.
- The permanent masthead now says `connect the tiny worlds` in legible desktop type, placing the jam theme and the player’s core action above the opening diorama instead of relying on the internal `Stillness` term.
- Suggested-world labels now preserve a 76px centre gap when their projected positions converge, keeping both authored route choices readable after surface repositioning in short landscape without moving their worlds or camera.
- At short landscape heights the 148×52 Breaker control moves to the right safe edge, clearing the central flight corridor while portrait and desktop retain their centred placement.
- Verified results use a compact 760px-wide short-landscape layout with a single sticky three-action row and internal scroll fallback, keeping focused actions visible without changing desktop or portrait results.
- Offline candidates label the final action `Rankings offline` before the explanatory board opens; configured builds retain the shorter `Rankings` label.
- Terminal results centre their unpaired rankings action at desktop and portrait sizes while preserving the short-landscape three-action row.
- Verified replay progress is a 10px atomic polite status, so assistive technology receives each complete launch-count update rather than a changed fragment.
- Warden state and target forecasts retain a 10px single-line floor, keeping the pursuit's critical pressure and destination cues legible on portrait mobile.
- Command World progress is an atomic polite status, keeping the objective label attached to relay, exposure, core-lock and liberation updates for assistive technology.
- Scout zoom announces its current percentage to touch and keyboard users, exposes that level in both button names, and marks only the reached limit unavailable without dropping focus.
- Leaving an active Scout view announces `Scout view off`; already-off control paths remain silent instead of producing redundant feedback.
- Audio button and `M` shortcut use one tested presentation path and publish the same atomic `AUDIO ON/OFF` confirmation.
- Explicit Reduced motion holds relay luminance at the same readable 80% midpoint instead of continuously pulsing it.
- Final Pulse publication now reports `defeated` and `command-world-disabled`, matching the visible Warden panel and verified result without mutating authoritative pursuit state.
- Two-ring world contours and Haven's three-blade grass tufts preserve their silhouettes in one draw call each, restoring headroom during fast liberation and Command transitions.
- These checks do not approve a public deployment, production leaderboard or jam submission.

## Known gated items

- The user-approved public playtest is live at `https://southers.github.io/ORBITBREAK/`; build `20260814-ob13` was verified from main commit `af7958a` on 14 August 2026.
- The production leaderboard has not been deployed; production Worker CPU traces and D1 latency remain unmeasured.
- Final screenshots, trailer footage and the Open Graph share image must be captured from the approved candidate commit.
- Final platform rules, deadline, categories and page fields must be rechecked against the live submission site.
- Final physical-device coverage remains a release-candidate gate; desktop and emulated mobile resilience checks are recorded in `JAM_PLAN.md`.

## External-action approval boundary

Never perform these without the user explicitly confirming the exact action at that moment:

- [x] Create the current GitHub Pages playtest (approved 14 August 2026). Any future deployment mutation still requires confirmation at that moment.
- [ ] Create or deploy production leaderboard resources.
- [ ] Press Submit, Publish, Enter or the platform-equivalent final action.
- [ ] Publish a marketing post, trailer or announcement.

Preparing copy, captures, checks and an entry draft does not satisfy or bypass any checkbox above.
