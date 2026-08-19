# ORBITBREAK Release Brief

This is the canonical release-preparation document. It keeps public copy, capture requirements,
quality gates and external-action approvals separate from implementation work.

## Store copy

**Title:** ORBITBREAK

**Tagline:** Break orbit. Break isolation. Connect the tiny worlds.

**Short description:** Fly a forbidden courier ship between tiny occupied worlds. Bend through gravity, build resilient relay circuits and break the Warden's moving Command World.

**Long description:**

The Stillness has locked living worlds inside silent orbital cages. You are the Runner: one tiny rebel astronaut, a forbidden courier ship and a route nobody else can fly.

Walk around miniature worlds to choose a launch point, pull back and release—or aim entirely by keyboard—then break your line once in flight. Safe landings awaken distinct little societies, bank your score and become new launch points. Close planetary passes earn Assist, Deep and Razor bonuses; threading distinct worlds in one flight multiplies the chain. Miss the landing or strike a moving hazard and every unbanked point from that shot is gone.

Every successful route leaves a relay behind. Close two unique circuits before the pursuing Warden reaches an unprotected world: the first network pushes it back and the second tears open its iron crown. Intercept the moving Command World, circle to its exposed lattice and destroy the bars. Runs are short, deterministic and built for immediate replay. The safe route completes the system; deliberate surface position, timing and deeper gravity lines build the strongest score.

**Feature bullets:**

- Three dense Warden sectors: nine-world Breaker's Reach, then Shatterbelt and Verdant Caravan.
- Deterministic 120 Hz gravity shared by live flight and trajectory prediction.
- Tiny cultures that visibly awaken, trade, resist suppression and answer the final Pulse.
- Resilient relay circuits, a pursuing Warden and a moving Command World finale.
- Bonus-fuel score attacks with fast miss recovery, transparent banking and Warden-arrival failure.
- Assist, Deep and Razor slingshots plus distinct-body chain multipliers.
- Mouse, pen, touch and complete keyboard play, plus persistent reduced-motion controls.
- Versioned replays that independently re-simulate every verified result and an optional local-best route ghost.
- Procedural Three.js art and animation, with optional committed ElevenLabs voice/SFX/music under `assets/audio/` and an in-engine Web Audio fallback.

## Controls copy

- Pointer/touch: trace around a world to walk; pull backwards from the Runner and release to launch; grab the ship in flight to Burn once.
- Keyboard: Q/E walks around, T/F walks over the poles; left/right or A/D steers; up/down or W/S sets power; Shift enables fine control; Enter/Space launches; Space Burns in flight; Escape cancels an aim or opens pause.
- C toggles Scout view; wheel, plus/minus or the pause-sheet zoom buttons adjust it. G toggles the verified local-best ghost when available.
- R resets the attempt. M toggles audio. P cycles System, Reduced and Full motion. Pause includes How to play plus the same actions on touch screens.

## Media capture plan

Capture clean game frames without browser chrome, debug overlays or disposable tuning parameters.

1. **Hero, 16:9:** Breaker's Reach during a planned Ember → Grove slingshot, with the zoomed-out full path, Runner and diegetic ship fuel lights readable.
2. **Liberation, 16:9:** a world halfway through the spherical colour wave while the Stillness cage visibly breaks.
3. **Moving route, 16:9:** Verdant Caravan with Pollen Moon, Crown and the changing trajectory in one composition.
4. **Mastery, 16:9:** Long Night or Worldheart during a two-body chain with both score callouts visible.
5. **Finale, 16:9:** the opened iron crown, final Command Pulse and pooled response before the results dialog covers the scene.
6. **Results, 16:9:** a Verified score with breakdown, constellation and earned emblem visible.
7. **Portrait, 9:16:** live 390×844 play showing an empty playfield, pause control, fuel pips and reachable touch controls.

Suggested 40-second trailer beat sheet:

- 0–4s: title and eight-launch premise.
- 4–11s: drag, full-path prediction and first landing.
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

- Complete the safe and mastery routes on Breaker's Reach, Shatterbelt and Verdant Caravan; smoke-test Long Night, Worldheart and First Light as compatibility fixtures.
- Verify pointer, touch and keyboard aim; surface walking; Scout zoom; Burn; landing; hazard/void recovery; zero-bonus-fuel continuation; Warden catch; Reset; audio, ghost and replay.
- Verify desktop, 390×844 portrait and 844×390 landscape without overflow.
- Verify System, Reduced and Full motion modes, including local persistence and unchanged ranked state.
- On a local `?diagnostics=1` build, start aiming and press Shift+B; confirm the aim cancels without launching and play resumes.
- On the same local diagnostic build, press Shift+G; confirm WebGL loss is reported, restored and rendering resumes.
- Press Shift+F on that local build; confirm bloom/nebula/pixel-ratio degrade one step and restore one step without changing score or launches.
- Confirm draw calls remain under the 190-call ceiling.
- Confirm the Breakers Board says offline when no endpoint is configured.
- Re-run credits review after every asset, font, shader, sound or capture is added.
- Record the final commit SHA, public build URL, leaderboard endpoint status and rules/version used for release.

## Current local candidate evidence

- Build `20260819-ob127` passes deterministic tests, syntax checks, lint, typecheck, the three-sector release audit, the Playwright boot smoke, the 200-run validator benchmark (~52ms median per verified replay), and the zero-HUD play contract (How to play overlay, pause sheet, ship fuel lights, Warden vessel telegraph).
- Highlight kill (`ob127`): sampled ElevenLabs voice/SFX/music play from committed `assets/audio/` files after the first gesture, with mute, reduced-motion music-off, and the in-engine bed as fallback. The browser never calls ElevenLabs. Last-pass +Z camera, planet spin, readable life, cage destroy, How to play, copy boards, and the no glow-disc/grid/mint-ribbon kills stay.
- Highlight kill (`ob126`): live Pages made cage taps no-ops and cage swipes launch because ship-first classification stole the press (first leftover cage sat 0.4 rad from the parked hull, inside both the 56px cage halo and the on-globe ship halo). Cage now wins when a finger is on or near it; a short tap or swipe breaks it; `pointercancel` completes that armed tap on mobile; leftover/default cages sit 1.5 rad from the ship with an 88px hit halo. How to play already said tap; leftover pull-through copy is gone. Planet spin, +Z camera, buildings-on-crust, How to play, and ship-not-eating-the-planet stay.
- Build `20260819-ob126` passes deterministic tests, syntax checks, lint, typecheck, the three-sector release audit, the Playwright boot smoke, the 200-run validator benchmark (~52ms median per verified replay), and the zero-HUD play contract (How to play overlay, pause sheet, ship fuel lights, Warden vessel telegraph).
- Highlight kill (`ob124`): the opening still did not teach the verbs before the first walk. After the two-page story (or Skip intro) a single How to play card now blocks play until Continue. Pause can open the same page later. Last-pass +Z camera, planet spin, readable life, cage destroy, copy boards, and the no glow-disc/grid/mint-ribbon kills stay.
- Highlight kill (`ob121`): live ob120 locked the camera to world +Z, which made walking toward the rim take the Runner over the horizon — only the camera-facing hemisphere was playable, and the torso pivot sat on the physics crust so feet hovered. Landed walk now rotates that world's `WorldRuntime.group` under the Runner so they stay on the toy-planet top; other worlds keep their idle restoration spins. Feet and the parked hull plant on the visual radius. Camera.up stays world +Z. Glow-disc, grid, parked-ship tangent mapping, hidden PullGuideRibbon and `user-select: none` stay.
- Highlight kill (`ob120`): live ob119 flipped and bounced the camera in landed and Scout/aim because the rig blended a surface-normal facing up into world +Z (and PoleLock swapped up near the poles). Camera.up is now locked to world +Z in every mode. Landed framing stays over the current planet so the Runner walks under a camera that does not orbit the globe; Scout/aim/flight are the same top-down with a soft look-target ease. Canvas, html/body and overlay labels set `user-select: none` and `-webkit-user-select: none`; the game canvas also uses `touch-action: none` so a walk/aim drag cannot highlight "Drag the planet to walk".
- Highlight kill (`ob119`): live ob118 laid the Orbitbreaker on the crust, but the landed top-down close-up flattened a squat capsule plus a 0.98-wide wing plate into a pale-blue girder. The shared ship mesh is now a toy courier planform in XY (tapered cylinder hull, cone nose, swept delta wings, canopy bump) at scale `0.08` so it reads smaller than the Runner. Orientation, mint ribbon, glow disc, SeedPointLight and grid kills stay.
- Highlight kill (`ob118`): live ob117 still stood the Orbitbreaker out of Haven because `makeBasis` mapped local +Y (the capsule long axis) onto the surface normal. Parked basis is now parentY = tangent nose, parentZ = dorsal, parentX = starboard; `ShipLieGroup` stays identity. Mint ribbon stays off. `SeedPointLight` stays off. Grid/contour stays gone.
- Highlight kill (`ob117`): live ob115 research named the two screenshot objects. The mint slab is `PullGuideRibbon` during the opening coach — it stays off on the landed close-up. The steel slab is `ShipVisualGroup`: when camera-up is parallel to the surface normal the nose fallback was world +Y, which stands the hull on screen. Degenerate nose is camera-right / view X, never world +Y. `SeedPointLight` stays off. Grid/contour stays gone.
- Highlight kill (`ob116`): recolouring the parked Orbitbreaker was not enough — the Y-up capsule still stood out of Haven's crust as a steel slab, with a mint pull-guide bar beside the Runner and a leftover foot torus. The hull now lies on the crust (lie-down then parent Y along the normal), scaled smaller than the astronaut, with obvious wings; the mint ribbon and idle foot ring stay off. Grab stays drag-planet = walk, grab-ship = aim. `SeedPointLight` stays off.
- Highlight kill (`ob115`): the author screenshot showed the parked Orbitbreaker still as a mint vertical bar because the landed camera's up is world Z and the hull's nose had been aligned with that axis. Recolour and camera-up × normal were not enough; ob116 lies the mesh down.
- Highlight kill (`ob114`): landed Haven no longer wears occupation-grid meridians or contour rings. The parked Orbitbreaker lies belly-down on the crust beside the Runner so it reads as a tiny courier, not a mint-green pole. Walk-vs-aim, the tiny grab torus and the cyan SeedPointLight kill stay as in ob112/ob113.
- Highlight kill (`ob113`): the leftover milky blue disc on landed Haven was the cyan `SeedPointLight` on the runner lighting a circular patch of crust. That light is off. No replacement glow. Tiny ship torus still only while grabbing/aiming.
- Highlight kill (`ob112`): landed Haven draws no milky disc, crust donut or hover outline. The walk overlay, walk cursor and idle ship sphere stay off; a tiny torus appears only while grabbing/aiming the ship. Additive atmosphere shells fade to zero at landed apparent size. Destination rings wait for aim or Scout. First-run captions and 96px grab are unchanged.
- Highlight kill (`ob111`): landed Haven no longer wears a filled additive walk sphere, and hovering a planet no longer stamps the same milky disc. The ship grab cue is a tight camera-facing torus on the craft; the 96px screen grab and first-run walk/aim captions are unchanged. The local ship light is shorter so it cannot light a flashlight patch on the crust.
- Final jam polish (`ob110`): the first-run walk line now holds until the player actually grabs the ship (pointer press, ship pull or keyboard aim), so finishing a walk never reads as entering aim mode; the on-globe PULL THE SHIP chevrons stay off until that first grab and wait a 1.1s beat after each walk drag. The ship grab halo widened to 96 screen pixels with a larger pick sphere, so a near-miss aims instead of walking. The liberation story-board gate always covers the full wave duration (reduced motion included). Atmosphere shells fade fully at distance, dim on landed close-ups, and use a smoother 48x32 rim so worlds neither read as faceted discs nor blow out to white. The local ship light is quieter. The replay pill sits below the toast band, dead mode-chip CSS is gone, and the page ships og:image/og:url/twitter cards.
- Frame-cost pass: default quality is balanced with UnrealBloom and shadows off, desktop fill capped at 1.5x and portrait/mobile at 1.25x. Adaptive samples every 0.75s; a hitch drops bloom then nebula/atmosphere shells/pixel-ratio. Bloom may return after four smooth samples on a strong GPU, still at 1.5x pixels. Feel it by landing on Haven (should stay smooth immediately) and pressing Shift+F on a `?diagnostics=1` build to watch `data-presentation-tier`, `data-bloom-pipeline` and `data-nebula` drop.
- First-timer walk vs aim: the verb locks from where the pointer starts. Ship press aims for the whole gesture; planet crust walks; empty space pans. Sticky captions stay until the first walk ("Drag the planet to walk") then until the first launch ("Pull the ship, then let go"), then silence. No HUD panels returned.
- Tight toy-diorama scale: people, trees, houses, workshops, docks, pack beasts and occupation pylons sit as miniature props. House/workshop profiles sit around 0.24–0.33 so a person is smaller than a house and a house is much smaller than the globe. The landed close-up camera pulls in so those props still read; Scout stays a wide sector view, with one extra zoom-in notch on landed/close only. World radii, gravity, scoring and flight physics are unchanged.
- Look leftovers after the ob104 playtest: Ember's cream plaque and thin black bar stayed at a fixed screen position while the globe rotated, so they were leftover screen-space chips — frozen score-burst glow and empty route/toast boxes — not crust props. Empty playfield labels now collapse to a zero box; the score burst hides after its animation; idle toasts and the route-label layer stay fully unpainted. Occupation clamps remain short pylons. Window lights still draw; street/glow plaque instances are not allocated. R still always resets. Close-up nebula and bloom stay capped. Last leftover Destroy starts the cage-clear wrap/bloom and holds FIRST ANSWER until that pulse finishes on the live planet.
- FUN reliability after the live Pages playtest: stalled crawls recover after a 3s no-progress orbit trap; Enter launches after a walk without an arrow key first; Reset/R skips the opening Warden intro and reframes Haven; Scout pullback and Break thruster flare stay diegetic; world chips keep their full pills and the Warden broadcast sits at the top edge instead of through the globe.
- Tiny Worlds look pass after the live Pages playtest: per-world atmosphere/rim and biome surface identity, round star sprites, ring gravity wells, on-world cage-break/atmosphere bloom during liberation, flight follow with velocity lookahead, and world pills that clear after landing instead of leaving an empty black label.
- Jam salvage checkpoints: one continuously-blended camera rig with zero hard snaps, selective bloom over a per-sector nebula skydome, dense instanced world life with ember dead worlds, mandatory-slingshot gravity (`breaker-reach-9`), relay-port precision landings, a two-card opening with first-run captions then silence, diegetic ship fuel lights, Warden vessel/forecast/target-world pulse telegraph, a pause sheet for Scout and settings, and an animated first-launch `PULL THE SHIP` hint.
- A judge-style rescoring playtest (desktop 1280×800 and portrait 390×844) after these checkpoints read Art 10, Creativity 10, Gameplay 9, Polish 9, Theme 10 with zero console errors; the named top gap (drag-gesture discoverability) is answered by the first-launch pull hint.
- Breaker's Reach is a twelve-body sector: Haven, Ember and Grove stay the inner neighbourhood, Spindle, Quarry, Mirage, Frost, Tide and Bastion wait behind the veil, and the Ledge, Cinder and Glasswing relay shards stage the mandatory slingshot legs. Aiming frames the current world's neighbours so the bigger map stays readable; Scout zoom-out reaches 3.85. Every unrestored world carries a beacon-marked relay-port arc: landing inside liberates with a CLEAN/BULLSEYE precision bonus, landing outside docks and links only. Golden complete replay derives score 53,300 over eight launches on content `breaker-reach-9`.
- Story boards are spaced to one flavour beat per landing; rule beats jump the queue and Skip/Escape dismiss the whole queued conversation. Landings celebrate banked points with a floating score burst, the ship is grabbable within a constant 44px screen target at any zoom, and the Warden vessel plus forecast line name the world it will silence.
- Aiming frames the live neighbourhood on a brighter, less fogged map. Pinch and zoom buttons work during aim, and zoom now reaches from a close world to the whole authored sector. Long Night and Worldheart stay query-only fixtures.
- After the first live link the committed chain holds 1.7s and Ember teaches leftover Destroy. After the first unique loop a gold ghost names the next closing edge. Command lock remains the exposed finale gift. Warden arrival arms a once-per-run recapture Destroy. Extra Break is still deferred so ranked flights keep one recorded burn.
- Living worlds mix houses, workshops and docks on authored sphere sites, with cottage/furnace/canopy/jetty families, walker and pack people, barge/sail/sled hulls, and a limb glow that advertises the far-face town. Reduced motion skips the pause.
- Walking chooses the launch face; the first walk gets a fading caption. Pulling the ship past a 20px screen deadzone starts aim even over crust; the neighbourhood map waits until the pull leaves the cancel disk.
- Callsign typing and Ctrl/Meta/Alt no longer fire game hotkeys; hiding the tab resets adaptive-quality recovery; rankings ignore stale watch/submit results after reset.
- Campaign story boards wait for the wrapping liberation and relay look, then freeze the sim. Continue and Skip disconnect dialogue voices and restore the game bed. Aiming snaps to the sector frame and no longer inherits landed pan/zoom, so fog cannot swallow the predicted path.
- A complete desktop Breaker's Reach route reached both circuits, the moving Command World and a verified 12,250 result at 176/190 peak draw calls.
- A fresh 390×844 route reached the same verified ending at 174/190, with no overflow and all visible controls at least 44px high.
- 844×390 and 390×844 resize/orientation changes publish the correct layout and 1.25 device-pixel-ratio cap.
- Explicit reduced motion preserves the deterministic Haven-to-Ember launch and landing.
- Local-only diagnostics prove background aim cancellation/resume, WebGL loss/restoration and adaptive-quality degradation/recovery.
- Breaker's Reach results use authored Command, Solidarity and Wayfinder emblems and report bonus fuel without presenting zero as a failure condition.
- A verified Breaker's Reach result continues to Shatterbelt, then Verdant Caravan; Caravan stays terminal with replay and ranking actions. Long Night, Worldheart and First Light remain direct-query compatibility fixtures.
- Keyboard aim uses the shared fixed-step predictor to suggest a bounded lead on the exposed moving Command World, with direct-aim fallback and unchanged ranked inputs.
- Every fresh run opens with the Warden's `TRAVEL IS FORBIDDEN · SILENCE KEEPS YOU SAFE` broadcast over the route coach; desktop and 390×844 portrait then delivered Ember's first answer without overflow or blocked controls.
- The third relay now answers with the Warden's defining `CONNECTION IS DISORDER · MOVEMENT IS DISOBEDIENCE` broadcast while the complete second answer, target and four-flight forecast remain readable beneath it.
- Grove's `We thought we were alone` answer now remains in the same instruction as the Warden's target and four-flight arrival forecast instead of being overwritten by it.
- Once that first network branches, Grove now explains that closing the Haven circuit requires walking its far rim and aiming back around Ember until the visible path locks Haven.
- After Haven expands to Frost, the live coach now promotes both valid closures—direct Ember or alternate-arc Grove—and explains that either second gold loop exposes Command instead of hiding the objective behind unrelated suggestions.
- The polite live region and transient story/status toast are atomic assistive announcements, so assistive technology receives each complete Warden or toast update rather than a changed fragment.
- The Command approach now states `A network cannot be imprisoned`; its final Pulse reveals `WARDEN NODE DISCONNECTED · SECTOR WARDENS: 11`, and the verified result carries the authored reminder that the worlds were never alone.
- Hostile worlds now ask you to grab the ship and drag through spread clamps; a miss does not spend the flight, and a longer cut can take more than one.
- A verified result now labels its own run score separately from a stronger stored personal best, preventing the prominent record badge from contradicting the score and breakdown beside it.
- First-run captions use 12px type, stronger contrast and an explicit 1.35 line height; the release audit protects that readability floor.
- New-world prediction badges name the destination as a target—such as `EMBER TARGET`—instead of reusing `LOCKED`, the story's word for Warden imprisonment.
- Permanent relay links now pulse within a brighter 70–90% opacity range, keeping the cyan network and protected gold circuits readable at portrait scale without extra draw calls.
- Play is diegetic: no masthead, scanner, aim meter, objective, Warden dashboard, mode chip or footer. Theme and remaining fuel live on the worlds and the ship.
- Suggested-world labels now preserve a 76px centre gap when their projected positions converge, keeping both authored route choices readable after surface repositioning in short landscape without moving their worlds or camera.
- Break and Destroy stay on ship grab and Space; there is no persistent on-screen Burn button covering the flight corridor.
- Verified results use a compact 760px-wide short-landscape layout with a single sticky three-action row and internal scroll fallback, keeping focused actions visible without changing desktop or portrait results.
- Offline candidates label the final action `Rankings offline` before the explanatory board opens; configured builds retain the shorter `Rankings` label.
- Terminal results centre their unpaired rankings action at desktop and portrait sizes while preserving the short-landscape three-action row.
- Verified replay progress is a 10px atomic polite status, so assistive technology receives each complete launch-count update rather than a changed fragment.
- Warden telegraph stays on the vessel, forecast line, target-world pulse and one polite live region rather than a persistent dashboard.
- Command World progress is an atomic polite status, keeping the objective label attached to relay, exposure, core-lock and liberation updates for assistive technology.
- Scout zoom announces its current percentage to touch and keyboard users, exposes that level in both button names, and marks only the reached limit unavailable without dropping focus.
- Leaving an active Scout view announces `Scout view off`; already-off control paths remain silent instead of producing redundant feedback.
- Audio button and `M` shortcut use one tested presentation path and publish the same atomic `AUDIO ON/OFF` confirmation.
- Explicit Reduced motion holds relay luminance at the same readable 80% midpoint instead of continuously pulsing it.
- Final Pulse publication now reports `defeated` and `command-world-disabled`, matching the visible Warden vessel and verified result without mutating authoritative pursuit state.
- Two-ring world contours and Haven's three-blade grass tufts preserve their silhouettes in one draw call each, restoring headroom during fast liberation and Command transitions.
- These checks do not approve a public deployment, production leaderboard or jam submission.

## Known gated items

- The user-approved public playtest is live at `https://southers.github.io/ORBITBREAK/`; build `20260814-ob13` was verified from main commit `af7958a` on 14 August 2026.
- The production leaderboard has not been deployed; production Worker CPU traces and D1 latency remain unmeasured.
- Final screenshots, trailer footage and the Open Graph share image must be captured from the approved candidate commit.
- Final platform rules, deadline, categories and page fields must be rechecked against the live submission site.
- Final physical-device coverage remains a release-candidate gate; desktop and emulated mobile resilience checks are recorded in `JAM_PLAN.md`.
- Ranked validator still accepts a launch on the collision step while live play waits for restoration presentation; that honesty gap stays deferred because restoration is wall-clock, not a fixed-step delay.

## External-action approval boundary

Never perform these without the user explicitly confirming the exact action at that moment:

- [x] Create the current GitHub Pages playtest (approved 14 August 2026). Any future deployment mutation still requires confirmation at that moment.
- [ ] Create or deploy production leaderboard resources.
- [ ] Press Submit, Publish, Enter or the platform-equivalent final action.
- [ ] Publish a marketing post, trailer or announcement.

Preparing copy, captures, checks and an entry draft does not satisfy or bypass any checkbox above.
