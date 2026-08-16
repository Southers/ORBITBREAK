# ORBITBREAK Design

## One-line pitch

Slingshot a tiny rebel astronaut between isolated miniature worlds, build a living relay network and defeat the Warden before it silences everything you connected.

## Player promise

ORBITBREAK should make the player feel clever in flight, hopeful when worlds connect and anxious when the Warden enters the system. A complete ranked run should take roughly five to eight minutes and immediately invite a more daring route.

## Fantasy and conflict

The Warden maintains order by keeping every tiny world isolated. Travel is forbidden, relays are caged and each population has been taught that silence is safety. Without exchange, the worlds fade: lights go out, machines stop and communities survive without knowing who else remains.

The player is the Runner, a maintenance astronaut who steals the last impounded courier ship. The **Orbitbreaker** can cross the Warden's isolation shells and turn a hard landing into a relay link.

The first connections create small, specific signs of hope: two worlds answer one another, windows illuminate, music gains a voice and tiny trade ships begin moving along the route. An isolated breach resembles a fault. The opening act lets the Runner reconnect a neighbourhood and watch it prosper until travel further into the Reach feels easy. Only once that hopeful system is visible does the Warden triangulate a rebellion. It arrives, suppresses vulnerable frontier worlds and follows the network toward the Runner.

The run opens on a four-page story board before any launch: the Warden's edict, the Runner stealing the Orbitbreaker, Haven as the last free garden, and the charge to wake the neighbourhood. The same board returns at every major campaign beat so the story is not a toast. It is authored dialogue with portraits, not a control dump and not a branching conversation. Play waits until the player continues or skips. In-engine voices speak each page after the first gesture. External voice or image APIs are expansion once keys exist; they do not block authored boards.

The Runner wins by creating a network strong enough to expose the Warden's command vessel, then boarding and disabling it. The ending may reveal that this Warden was one node in a larger authority, but the sector is saved and the run is complete.

The Warden's ideology is concise and visible:

> CONNECTION IS DISORDER. MOVEMENT IS DISOBEDIENCE.

## Core loop

1. **Scout:** pan and zoom across a large authored sector; inspect worlds, routes, the ghost and the Warden's telegraphed move.
2. **Choose:** balance a safe connection, a valuable occupied world, a scoring slingshot or a route that protects the existing network.
3. **Reposition:** walk clockwise or counter-clockwise around the current world's orbital-plane circumference to choose a launch point or reach a local relay obstacle.
4. **Launch:** pull away from the Runner and release. The astronaut folds into a launch craft, then a small ship, while retaining one deterministic physics body.
5. **Fly:** read the exact full-path prediction, chain gravity assists through visible wells and optionally spend one Break. Drag from the ship to choose a direction, or break along heading with Space.
6. **Land:** unfold back into the Runner. A successful new landing breaks the local cage, activates its relay and establishes a visible link from the origin world. A first traversal between two active relays can also create a missing link.
7. **Resolve:** bank the flight's score, animate life and trade along connected routes, then advance the Warden one predictable pursuit beat.
8. **Continue:** expand, reinforce, recapture or attack. Complete resilient links to push the Warden back and open the final confrontation.

There is no wall-clock countdown during scouting or surface planning.

## Controls and agency

The game remains one-pointer/touch accessible.

- Drag the ship to aim. Release away from it to launch. Drag back onto the ship, or press Escape, to cancel without spending the flight.
- Drag the current world's disk (not the ship) to walk the orbital-plane circumference. Q/E remain the keyboard walk.
- Drag empty space to pan. Pinch or mouse wheel to zoom. C snaps the camera back to the Runner.
- During flight, drag from the ship to **break** your line in any direction, then release. Space still breaks along heading. The preview cannot solve a future player-timed break at launch time.
- On a caged world, drag from the ship through a clamp to **cut** it. A longer drag can take more than one. Drag back onto the ship, or press Escape, to cancel. Misses do not spend the flight. No health bars.
- Keyboard controls must reach the same deterministic actions as pointer controls.

Surface movement is deliberately one-dimensional. It creates launch-position choice, scale and character without turning ORBITBREAK into a platformer.

## Flight skill

Aiming frames the readable neighbourhood and draws the exact remaining path from the live fixed-step simulation until it lands, hits a hazard or runs out of prediction. Pinch, wheel or the zoom buttons move from a close world to the whole authored Reach. Fog lifts while planning so the map stays bright. After release the camera follows the ship. A landing recenters on the new world. Story boards look at the speaker's world or the Warden. A committed chain is visible before release, including three- and four-world slingshots. Extra solar systems stay expansion; this run is one dense sector.

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

This makes route topology understandable without a separate economy. A fast chain expands quickly but is fragile; a loop costs travel but protects progress and advances the endgame. The HUD teaches that order: reconnect the neighbourhood until the Warden appears, unique circuits while it hunts, then the exposed Command World.

Trade traffic is not background decoration. Its presence shows which links are alive; ships turn back or disappear when a route is threatened, and return when it is restored.

## The Warden

The opening allows enough safety for the player to witness connection working, then to believe it might stay easy. Haven, Ember and Grove are the inner neighbourhood. While those three are live the outer Reach sits behind a readable stillness veil: Frost, Tide, Bastion and Command remain physically present, but dimmer and less zoomable. Completing that inner cluster recedes the veil, raises the Scout zoom-out ceiling and teaches that the silence was never as wide as the Warden claimed. The Warden does not enter on the third live relay. It enters once the player has used that extra range to land on a further world and the neighbourhood has become a visible system. The camera briefly reveals the vessel without taking control away for long.

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

Surface walking, pausing, reading and camera scouting do not advance it. The threat is pressure to make good flights, not pressure to operate the interface quickly. The inbound HUD counts remaining resolved flights — each launch, landing or miss is one step. Visiting every world is not enough: two unique return-flight loops expose Command. Bonus fuel reaching zero never ends the run.

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

Hostile surface moments last seconds and use the same ship-grab as launch. Clamps are spread around the rim. Drag a short cut through them; walking gets you a better line. A chord can take two. There is no Pulse button that wins the encounter, no health pools, no loot, and no second combat ruleset. The point is to make the landing active, not to compete with orbital flight.

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

The opening is a four-page board before any launch: the Warden's edict, the Runner stealing the Orbitbreaker, Haven as the last free garden, and the charge to wake the neighbourhood. After that, the same skippable board returns at first answer, second voice, range unlock, neighbourhood, Warden arrival, first circuit, suppression, recapture, Command exposure and a lost run. A landing always plays its liberation and relay camera first. The board then pauses the game. Dialogue voices stop when the player continues or skips, and the game bed returns. Reading never advances pursuit. Replay playback skips every board.

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

Scale is part of the fantasy. Landed views must make the Runner small on a world that has stance: streets, roofs, chimneys, docks and other people. The player character is a courier, not a giant on a marble. Worlds may grow in radius and camera may zoom closer on the surface and further out across the sector, but surface movement stays on the orbital-plane circumference and the physics body stays one identity.

The Runner must walk when repositioning. Other characters walk their own short patrols. Inhabitants are not three identical bobbing pins; cultures need distinct silhouettes, and busy worlds need a crowd that still reads at mobile size.

The Runner, inhabitants and trade ships establish scale. The Warden's vessel is itself a corrupted tiny world, making the finale an inversion of everything the player has restored.

## Alive Tiny Worlds — implementation plan

This is the next durable improvement. It is Milestone 8 in the charter: world detail, inhabitants, trade traffic, story delivery and scale. It is not a second sector, a platformer or a talking-head game.

### Honest current state

The Reach already has the verbs. What a new player actually sees does not yet match the fantasy:

- Opening copy is a Warden toast plus one dense paragraph about zoom, gold rings, chains, Frost, Burn and the Warden.
- The objective still counts `RELAYS 1 / 3` toward a hunt that starts after two hops.
- A live link is a luminous segment and one shared cone courier. That is a diagram, not prosperity.
- Restored worlds grow one landmark and three identical walking pins. Houses, industry and crowds do not accumulate as more routes open.
- The Runner visual scale is 0.52 against world radii of about 2.5–4.2, with a landed close camera and Scout zoom from 0.38 to 1.95, so miniature industry can read. Occupied worlds now show mines, fumes, guards, held people and outbound extraction; Haven stays the quiet garden. Living prosperity (houses, culture-true ships) is still the next art checkpoint.
- Draw-call peaks already sit near the 190 budget, so new life must be instanced and pooled.

Judging from current evidence, not intention: **Art** and **Theme** are the weak categories because connection does not look like life. **Gameplay** improved once the full path was visible, but the hunt still arrives before the hopeful act has a chance to exist.

### What we are building

One denser Breaker's Reach, not a bigger campaign.

- **Story spacing.** Short intro, then one line per beat, with time to look at the world that just changed.
- **Prosperity that grows.** Different routes, different ships, buildings, industry, houses, people. Life flows along live links and retreats when the Warden cuts them.
- **Scale.** More planet stance, deeper zoom-in, wider zoom-out, a visibly smaller Runner.
- **Alive surfaces.** The Runner walks. Other characters walk. Cultures stay distinct.
- **Hope, then range, then the Warden.** Connect the inner neighbourhood, think it is easy, unlock further travel, link a visible system, then introduce pursuit while outer worlds still remain as choices.

### What we will not do

- Add a second sector, a procedural universe or several shallow chapters.
- Turn circumference walking into free-roam platforming, dialogue trees, health, inventories or ship stat upgrades.
- Advance the Warden on wall-clock time, story-card reading or Scout zoom.
- Delay the Warden until the whole map is already solved; the hunt still needs expand-versus-defend space.
- Replace the shared 120 Hz simulation, Breaker Burn contract, one-pointer controls or planet-wrapping liberation wave.
- Ship this as one unplayable mega-change. `main` stays playable at every checkpoint.

### Range unlock, precisely

Range is the silence receding, not the Orbitbreaker levelling up.

After Haven, Ember and Grove are all live:

- the stillness veil on Tide, Frost, Bastion and Command recedes;
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
- They remain orbital-plane extras: short patrols, gathering at docks when a ship arrives, hiding under suppression.
- No named NPCs, no conversation graph, no quest markers.

### Story UI, precisely

- Opening uses a four-page board. Later beats reuse that board: first answer, second voice, range, neighbourhood, Warden arrival, circuit, suppression, recapture, Command, lost run.
- The player dismisses with Continue/Skip. Keyboard Enter/Space continue; Escape skips the current beat.
- Liberation still plays the wrapping wave under the board. Do not immediately replace it with hunt coaching.
- Coach copy between boards stays one sentence. Controls appear when the verb is available (Break in flight, Cut after the first live link, Scout when the veil recedes).
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

The prosperity kit from Linked through Circuit. Extraction is gone. Trade hulls are culture-true and travel both ways. Houses and workshops replace pits. The same people who were held now walk the rim.

Suppression slams a living world back to Tyrant without deleting its canonical route. Recapture plays Isolated then Living again as the first restored link relights.

### Checkpoint sequence

Implement in this order. Each checkpoint is one coherent commit, with `npm test`, `npm run check` and a desktop plus portrait pass.

1. **Tyrant / isolated / living contrast, plus a tiny Runner.** Occupied worlds show mines, fumes, guards, held people and outbound extraction. Haven stays the quiet garden. Shrink Runner/ship visuals, closer landed follow, deeper zoom-in. Physics identity unchanged.
2. **Opening purpose and spaced beats.** Two-card intro; one-line coaches; no hunt promise before hope.
3. **Walk and denser crowd.** Runner walk cycle; more culture silhouettes. Still circumference-only.
4. **First prosperity jump.** New links grow houses/windows and a culture-true ship instead of one cone.
5. **Busy routes.** Degree 2 and circuits add offset lanes, a second hull and industry. Prove 390×844.
6. **Hopeful act and range veil.** Inner cluster recedes the outer veil and raises Scout zoom-out. Warden reveals only after one further landing. Update pursuit tests and golden replays.
7. **Sound and breathing room.** Distinct dock, crowd, mine and lane layers; hold the camera on the change before handing control back.
8. **Stance retune if needed.** Larger world radii and well restance only if zoom and shrink were not enough. New `contentVersion`, new goldens, same verbs.

Checkpoints 2–7 are in the playable Breaker's Reach build (`breaker-reach-6`). Checkpoint 8 was skipped: the 0.52 Runner and landed follow already make the courier a visitor, so radii and wells were not restanced.

Stop conditions:

- If extra props blow the mobile frame or the 190-call budget, instance harder or raise the budget only with measured 390×844 evidence.
- If walking becomes busywork, keep the cycle but do not add surface destinations.
- If delaying the Warden makes the run aimless, reveal after the first further landing, not after the whole outer Reach.

### Success for this plan

A still frame of three linked worlds shows different buildings, different ships and people in motion. A new player can say what they are doing before the Warden speaks again. The Runner looks like a visitor on a tiny world, not the largest object on it. The hunt still starts with unused worlds left to save or score.

### Still missing, on purpose of remaining time not a freeze

GitHub Pages being static does not mean the campaign stays quiet. These are the next ambitious layers, in roughly this order, while `main` stays playable:

1. **Second Break.** Neighbourhood gift and hunt extra-Break boon. Schema bump, replay recorder/validator, and golden rewrite only for that checkpoint.
2. **External voices and image APIs.** ElevenLabs / Gemini can replace in-engine voices and generate more portraits when keys are supplied. They will not live in this repo and they are not required for the authored boards to exist.

Do not treat a toast, a HUD chip or a one-line coach as the delivery of those beats.

## Run unlocks (next)

Do not add a permanent meta-upgrade tree, random infinite runs or a second combat game. Unlocks should be a short authored ladder inside one Breaker's Reach run, earned on resolved flights and visible on the ship, then gone on reset.

Proposed ladder, earliest first:

1. **Break** — already the first flight verb. Directed drag is the tutorial unlock; heading Space remains the accessible fallback.
2. **Longer prediction** — after the first live link the committed chain stays on the map 1.7s; reduced motion skips the hold.
3. **Cut** — Ember keeps one leftover tooth after the first live link. Same drag, earlier in the run. Bastion and Command keep the full cage.
4. **Second Break** — only after the neighbourhood is talking, still one at a time, still recorded. Never a spray. Ranked schema bump still required.
5. **Circuit beacon** — after the first loop, a visible gold ghost of the next closing edge. Information, not an auto-aim.
6. **Command lock** — after both shields crack, keyboard/pointer lead on the moving crown. Finale gift only.

Roguelike flavour without roguelike chaos: after the Warden arrives, a once-per-run recapture Cut on a silenced world that has no authored cage. Extra Break stays deferred so ranked flights keep one recorded burn. The map, wells and ranked physics stay authored. Score still cannot reward waiting. No HP, no loot, no ship stats that persist between runs.

## Scope

The first complete target is one dense authored sector with approximately six to nine worlds, one Warden and one final confrontation. Existing campaign worlds are a content library and compatibility fixture; only the strongest silhouettes and encounters should survive the redesign.

Additional sectors, selectable modules, more Wardens and the super-AI network are future expansion. Infinite procedural space, free-roaming planet surfaces, conventional combat, inventory and permanent numerical upgrades are outside the first complete version.

## Success criteria

- A new player understands that connection helps worlds, sees those worlds prosper, then understands why the Warden arrives.
- Walking changes launch geometry without feeling like busywork.
- Breaker Burn turns flight from waiting into a meaningful timing decision.
- The Warden's next move is always understandable and creates a defend-versus-expand choice.
- The first recapture feels sad but fair, reversible and mechanically useful.
- At least two viable routes exist: a safer network and a harder high-score route.
- The final encounter tests existing skills rather than introducing a new genre.
- A completed run tells a coherent story without a cutscene.
- Desktop and portrait-mobile play remain reliable, readable and replayable.
