# ORBITBREAK

**Break orbit. Break the Stillness. Bank the run.**

ORBITBREAK is a Three.js gravity score-attack game. Guide a tiny rebel astronaut across authored miniature systems, chain close planetary slingshots, liberate optional worlds for points and reach the Command World before a fixed launch budget expires.

The safe route completes the system. The dangerous route reaches the leaderboard.

## Current checkpoint

This repository has separated from WORLDSEED. Its deterministic fixed-step physics, authored-content pipeline, miniature rendering and one-pointer controls now support a complete five-system ORBITBREAK campaign.

A procedural tiny astronaut has eight launches; every release spends one, including misses, and the eighth flight is allowed to finish. The exact ranked prediction ends after 1.33 seconds, so longer routes demand judgement. Passing into and back out of a planet's influence band earns Assist, Deep or Razor points, distinct planets build a chain and the same body scores only once per flight. A safe landing banks the visible at-risk score; a miss or asteroid impact loses it. Liberating an optional world and reaching the Command World add clear bonuses.

Breaker's Reach is the default ORBITBREAK vertical slice: six worlds span several camera views, a compact scanner keeps distant routes readable, and offscreen labels point toward authored choices. A four-launch low route reaches the Command World with room for recovery; the high opening bends around Ember and Grove before Tide for a much larger bank.

Shatterbelt is the second authored ORBITBREAK system and the first timing-focused expansion. Its wide broken convoy offers a dependable four-shot lower route worth 7,700, while the upper route collects three Stardust and waits for the moving Sentinel before bending deep around Shard. That four-shot mastery route is worth 10,400, making its extra execution risk legible in the result breakdown.

Verdant Caravan is the third authored system and changes the skill test again. Its four-launch lantern road is worth 7,400. The alternate route collects the Arc, intercepts the continuously moving Pollen Moon, then launches from it past Nest toward Crown. The exact aim changes with the moon's phase: an ordinary live Assist produced an 8,300 verified run, while the authored Razor line is worth 9,900.

Long Night is the fourth authored system and the chain-mastery chapter. Its readable four-launch watchfire road banks 7,600. The upper route collects the Arc, then uses a deliberately lower-power, 442-step flight whose landing lies far beyond the ranked preview. Exiting Lumen at Razor depth and then Beacon with the distinct-body multiplier banks 4,350 before Umbra; the complete verified route reaches 14,850.

Worldheart is the authored campaign finale and the exam for every earlier skill. The dependable Kindle → Chorus → Dawn road uses Starwell as a slingshot and reconnects the core in four launches for 9,200. The Memory route collects the Arc, intercepts the moving Memory Moon, chains a Razor pass around Chorus into a multiplied Starwell assist, then doubles back through Starwell and Dawn before reaching the core. That five-launch mastery line banks 14,600. The finale breaks the Stillness and reconnects the liberated systems without introducing another ruleset.

Completed runs now show exactly how many points came from slingshots, liberated worlds and unused launches, plus deterministic airborne time. Ranked personal bests persist locally per system/content version and compare score, launches, then flight time. Run again is the primary results action.

Occupied worlds now carry an unmistakable Stillness control grid and orbital cage. Landing breaks the cage under the spherical liberation wave, restores the world's colour and motion, and reveals a concise story memory. The Runner braces while aiming, flies under twin thrusters, celebrates a liberation and visibly tumbles on recovery; the animation never changes deterministic physics.

Every ranked shot is now playable by pointer, touch or keyboard. Focus the canvas and use left/right to steer, up/down to set power, Shift for 0.5°/1% fine adjustments and Enter or Space to launch; WASD mirrors the arrow keys and Escape cancels without spending a launch. Keyboard and pointer releases share the same prediction, fixed-step launch, replay and scoring path. Results and rankings keep focus contained inside their active dialog.

The leaderboard foundation now records each attempt as a compact deterministic replay: versioned fixed-step launch timing, origin and exact velocity only. Completed payloads persist locally; they do not trust or contain the displayed score. A DOM-free validator rebuilds the authored system, re-simulates those inputs and derives every result field independently. Only an exact match receives Verified and may update the local personal best. Verified routes can be watched immediately through the live simulation from the result screen. The same validation contract must run server-side before any future online score is accepted.

A provider-neutral leaderboard service contract now covers constrained callsigns, validated submission, locked ranking, top-list reads and on-demand replay fetches. A Cloudflare Worker + D1 adapter is prepared with unique replay digests, ranked storage, origin/body limits and pre-validation rate limiting; it bundles successfully in a local Wrangler dry run. The result screen now opens a compact Breakers Board: a configured build can bank a verified callsign, read the locked ranking and fetch any route into the live replay system. An unconfigured build explicitly stays offline and never presents local scores as global. No external service, database or public board has been created, and production validation CPU remains a deployment gate.

The locked target is deliberately small:

- one tiny astronaut controlled with drag and release — implemented;
- eight launches to reach the Command World — implemented;
- accurate but partial ranked trajectory prediction — implemented;
- deterministic slingshot points, close-pass tiers and multi-body chains — implemented;
- optional high-value occupied planets — implemented in Breaker's Reach;
- safe-landing banking with miss rollback — implemented;
- one large authored vertical-slice system — implemented as Breaker's Reach;
- one distinct timing-and-moving-body system — implemented as Shatterbelt;
- one moving-launch-node interception system — implemented as Verdant Caravan;
- one long-arc distinct-body chain system — implemented as Long Night;
- one authored finale that recombines the campaign's skills — implemented as Worldheart;
- transparent results and versioned local personal bests — implemented;
- distinct occupation, Runner and liberation presentation — implemented;
- compact versioned replay recording — implemented;
- independent replay validation and verified local results — implemented;
- verified local replay viewing — implemented;
- provider-neutral validated leaderboard service — implemented;
- Cloudflare Worker + D1 production adapter — prepared locally, not deployed;
- in-game callsign, ranked list and remote replay flow — implemented against the optional endpoint;
- local validator CPU headroom — measured; production traces and user-approved service deployment remain gated.

See `DESIGN.md` for the complete rules and `JAM_PLAN.md` for implementation order.

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

## Controls

- Drag backwards from the glowing player marker and release to launch.
- Focus the game and use left/right or `A`/`D` to steer.
- Use up/down or `W`/`S` to adjust power; hold `Shift` for fine control.
- Press `Enter` or `Space` to launch; `Escape` cancels keyboard aiming.
- `R` resets the run.
- `M` toggles audio.
- The footer buttons provide the same actions on touch devices.

## Project guide

- `AGENTS.md` defines scope, priorities and quality gates.
- `DESIGN.md` locks the gameplay loop, scoring and leaderboard contract.
- `JAM_PLAN.md` defines milestone order and cut rules.
- `RELEASE.md` contains canonical release copy, capture beats, quality gates and approval boundaries.
- `src/content.js` contains the authored campaign-system data boundary.
- `CREDITS.md` records dependencies, assets and source provenance.

## Provenance

ORBITBREAK began from the deterministic gameplay and rendering foundation of [WORLDSEED](https://github.com/Southers/WORLDSEED). WORLDSEED remains a separate playable project; ORBITBREAK has independent history, design and release decisions.

## External-action boundary

Development and playtest builds may be prepared normally. No final external submission, publication, entry or marketing announcement may be performed without the user's explicit confirmation at that moment.
