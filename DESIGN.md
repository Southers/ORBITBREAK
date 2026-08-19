# ORBITBREAK Design

## One-line pitch

Slingshot a tiny rebel astronaut between isolated miniature worlds, build a living relay network and defeat the Warden before it silences everything you connected.

## Player promise

ORBITBREAK should make the player feel clever in flight, hopeful when worlds connect and anxious when the Warden enters the system. A complete ranked run should take roughly five to eight minutes and immediately invite a more daring route.

## Fantasy and conflict

The Warden maintains order by keeping every tiny world isolated. Travel is forbidden, relays are caged and each population has been taught that silence is safety. Without exchange, the worlds fade: lights go out, machines stop and communities survive without knowing who else remains.

The player is the Runner, a maintenance astronaut who steals the last impounded courier ship. The **Orbitbreaker** can cross the Warden's isolation shells and turn a hard landing into a relay link.

The first connections create small, specific signs of hope: two worlds answer one another, windows illuminate, music gains a voice and tiny trade ships begin moving along the route. An isolated breach resembles a fault. The opening act lets the Runner reconnect a neighbourhood and watch it prosper until travel further into the Reach feels easy. Only once that hopeful system is visible does the Warden triangulate a rebellion. It arrives, suppresses vulnerable frontier worlds and follows the network toward the Runner.

The run opens on two story pages, then one How to play card, before the first walk: the Warden's edict, the Runner stealing the Orbitbreaker, then the six control lines. Skip intro still shows How to play. The player must Continue that card once. The pause sheet can open the same page later. It is not a HUD and not a second tutorial campaign. The story board still returns at every major campaign beat so the story is not a toast. It is authored dialogue with portraits, not a branching conversation. Play waits until the player continues or skips. In-engine voices speak each story page after the first gesture. External voice or image APIs are expansion once keys exist; they do not block authored boards.

The Runner wins by creating a network strong enough to expose the Warden's command vessel, then boarding and disabling it. The ending may reveal that this Warden was one node in a larger authority, but the sector is saved and the run is complete.

The Warden's ideology is concise and visible:

> CONNECTION IS DISORDER. MOVEMENT IS DISOBEDIENCE.

## Core loop

1. **Scout:** pan and zoom across a large authored sector; inspect worlds, routes, the ghost and the Warden's telegraphed move.
2. **Choose:** balance a safe connection, a valuable occupied world, a scoring slingshot or a route that protects the existing network.
3. **Reposition:** walk the current world as a globe—front, back and over the poles—to choose a launch point or reach a local relay obstacle. Launch still leaves from the orbital plane.
4. **Launch:** pull away from the Runner and release. The astronaut folds into a launch craft, then a small ship, while retaining one deterministic physics body.
5. **Fly:** read the exact full-path prediction, chain gravity assists through visible wells and optionally spend one Break. Drag from the ship to choose a direction, or break along heading with Space.
6. **Land:** unfold back into the Runner. A successful new landing breaks the local cage, activates its relay and establishes a visible link from the origin world. A first traversal between two active relays can also create a missing link.
7. **Resolve:** bank the flight's score, animate life and trade along connected routes, then advance the Warden one predictable pursuit beat.
8. **Continue:** expand, reinforce, recapture or attack. Complete resilient links to push the Warden back and open the final confrontation.

There is no wall-clock countdown during scouting or surface planning.

## Controls and agency

The game remains one-pointer/touch accessible.

- Drag the **globe** to walk. Drag the **ship** and pull away to aim and build a relay. The two gestures never share a grab. A ship pull commits aim even while the finger is still over the crust; the neighbourhood map waits until the pull leaves the cancel disk. Release on the ship, or press Escape, to cancel without spending the flight.
- Q/E walk around, T/F walk over the poles. R always resets the run. Walking is slow on purpose: one revolution takes several seconds. Keyboard and pointer reach the same sphere.
- The face you stand on is the launch azimuth. Walk until this face looks toward the world you want; over the poles is the short path to the far side. Flattening for aim keeps flight in the orbital plane. The first walk gets a fading caption; after that the globe and aim line teach facing. Do not add surface pickups or extra destinations.
- Drag empty space to pan. Pinch, −/+, or mouse wheel to zoom out from a landed world to the whole Reach. C toggles Scout: the camera pulls back to read the neighbourhood, then returns to the Runner.
- During flight, drag from the ship to **break** your line in any direction, then release. Space still breaks along heading. The preview cannot solve a future player-timed break at launch time.
- On a caged world, drag from the ship through a clamp to **destroy** it. A longer drag can take more than one. Drag back onto the ship, or press Escape, to cancel. Misses do not spend the flight. No health bars.
- Keyboard controls must reach the same deterministic actions as pointer controls. Enter launches from the surface after walking; it does not wait for an arrow key. On a caged world Space still Destroys, while Enter still leaves.
- Reset and R during flight restart the current run without replaying the opening Warden intro or the How to play card. After that reset the camera frames the start world.
- A stalled crawl that never intercepts recovers along the same orbit-trap path as a long loop, returning the Runner to the launch world after a short no-progress timeout. Space still Breaks; a rest heading burns away from the origin world so the verb is never a silent no-op.
- Scout (C) pulls the camera back. Break flares the ship thruster. Neither adds a HUD widget.
- During a run the canvas is the only surface. Remaining launches are lights on the Orbitbreaker and a quieter backpack row on the Runner. The Warden telegraphs with its vessel, forecast line and a pulse on the targeted world. Banked score lives on landing bursts and the victory card.
- First walk, first aim, first Break and first missed port get a fading caption; later play stays silent except toasts. Route names appear only while aiming or scouting.
- One 44px pause control, or Escape when not aiming, opens How to play, Scout, zoom, Ghost, Motion, Audio and Reset. Those keyboard shortcuts stay live during play so desktop never needs the sheet.

Surface movement is spherical and weighty. It exists so the Runner can choose which face looks at a destination, and so a clamp on a hostile rim is reachable. It is not a tour, a collectathon or a platformer. Aiming flattens back onto the orbital plane so gravity paths stay 2D and deterministic.

## Flight skill

Aiming frames the readable neighbourhood and draws the exact remaining path from the live fixed-step simulation until it lands, hits a hazard or runs out of prediction. Pinch, wheel or the zoom buttons move from a close world to the whole authored Reach, including from the landed globe. Fog lifts while planning so the map stays bright. After release the camera follows the ship. A landing recenters on the new world from a stable high +Z view so the planet and Runner stay in frame while they walk; Scout, aim and flight keep that same world-up, so the horizon never flips. Walking spins that world's crust under their feet so the far face comes to the camera-facing pole; the rest of the sector does not orbit. Zooming out lifts to the neighbourhood map. Story boards look at the speaker's world or the Warden. A committed chain is visible before release, including three- and four-world slingshots. Breaker's Reach, Shatterbelt and Verdant Caravan are the three authored Warden sectors; Long Night and Worldheart stay expansion fixtures.

Skill comes from:

- choosing a useful launch point on the current planet;
- pulling hard enough to travel, but not so hard that gravity cannot bend the line;
- reading the full predicted curve and committing to a chain that beats the Warden's next move;
- timing the single Breaker Burn before, during or after a close pass;
- threading visible Assist, Deep and Razor rings around distinct worlds in one flight;
- landing on difficult or strategically important worlds;
- choosing when a risky score route is worth giving the Warden another move.

One resolved flight is still one pursuit beat, so a long slingshot chain is how the Runner covers extra ground before the Warden steps. Launch power is capped so a committed pull still has to ride gravity wells. Full-power darts cannot outrun every planet. Scoring rings appear while aiming and flying; the same body still scores once per flight. A safe landing banks the chain; a miss loses that flight's unbanked points and still advances pursuit.

## The living network

The starting world already carries the Runner's illegal relay. Every first landing on an occupied world activates another. A successful traversal between two active relays creates their link if it does not already exist. After a new landing the camera frames the live relay long enough to see the worlds answer, then returns to the Runner. Repeating an existing link remains useful for travel but creates no new network reward.

Prosperity is staged from network state, never from wall-clock time. Every world is always in one of three readable art states:

1. **Tyrant.** The Warden still owns it. Mines, fumes, guards, held people and outbound extraction freighters eat the surface. This is the default for occupied worlds, and the state suppression returns them to.
2. **Isolated.** The cage is gone but the world is not yet talking. Haven starts here: a quiet garden, sparse people, no traffic. A freshly liberated world pauses here until its first live link.
3. **Living.** At least one live relay. Houses, workshops and culture-true ships appear, then densify with each extra connection and with a closed circuit.

Art is judged on that contrast. A still frame must show hell next to quiet next to prosperity without reading the HUD.

A dashed line with one identical triangle is not the living network. Each live route should read as a specific trade: Ember barges, Grove leaf-sails, Tide hulls, Frost sled-skiffs. Living worlds densify with degree: a second connection adds industry and a second hull; a circuit carries mixed traffic both ways. Suppression reverses the art state without erasing the canonical route.

A world with only one live connection is a vulnerable frontier node. A world is resilient only while it belongs to an intact closed circuit; merely sitting in the middle of a chain is not enough. Closing a new circuit in the network:

- protects the enclosed relay group from immediate suppression;
- sends a visible resistance pulse through its routes;
- pushes the Warden back one pursuit beat;
- weakens one of the command vessel's two defence layers;
- awards a clear network bonus.

Each circuit grants its shield damage and score only the first time it closes in a run. If the Warden later breaks one of its links, traversing that missing connection repairs the circuit and restores protection without farming another reward.

This is also why circuits can hurt the Warden: its system is designed to silence a chain by controlling one choke point. A closed route carries the signal around the break, synchronises several worlds at once and reflects the failed suppression back into the command vessel's shield.

This makes route topology understandable without a separate economy. A fast chain expands quickly but is fragile; a loop costs travel but protects progress and advances the endgame. The playfield teaches that order: reconnect the neighbourhood until the Warden vessel appears, unique circuits while it hunts, then the exposed Command World.

Trade traffic is not background decoration. Its presence shows which links are alive; ships turn back or disappear when a route is threatened, and return when it is restored.

## The Warden

The opening allows enough safety for the player to witness connection working, then to believe it might stay easy. Haven, Ember and Grove are the inner neighbourhood. While those three are live the outer Reach sits behind a readable stillness veil: Frost, Tide, Bastion, Spindle, Quarry, Mirage and Command remain physically present, but dimmer and less zoomable. Completing that inner cluster recedes the veil, raises the Scout zoom-out ceiling and teaches that the silence was never as wide as the Warden claimed. The Warden does not enter on the third live relay. It enters once the player has used that extra range to land on a further world and the neighbourhood has become a visible system. The camera briefly reveals the vessel without taking control away for long.

Pursuit is deterministic and action-driven:

- The flight that first makes the inner cluster plus one further world live spends the pursuit beat revealing the Warden at the sector edge; it does not also move.
- After each later resolved flight, the Warden normally advances one step, including after a miss.
- First closure of a unique circuit replaces that advance with a one-step retreat. Repairing a previously rewarded circuit restores protection but does not push it back again.
- Its next target and route are visible before the player commits.
- It prioritises vulnerable connected frontier worlds and follows a visible authored approach between them.
- Reaching a vulnerable world suppresses its relay, stops its trade and restores its occupation cage; the world remains physically present and can be recaptured.
- An intact circuit absorbs one arrival: the Warden visibly severs a forecast link instead of suppressing the world, opening that loop and creating a repair decision.
- Reaching the Runner's current world without intact loop protection ends the ranked run.
- Closing a resilient loop pushes the Warden back and damages its shield.

Surface walking, pausing, reading and camera scouting do not advance it. The threat is pressure to make good flights, not pressure to operate the interface quickly. The inbound vessel, forecast line and target-world pulse count remaining resolved flights — each launch, landing or miss is one step. Visiting every world is not enough: two unique return-flight loops expose Command. Bonus fuel reaching zero never ends the run.

A representative successful rhythm is intentionally short, with a hopeful first act:

1. Wake Ember, then Grove. Watch both worlds come to life.
2. The inner cluster unlocks further travel. Scout the wider Reach.
3. Land on a further world. The system looks complete and easy.
4. The Warden arrives. Defend versus expand begins.
5. Close the first circuit, recapture if needed, close the second and assault the exposed command vessel.

Detours, recaptures, misses and score routes create the variation. The hunt must still have map left: do not delay the Warden until Bastion and Command are already solved.

## Hostile worlds and combat boundary

Worlds have authored dispositions rather than random encounters:

- **Occupied:** break the cage and connect the relay.
- **Friendly:** safe launch node, story beat and visible community.
- **Uncertain:** route value or local state is revealed by approaching or connecting it.
- **Hostile:** the cage still has teeth. Clamps around the rim block launch until they are cut.
- **Command:** the Warden's mobile final world.

Hostile surface moments last seconds and use the same ship-grab as launch. Clamps are spread around the rim. Drag through them to destroy the cage; walking gets you a better line. A chord can take two. There is no Pulse button that wins the encounter, no health pools, no loot, and no second combat ruleset. The point is to make the landing active, not to compete with orbital flight.

## Final encounter

The Warden's command vessel is a hostile moving tiny world, not a conventional shooter boss.

The first two unique resilient circuits each remove one visible shield layer. Once the vessel is exposed, the Runner must use the established verbs—scouting, repositioning, slingshots and a mid-flight break—to pass its shield moons and land on the command core. A short surface approach and cutting the lattice teeth disables the isolation lattice.

The worlds then answer together: trade lanes converge, allied craft arrive through routes the player created and the Warden loses control because the network is no longer dependent on one rebel.

## Score, results and ghosts

Ranked score has three readable sources:

1. **Flight:** Assist, Deep and Razor slingshots with distinct-body chain multipliers.
2. **Network:** authored liberation values and first-closure bonuses for unique resilient circuits.
3. **Victory:** remaining pursuit distance when the Warden is defeated.

Only a defeated Warden banks a ranked run. Ordering remains highest score, then fewer resolved flights, then shortest deterministic airborne time. Aim, scouting and surface-planning time are never tiebreakers.

The local personal-best replay becomes a visible ghost in Scout view and during flight. It shows route ideas without solving aim. Global rankings and selectable top ghosts use the same server-validated replay contract only after a production service is deliberately approved and proven.

## Story delivery

Story is delivered through authored story boards at the campaign's turning points, then short coaches while you aim. It is not a control dump, a lore dump or a dialogue tree.

The opening is two skippable pages before any launch. Page one is the Warden's edict. Page two is short: fly the Orbitbreaker to other tiny worlds, linking them lets those worlds prosper, occupied worlds have Warden cages, tap the cage to break it. After that, the same skippable board returns at first answer, second voice, range unlock, neighbourhood, Warden arrival, first circuit, suppression, recapture, Command exposure and a lost run. A landing always plays its liberation and relay camera first. The board then pauses the game. Dialogue voices stop when the player continues or skips, and the game bed returns. Reading never advances pursuit. Replay playback skips every board.

Story is spaced so it never stacks: one flavour board at most per landing, with any others held for later landings. Rule-changing beats — Warden arrival, circuit closed, suppression, recapture, Command exposure, the Reach answering and a lost run — jump ahead of waiting flavour beats and may present back-to-back because they change what the player must do next. Skip and Escape dismiss the whole queued conversation, not one card of it.

Coach copy between boards stays one sentence. Controls appear when the verb is available. External voice or image APIs are expansion once keys exist; in-engine voices and authored portraits ship with the static Pages build.

Anchor beats:

- Opening Warden: **“Travel is forbidden.”**
- Opening Runner: **“I stole the last ship.”**
- First answer: **“Is someone there?”**
- Second connection: **“We thought we were alone.”**
- Inner cluster / range unlock: **“The dark is not as wide as they said.”**
- Further landing: **“A whole neighbourhood is talking.”**
- Warden arrival: **“Unauthorised network detected.”**
- Circuit: **“The signal went around.”**
- Recapture: **“We're still here.”**
- Final resistance: **“A network cannot be imprisoned.”**
- Ending: **“You did not save them alone. You reminded them they were never alone.”**
- Expansion sting: **“WARDEN NODE DISCONNECTED. SECTOR WARDENS: 11.”**

The exact identity behind the Warden remains intentionally unresolved. It may be a person, an autonomous governing machine or one face of a larger super-AI; the first game does not need a lore dump to answer that question.

## Tiny Worlds theme and art direction

Every planet is a readable miniature society, not a coloured scoring ball. Close views show exaggerated terrain, homes, infrastructure and tiny inhabitants. Wide views show isolation becoming a connected constellation.

The visual arc is the theme:

> separate silent dioramas → first relay → living trade network → visible suppression → collective resistance

Scale is part of the fantasy. Landed views must make the Runner small on a world that has stance: streets, roofs, chimneys, docks and other people. The player character is a courier, not a giant on a marble. Worlds may grow in radius and camera may zoom closer on the surface and further out across the sector, but surface movement stays on the world's sphere and the physics body stays one identity.

The Runner must walk when repositioning. Other characters walk their own short patrols. Inhabitants are not three identical bobbing pins; cultures need distinct silhouettes, and busy worlds need a crowd that still reads at mobile size.

The Runner, inhabitants and trade ships establish scale. The Warden's vessel is itself a corrupted tiny world, making the finale an inversion of everything the player has restored.

## Alive Tiny Worlds — implementation plan

This is the next durable improvement. It is Milestone 8 in the charter: world detail, inhabitants, trade traffic, story delivery and scale. It is not a second sector, a platformer or a talking-head game.

### Honest current state

The Reach has the verbs, sphere walking, staged prosperity and instanced life. Checkpoints 15–18 put that life on the globe:

- Occupation scars, houses, windows, streets, people and town glow sit on authored longitude/latitude sites. Haven, Ember and Grove have a near-side cluster, a far-side town and a polar site. Shatterbelt and Verdant Caravan use the same rule so those globes are not empty rings.
- Buildings are pooled cottage (walls, roof, chimney, door), furnace (kiln and stack), canopy hall (trunk and leaf masses) and jetty (deck, pilings, bollard) families. Inhabitants are helmeted toy walkers with visor and backpack, plus four-legged pack beasts. Trade uses barge, sail and sled hulls. Ground scatter is biome-true at readable density instead of a cone field.
- Living clusters emit a limb glow, so the other face advertises a harbour or mine without quest markers. Meadow, Ember and Frost diorama props now occupy the far hemisphere too.
- Destroy pylons, flight, prediction and replay stay in the orbital plane. The physics identity is unchanged; `breaker-reach-8` retunes the authored layout so gravity is mandatory, not the step integrator.
- Gravity is the game (jam salvage phase 3): anchor wells (Haven, Ember, Grove, Tide, Frost, Bastion) deepened to 240–340 so full-power direct shots at Tide, Spindle, Quarry, Mirage or the Command World always bend into an intermediate world. Three relay-shard asteroids — Ledge, Cinder and Glasswing — join the Reach as pre-lit waypoints (`countsTowardRestoration: false`) that stage the outer legs. The aim line predicts 1800 fixed steps (~15 s) so a full assisted arc is visible before release, and each body shows a soft additive well glow sized by its gravitational parameter while aiming or flying.
- Relay-port landings (`breaker-reach-9`): every unrestored world authors a generous beacon arc on its circumference. Landing inside liberates and grades CLEAN/BULLSEYE for deterministic bonus score; landing outside docks safely and links the relay but leaves the cage until a later in-port landing. Pursuit still advances per resolved flight, so precision trades against Warden pressure, never fuel. The arc renders as pulsing gold beacons on unrestored worlds and the aim preview names the outcome (BULLSEYE / awaken / DOCK ONLY) before release.
- Onboarding and felt pursuit (checkpoint 23 / How to play): the opening is two story cards, then one How to play card before the first walk. Pause can open that same page later. Break, Destroy, ports and slingshots stay coached in-world at the moment of need. The Warden vessel, forecast line and target-world pulse telegraph pursuit, and every advance is an audible low step, a world-space pulse and a warden-toned toast.
- Walk-to-launch (checkpoint 19 / first-timer lock): the verb is chosen from where the pointer starts, not how it later moves. Press the ship to aim for the whole gesture (96px empty-space halo on a small scout world; the parked hull only on a filling phone globe); press the current world's crust to walk; press empty space to pan. Cage taps have no proximity gate. A tiny twitch stays pending; Escape or dragging back onto the ship cancels aim. First-run captions stay until done: "Drag the planet to walk" holds until the ship is first grabbed so finishing a walk does not read as entering aim, then "Pull the ship, then let go" until the first launch, then silence. The on-globe PULL THE SHIP chevrons stay off until that first grab (and wait a short beat after a walk drag) so they never overlap the walk line. Landed close-ups draw no planet-sized glow disc, crust donut, hover outline, cyan runner light, occupation-grid meridians, contour rings or idle foot ring on the globe; the Orbitbreaker's Y-up hull maps local +Y to a tangent screen-horizontal nose (never the surface normal) and local +Z to the dorsal so wings and body read from the landed camera instead of a standing slab. The mint opening pull-guide ribbon stays off. The ship shows a tiny torus only while the pointer is over it or aiming. Atmosphere shells fade out at that close-up so Haven reads as a toy world. Destination rings wait for aim or Scout. Walking rotates that world's crust under the Runner so they stay on the camera-facing pole; other worlds stay put. Feet and the parked hull sit on the visual crust, not the leftover physics radius.
- Review follow-ups (checkpoint 20): callsign typing and Ctrl/Meta/Alt no longer fire game hotkeys; hiding the tab resets adaptive-quality recovery; rankings ignore stale watch/submit results; slingshot prediction skips the pre-launch rest sample.
- Draw-call ceiling remains 190. New life is instanced and pooled.
- Frame cost (checkpoint 24): default quality is balanced so a normal laptop stays smooth. UnrealBloom and shadows stay off until four 0.75s samples prove 60fps; a hitch drops bloom immediately, then nebula, atmosphere shells and pixel-ratio. Actual fill stays at 1.5x on desktop and 1.25x on portrait/mobile. Stardust spin, biome sway and inhabitant instance uploads skip on the balanced tier. Physics, scoring and ranked determinism are unchanged.
- Tiny Worlds visual pass (playtest of the public Pages build): occupied worlds keep biome hue instead of one brown ball, without painting a latitude/longitude control grid or contour rings on the globe; Ember/Grove/Frost/Tide get distinct roughness and per-world atmosphere rims that fade when zoomed out so they do not become a faceted blue disc. Gravity wells are rings, not filled planes. Bright cyan pickups are spheres, not octahedron diamonds, and star/mote sprites keep a soft circular falloff. Close-up nebula and bloom stay capped so landed and in-flight cameras still read as space; Scout can keep more haze. Occupation clamps are short pylons, not name plaques. Prosperity no longer stamps stretched street/glow boxes onto the crust. Empty world-name chips, score bursts and idle toasts collapse to a zero box so they cannot leave a cream plaque or black bar at a frozen screen position during an Ember walk. Surface life is a tight toy-diorama: a person sits smaller than a house, and a house sits much smaller than the globe, with trees, docks, pack beasts, scatter and pylons matching that hierarchy. The landed close-up camera pulls in so those props still read; Scout stays a wide sector view, with one extra zoom-in notch on landed/close only. Liberation holds a wrapping wave and atmosphere bloom through cage-clear, including leftover Destroy, and story boards wait until that money shot finishes on the live planet. Aim uses a tapered additive ribbon instead of a 1px line. World name chips are text-only, visible only while aiming or scouting. First-timer walk vs aim is locked from the press target so dragging the planet cannot steal a launch. The parked Orbitbreaker lies on the crust as a tiny winged courier next to the Runner: local +Y maps to a screen-horizontal tangent nose, local +Z to the surface normal, and the XY planform is a tapered hull with a cone nose and swept wings so the landed close-up does not flatten into a girder. The leftover mint pull-guide bar is gone.
- Alive crust pass after playtest `20260818-ob121`: inhabited worlds keep fewer, larger biome tufts plus readable overlay houses, trees, docks, towers and walkers even while isolated or tyrant, so Haven/Ember/Grove/Frost/Tide/Bastion read as toy dioramas from the landed +Z camera. Close-up hides stillness cages, relay-port scoring arcs, slingshot/gravity rings and mote halos so the crust is the picture; those overlays return when Scout or aim pulls the camera back. Walking near an authored crust discovery banks once into `discoveryScore` with a quiet `Haven 2/4 · garden relay` toast and no map pins or collectathon HUD. Ranked flight totals stay on the shared simulation; exploring cannot desync a verified replay. Shards stay sparse. Planet-spin-under-walker and runner-planted-on-crust are unchanged. Degraded presentation / bloom-off stays a perf choice.

Judging from current evidence: **Polish** was the live hitch — UnrealBloom at 2× pixels, close-up nebula and per-frame instance uploads. This pass cuts that cost so tiny-world readability can stay without the jank. Creativity, Gameplay and Theme stay on the existing loop. Do not add HUD chrome.

### What we are building

One denser Breaker's Reach, plus the same prosperity rules on Shatterbelt and Verdant Caravan.

- **Story spacing.** Short intro, then one line per beat, with time to look at the world that just changed.
- **Prosperity that grows.** Different routes, different ships, buildings, industry, houses, people. Life flows along live links and retreats when the Warden cuts them.
- **Scale.** More planet stance, deeper zoom-in, wider zoom-out, a visibly smaller Runner.
- **Alive surfaces.** The Runner walks. Other characters walk. Cultures stay distinct.
- **Hope, then range, then the Warden.** Connect the inner neighbourhood, think it is easy, unlock further travel, link a visible system, then introduce pursuit while outer worlds still remain as choices.

### What we will not do

- Add a procedural universe or several shallow chapters beyond the three authored Warden sectors.
- Turn circumference walking into free-roam platforming, dialogue trees, health, inventories or ship stat upgrades.
- Advance the Warden on wall-clock time, story-card reading or Scout zoom.
- Delay the Warden until the whole map is already solved; the hunt still needs expand-versus-defend space.
- Replace the shared 120 Hz simulation, Breaker Burn contract, one-pointer controls or planet-wrapping liberation wave.
- Ship this as one unplayable mega-change. `main` stays playable at every checkpoint.

### Range unlock, precisely

Range is the silence receding, not the Orbitbreaker levelling up.

After Haven, Ember and Grove are all live:

- the stillness veil on Tide, Frost, Bastion, Spindle, Quarry, Mirage and Command recedes;
- Scout may zoom further out;
- the coach says the dark is not as wide as they said.

Launch power stays the current 12.5 cap unless a later checkpoint proves the outer Reach is unflyable without a network-derived envelope. Further travel should come from the slingshot skill the hopeful act just taught. Outer worlds remain in the physics scene the whole time so prediction, ghosts and replays stay honest; the veil is presentation and camera, keyed to network state.

### Warden timing, precisely

Do not reveal on the third live relay (`Haven` plus two hops). Reveal after the range unlock has been used: the inner cluster is live and at least one further world (Tide, Frost or Bastion) has been landed. That is a visible system, not a fault. Circuit closure, suppression, recapture and Command exposure keep their current contracts once pursuit exists.

A mastery chain that wakes Ember, Grove and a further world in one flight still spends that resolved beat on the reveal. The hopeful act is the new-player default, not a lockout of a daring first shot.

### Scale, precisely

Do this in two layers so physics does not thrash:

1. Shrink the Runner and ship visuals around the unchanged collision radius. Lower landed camera height so a planet fills the frame. Raise zoom-in so streets and people read; lower zoom-out so the whole Reach is inspectable.
2. Only then, if the Runner still feels huge, increase authored world radii and restance the wells. That checkpoint must bump `contentVersion` and rewrite golden replays.

### Prosperity, precisely

Author a per-world, per-degree kit. Prefer instanced meshes shared across cultures with colour, silhouette and lane offsets changing:

| Stage | Surface | Traffic |
| --- | --- | --- |
| Occupied | clamps only | none |
| Awake | landmark + first people | none |
| Linked | houses or stalls; lit windows | one culture-true ship on the new lane |
| Busy | workshops, chimneys, docks, extra patrols | two hulls on offset lanes |
| Circuit | denser roofs, shared festival light | mixed hulls both ways |

Ember grows furnaces and barges. Grove grows canopies and leaf-sails. Tide grows jetties and hulls. Frost grows ice-houses and sled-skiffs. Haven grows cottages and garden boats. Bastion grows watch-houses and courier spines. Suppression collapses the kit back to clamps and empty lanes without deleting the route history.

### Characters, precisely

- Runner walk cycle on circumference motion; idle breath when still. Reduced motion keeps the pose without the stride.
- More inhabitants per restored world, with at least two silhouettes per culture, still one or two instanced draws.
- They remain extras on the sphere: short patrols around their home site, gathering at docks when a ship arrives, hiding under suppression.
- No named NPCs, no conversation graph, no quest markers.

### Story UI, precisely

- Opening uses a four-page board. Later beats reuse that board: first answer, second voice, range, neighbourhood, Warden arrival, circuit, suppression, recapture, Command, lost run.
- The player dismisses with Continue/Skip. Keyboard Enter/Space continue; Escape skips the current beat.
- Liberation still plays the wrapping wave under the board. Do not immediately replace it with hunt coaching.
- Coach copy between boards stays one sentence. Controls appear when the verb is available (Break in flight, Destroy after the first live link, Scout when the veil recedes).
- Mobile must keep 44px controls, no overflow, and boards that do not cover the Continue/Skip row.

### Three visual states, equally authored

Judging is primarily Art. The living-network kit is not enough if occupied worlds only wear red clamps. Tyrant, isolated and living need the same density of thought.

**Tyrant (Warden-owned)**

The surface is being eaten. Culture-specific extraction sits in the occupation scars:

- Ember: furnace stacks, cinder fumes, ore barges hauled toward Command.
- Grove: stripped root-heads, wood smoke, caged workers among the staples.
- Tide: dredge cranes, oily vapour, hulls leaving with water and salt.
- Frost: ice drills into a collapsing crust, steam, sled-skiffs of ore.
- Bastion: prison yards under the watch battery, iron spines, courier cages.
- Haven, if suppressed: the garden fenced into a work camp.

Visible Warden staff stand the mines. Held people huddle and shuffle; they are not hidden offscreen. Dark freighters lift raw material toward the Command World and do not bring anything back. The crust is ashen, the air dirtier, the landmark crushed under industry. Liberation must look like those machines failing, fumes dying and people standing up.

**Isolated (neutral / quiet)**

No cage, no mines, no traffic. A few free inhabitants, the local landmark, dim windows. Haven’s opening garden is the reference: survival without exchange. This is the breath between tyranny and prosperity, so the first link can feel like a gift.

**Living (connected)**

The prosperity kit from Linked through Circuit. Extraction is gone. Trade hulls are culture-true and travel both ways. Houses and workshops replace pits. The same people who were held now walk their towns on the sphere.

Suppression slams a living world back to Tyrant without deleting its canonical route. Recapture plays Isolated then Living again as the first restored link relights.

### Checkpoint sequence

Implement in this order. Each checkpoint is one coherent commit, with `npm test`, `npm run check` and a desktop plus portrait pass.

1. **Tyrant / isolated / living contrast, plus a tiny Runner.** Occupied worlds show mines, fumes, guards, held people and outbound extraction. Haven stays the quiet garden. Shrink Runner/ship visuals, closer landed follow, deeper zoom-in. Physics identity unchanged.
2. **Opening purpose and spaced beats.** Two-card intro; one-line coaches; no hunt promise before hope.
3. **Walk and denser crowd.** Runner walk cycle; more culture silhouettes. Sphere great-circles, never platforming.
4. **First prosperity jump.** New links grow houses/windows and a culture-true ship instead of one cone.
5. **Busy routes.** Degree 2 and circuits add offset lanes, a second hull and industry. Prove 390×844.
6. **Hopeful act and range veil.** Inner cluster recedes the outer veil and raises Scout zoom-out. Warden reveals only after one further landing. Update pursuit tests and golden replays.
7. **Sound and breathing room.** Distinct dock, crowd, mine and lane layers; hold the camera on the change before handing control back.
8. **Stance retune if needed.** Larger world radii and well restance only if zoom and shrink were not enough. New `contentVersion`, new goldens, same verbs.

Checkpoints 2–7 are in the playable Breaker's Reach build (now `breaker-reach-8`). The authored sector is twelve bodies: the original inner garden, Spindle, Quarry and Mirage on the outer Reach, plus the Ledge, Cinder and Glasswing relay-shard asteroids that stage the mandatory slingshot legs. Checkpoint 8 was skipped: the 0.52 Runner and landed follow already make the courier a visitor, so radii and wells were not restanced. Checkpoints 15–18 put life on the sphere with culture-true pooled silhouettes and far-face glow. Checkpoint 19 keeps facing after a walk and lets a ship pull start aim without waiting for the ray to miss the globe. Checkpoint 20 applies still-relevant preview-PR review follow-ups without adding verbs.

Stop conditions:

- If extra props blow the mobile frame or the 190-call budget, instance harder or raise the budget only with measured 390×844 evidence.
- If walking becomes busywork, keep the cycle and the facing coach; do not add surface pickups or extra destinations.
- If delaying the Warden makes the run aimless, reveal after the first further landing, not after the whole outer Reach.

### Success for this plan

A still frame of three linked worlds shows different buildings, different ships and people in motion. A new player can say what they are doing before the Warden speaks again. The Runner looks like a visitor on a tiny world, not the largest object on it. The hunt still starts with unused worlds left to save or score.

### Still missing, on purpose of remaining time not a freeze

GitHub Pages being static does not mean the campaign stays quiet. These are the next ambitious layers, in roughly this order, while `main` stays playable:

1. **Second Break.** Neighbourhood gift and hunt extra-Break boon. Schema bump, replay recorder/validator, and golden rewrite only for that checkpoint.
2. **External voices and image APIs.** ElevenLabs sampled voice, SFX and music are generated in GitHub Actions from `secrets.ELEVENLABS_API_KEY` and committed under `assets/audio/`. The public Pages build never calls the API. In-engine Web Audio remains the fallback until those files exist. Gemini portraits stay optional and out of repo secrets.

Do not treat a toast, a HUD chip or a one-line coach as the delivery of those beats.

## Run unlocks (next)

Do not add a permanent meta-upgrade tree, random infinite runs or a second combat game. Unlocks should be a short authored ladder inside one Breaker's Reach run, earned on resolved flights and visible on the ship, then gone on reset.

Proposed ladder, earliest first:

1. **Break** — already the first flight verb. Directed drag is the tutorial unlock; heading Space remains the accessible fallback.
2. **Longer prediction** — after the first live link the committed chain stays on the map 1.7s; reduced motion skips the hold.
3. **Destroy** — occupied unrestored worlds spawn a tappable equatorial cage on dock. Ember keeps one leftover cage after the first live link. Bastion and Command keep the full cage. The cage banner only appears while a cage is actually up.
4. **Second Break** — only after the neighbourhood is talking, still one at a time, still recorded. Never a spray. Ranked schema bump still required.
5. **Circuit beacon** — after the first loop, a visible gold ghost of the next closing edge. Information, not an auto-aim.
6. **Command lock** — after both shields crack, keyboard/pointer lead on the moving crown. Finale gift only. Scout and aim always show one Command label (LOCKED until the route opens, EXPOSED after); A/D never snaps to already-linked neighbours.

Keyboard aim starts from the current launch face at mid power. A/D steer freely; W/S change throw strength and the aim stem/arc length. Route beacons still mark useful neighbours without stealing the angle.

Roguelike flavour without roguelike chaos: after the Warden arrives, a once-per-run recapture Destroy on a silenced world that has no authored cage. Extra Break stays deferred so ranked flights keep one recorded burn. The map, wells and ranked physics stay authored. Score still cannot reward waiting. No HP, no loot, no ship stats that persist between runs.

## Scope

The first complete target is three dense authored Warden sectors. Breaker's Reach opens the run. Shatterbelt and Verdant Caravan continue the same loop against further Wardens. Long Night and Worldheart remain a content library and compatibility fixture.

Infinite procedural space, free-roaming planet surfaces, conventional combat, inventory and permanent numerical upgrades are outside this version.

## Success criteria

- A new player understands that connection helps worlds, sees those worlds prosper, then understands why the Warden arrives.
- Walking changes launch geometry without feeling like busywork. The coach names which neighbour this face looks toward. The far face shows a town, mine or glow, not an empty sphere.
- Breaker Burn turns flight from waiting into a meaningful timing decision.
- The Warden's next move is always understandable and creates a defend-versus-expand choice.
- The first recapture feels sad but fair, reversible and mechanically useful.
- At least two viable routes exist: a safer network and a harder high-score route.
- The final encounter tests existing skills rather than introducing a new genre.
- A completed run tells a coherent story without a cutscene.
- Desktop and portrait-mobile play remain reliable, readable and replayable.
