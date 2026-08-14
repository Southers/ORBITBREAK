# ORBITBREAK Release Brief

This is the canonical release-preparation document. It keeps public copy, capture requirements,
quality gates and external-action approvals separate from implementation work.

## Store copy

**Title:** ORBITBREAK

**Tagline:** Break orbit. Break the Stillness. Bank the run.

**Short description:** Guide a tiny rebel astronaut through handcrafted planetary systems. Bend through gravity, chain dangerous slingshots, build two resilient circuits and break the Warden's moving Command World.

**Long description:**

The Stillness has locked living worlds inside silent orbital cages. You are the Runner: one tiny astronaut, eight launches and a route nobody else can fly.

Drag and release—or aim entirely by keyboard—to cross five handcrafted miniature systems. Safe landings bank your score and become new launch points. Close planetary passes earn Assist, Deep and Razor bonuses; threading distinct worlds in one flight multiplies the chain. Miss the landing or strike a moving hazard and every unbanked point from that shot is gone.

Each chapter changes the spatial problem without changing the rules: choose a risky opening, time a moving Sentinel, intercept an orbiting moon, commit to a trajectory beyond the ranked preview and finally recombine every lesson at the Worldheart. Runs are short, deterministic and built for immediate replay. The safe route completes the system. The dangerous route reaches the leaderboard.

**Feature bullets:**

- Five authored planetary systems with distinct routing challenges.
- Deterministic 120 Hz gravity shared by live flight and trajectory prediction.
- Bonus-fuel score attacks with fast miss recovery, transparent banking and Warden-arrival failure.
- Assist, Deep and Razor slingshots plus distinct-body chain multipliers.
- Mouse, pen, touch and complete keyboard play using the same ranked rules.
- Versioned replays that independently re-simulate every verified result.
- Procedural Three.js art, animation and Web Audio with no downloaded asset pack.

## Controls copy

- Pointer/touch: drag backwards from the Runner and release.
- Keyboard: left/right or A/D steer; up/down or W/S set power; Shift enables fine control; Enter/Space launches; Escape cancels.
- R resets the attempt. M toggles audio. P cycles System, Reduced and Full motion. Footer buttons provide the same actions on touch screens.

## Media capture plan

Capture clean game frames without browser chrome, debug overlays or disposable tuning parameters.

1. **Hero, 16:9:** Breaker's Reach during the high Ember → Grove slingshot, with the Runner, partial trajectory, scanner, UNBANKED score and chain feedback all readable.
2. **Liberation, 16:9:** a world halfway through the spherical colour wave while the Stillness cage visibly breaks.
3. **Moving route, 16:9:** Verdant Caravan with Pollen Moon, Crown and the changing trajectory in one composition.
4. **Mastery, 16:9:** Long Night or Worldheart during a two-body chain with both score callouts visible.
5. **Finale, 16:9:** the Worldheart restoration before the results dialog covers the scene.
6. **Results, 16:9:** a Verified score with breakdown, constellation and earned emblem visible.
7. **Portrait, 9:16:** live 390×844 play showing the scanner, route label, aim meter and reachable touch controls.

Suggested 40-second trailer beat sheet:

- 0–4s: title and eight-launch premise.
- 4–11s: drag, partial prediction and first landing.
- 11–18s: Razor pass and chain score.
- 18–24s: Stillness cage breaking under liberation.
- 24–31s: moving moon or Sentinel timing decision.
- 31–37s: Worldheart approach and restoration.
- 37–40s: Verified result, tagline and platform URL.

## Automated gates

- `npm test`
- `npm run check`
- `npm run release:audit`
- `npm run leaderboard:benchmark`
- Cloudflare Worker dry run from `server/README.md` before any approved deployment.

## Manual release checklist

- Complete the safe and mastery route for every authored system on the candidate commit.
- Verify pointer, touch and keyboard aim; landing; hazard/void recovery; eight-launch failure; Reset; audio and replay.
- Verify desktop, 390×844 portrait and 844×390 landscape without overflow.
- Verify System, Reduced and Full motion modes, including local persistence and unchanged ranked state.
- On a local `?diagnostics=1` build, start aiming and press Shift+B; confirm the aim cancels without launching and play resumes.
- On the same local diagnostic build, press Shift+G; confirm WebGL loss is reported, restored and rendering resumes.
- Press Shift+F on that local build; confirm the pixel-ratio cap degrades one step and restores one step without changing score or launches.
- Confirm draw calls remain under the 190-call ceiling.
- Confirm the Breakers Board says offline when no endpoint is configured.
- Re-run credits review after every asset, font, shader, sound or capture is added.
- Record the final commit SHA, public build URL, leaderboard endpoint status and rules/version used for release.

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
