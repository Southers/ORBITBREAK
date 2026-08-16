import { FirstLightSystemDefinition } from './first-light.js';

/** ORBITBREAK's first score-attack arena, spanning several camera views. */
export const BreakerReachSystemDefinition = {
  id: 'breaker-reach',
  contentVersion: 'breaker-reach-7',
  label: "BREAKER'S REACH",
  launchBudget: 10,
  circuitBonusValue: 1250,
  wardenVictoryValuePerStep: 1000,
  openingBroadcast: 'WARDEN BROADCAST · TRAVEL IS FORBIDDEN · SILENCE KEEPS YOU SAFE',
  wardenArrivalBroadcast: 'WARDEN BROADCAST · CONNECTION IS DISORDER · MOVEMENT IS DISOBEDIENCE',
  openingBody: 'They are still out there. Carry the first word.',
  openingBriefing: [
    {
      speaker: 'THE WARDEN',
      kicker: 'SECTOR BROADCAST',
      portrait: 'warden',
      title: 'Travel is forbidden.',
      body: 'Silence keeps you safe. Stay on your world. Connection is disorder. Movement is disobedience.',
    },
    {
      speaker: 'THE RUNNER',
      kicker: 'STOLEN COURIER',
      portrait: 'runner',
      title: 'I stole the last ship.',
      body: 'I am a maintenance astronaut. This is the Orbitbreaker, the forbidden courier that can cross their isolation cages.',
    },
    {
      speaker: 'HAVEN',
      kicker: "BREAKER'S REACH",
      portrait: 'haven',
      title: 'They are still out there.',
      body: 'Haven is the last free garden. Ember, Grove and the rest sit dark, mined and silent. Carry the first word before the Warden notices.',
    },
    {
      speaker: 'THE RUN',
      kicker: 'YOUR CHARGE',
      portrait: 'orbitbreaker',
      title: 'Wake the neighbourhood.',
      body: 'Land. Link. Watch tiny worlds come alive. When the Reach starts talking, the Warden will hunt. Close the loops. Break Command.',
    },
  ],
  storyBoards: {
    firstAnswer: {
      skipLabel: 'Keep flying',
      continueLabel: 'Carry the word',
      pages: [
        {
          speaker: 'EMBER',
          kicker: 'FIRST ANSWER',
          portrait: 'ember',
          title: 'Is someone there?',
          body: 'The furnaces remember who they warmed. A barge lights its first legal hold. The garden is no longer speaking into silence.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'THE WORD CARRIES',
          portrait: 'runner',
          title: 'They heard us.',
          body: 'One more neighbour and this garden is a neighbourhood. Walk, aim, land. Watch them wake.',
        },
      ],
    },
    secondAnswer: {
      skipLabel: 'Keep flying',
      continueLabel: 'Wake the third',
      pages: [
        {
          speaker: 'GROVE',
          kicker: 'SECOND VOICE',
          portrait: 'grove',
          title: 'We thought we were alone.',
          body: 'Roots split the perfect grid from below. Two worlds are talking. Trade is trying to remember how.',
        },
        {
          speaker: 'HAVEN',
          kicker: 'THE GARDEN ANSWERS',
          portrait: 'haven',
          title: 'Keep going.',
          body: 'When three gardens talk, the silence looks smaller. The Warden called this empty. It is not.',
        },
      ],
    },
    rangeUnlock: {
      skipLabel: 'Scout further',
      continueLabel: 'Look further',
      pages: [
        {
          speaker: 'THE RUN',
          kicker: 'THE SILENCE RECEEDS',
          portrait: 'orbitbreaker',
          title: 'The dark is not as wide as they said.',
          body: 'Spindle, Quarry, Mirage, Frost, Tide and Bastion were always there. The veil was a story. Scout the wider Reach.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'RANGE',
          portrait: 'runner',
          title: 'It was a lie.',
          body: 'Go further. Link a visible system. It will look easy. That is when the hunt starts.',
        },
      ],
    },
    neighbourhood: {
      skipLabel: 'Keep flying',
      continueLabel: 'Hold this feeling',
      pages: [
        {
          speaker: 'THE NETWORK',
          kicker: 'A SYSTEM',
          portrait: 'haven',
          title: 'A whole neighbourhood is talking.',
          body: 'Windows are lit. Hulls are moving. For a moment the Reach looks like it can stay this way.',
        },
      ],
    },
    firstTide: {
      skipLabel: 'Keep flying',
      continueLabel: 'Listen to the water',
      pages: [
        {
          speaker: 'TIDE',
          kicker: 'SALT ANSWERS',
          portrait: 'tide',
          title: 'The water refuses its ordered orbit.',
          body: 'Jetties remember boats. The haul is gone. We will carry word the way the tide always did.',
        },
      ],
    },
    firstFrost: {
      skipLabel: 'Keep flying',
      continueLabel: 'Keep the ice talking',
      pages: [
        {
          speaker: 'FROST',
          kicker: 'UNDER THE CRUST',
          portrait: 'frost',
          title: 'A giant ocean turns beneath the ice.',
          body: 'The drills are quiet. Sled-skiffs wait on the rim. We were never a still world.',
        },
      ],
    },
    firstBastion: {
      skipLabel: 'Keep flying',
      continueLabel: 'Destroy if you must',
      pages: [
        {
          speaker: 'BASTION',
          kicker: 'WATCH OPENS',
          portrait: 'bastion',
          title: 'The battery stands down.',
          body: 'Courier spines remember the legal roads. Walk the rim. Destroy what still cages the launch.',
        },
      ],
    },
    firstSpindle: {
      skipLabel: 'Keep flying',
      continueLabel: 'Follow the thread',
      pages: [
        {
          speaker: 'THE NETWORK',
          kicker: 'WEST LOOM',
          portrait: 'haven',
          title: 'The looms take a legal warp.',
          body: 'Spindle kept weaving isolation cages. One live thread and the pattern remembers neighbours.',
        },
      ],
    },
    firstQuarry: {
      skipLabel: 'Keep flying',
      continueLabel: 'Take the stone home',
      pages: [
        {
          speaker: 'THE RUN',
          kicker: 'SOUTH PIT',
          portrait: 'orbitbreaker',
          title: 'The haul turns around.',
          body: 'Quarry stopped feeding Command. The stone will build houses, not cages.',
        },
      ],
    },
    firstMirage: {
      skipLabel: 'Keep flying',
      continueLabel: 'Read the glass',
      pages: [
        {
          speaker: 'THE RUNNER',
          kicker: 'NORTH GLASS',
          portrait: 'runner',
          title: 'Command is a reflection.',
          body: 'Mirage shows the moving crown. Two loops still crack it. The glass was never empty.',
        },
      ],
    },
    wardenArrival: {
      skipLabel: 'Face the hunt',
      continueLabel: 'Outrun it',
      pages: [
        {
          speaker: 'THE WARDEN',
          kicker: 'UNAUTHORISED NETWORK',
          portrait: 'warden',
          title: 'Unauthorised network detected.',
          body: 'Connection is disorder. Movement is disobedience. I will silence every world that answers.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'THE HUNT BEGINS',
          portrait: 'runner',
          title: 'It found us.',
          body: 'It will take the weakest linked world. Close a loop and push it back, or expand and risk the cage.',
        },
      ],
    },
    circuitClosed: {
      skipLabel: 'Keep flying',
      continueLabel: 'Hold or expand',
      pages: [
        {
          speaker: 'THE NETWORK',
          kicker: 'LOOP CLOSED',
          portrait: 'haven',
          title: 'The signal went around.',
          body: 'This loop cannot be silenced at one choke. The Warden was pushed back. One shield cracked.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'RESISTANCE',
          portrait: 'runner',
          title: 'We can defend this.',
          body: 'Gold means protected. Spend the retreat on another world, or close the second loop and crack the crown.',
        },
      ],
    },
    suppression: {
      skipLabel: 'Keep flying',
      continueLabel: 'Go back for them',
      pages: [
        {
          speaker: 'THE WARDEN',
          kicker: 'SIGNAL LOST',
          portrait: 'warden',
          title: 'Silence restored.',
          body: 'They took {world}. The cage is back. Mines first. People last.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'STILL THERE',
          portrait: 'runner',
          title: 'Land there again.',
          body: 'The route remembers. Recapture {world} before the hunt walks closer.',
        },
      ],
    },
    recapture: {
      skipLabel: 'Keep flying',
      continueLabel: 'Stay with them',
      pages: [
        {
          speaker: 'THE NETWORK',
          kicker: 'SIGNAL RESTORED',
          portrait: 'ember',
          title: "We're still here.",
          body: '{world} answers again. The original route and courier are live. The cage failed twice.',
        },
      ],
    },
    commandExposed: {
      skipLabel: 'Board Command',
      continueLabel: 'Hunt the crown',
      pages: [
        {
          speaker: 'COMMAND',
          kicker: 'CROWN CRACKED',
          portrait: 'command',
          title: 'Two loops hit the hull.',
          body: 'The shield moons are gone. The Command World is a moving tiny world now, not a voice from the dark.',
        },
        {
          speaker: 'THE RUN',
          kicker: 'YOUR CHARGE',
          portrait: 'orbitbreaker',
          title: 'A network cannot be imprisoned.',
          body: 'Track it. Land. Walk the rim. Destroy the cage. The Reach will answer together.',
        },
      ],
    },
    commandApproach: {
      skipLabel: 'Destroy the cage',
      continueLabel: 'Walk the rim',
      pages: [
        {
          speaker: 'COMMAND',
          kicker: 'CORE LATTICE',
          portrait: 'command',
          title: 'You are on the crown.',
          body: 'Grab the ship. Drag through the bars. One swipe is enough. Do not make this a second war.',
        },
      ],
    },
    reachAnswers: {
      skipLabel: 'See the route',
      continueLabel: 'Bank the route',
      pages: [
        {
          speaker: 'THE NETWORK',
          kicker: 'THE REACH ANSWERS',
          portrait: 'haven',
          title: 'You did not save them alone.',
          body: 'You reminded them they were never alone. The garden, the furnaces, the ice and the watch all speak at once.',
        },
      ],
    },
    runLost: {
      skipLabel: 'Begin again',
      continueLabel: 'Steal the ship again',
      pages: [
        {
          speaker: 'THE WARDEN',
          kicker: 'THE STILLNESS CLOSES',
          portrait: 'warden',
          title: 'You were one world too slow.',
          body: 'Isolation is safety. Connection is a fault I have closed.',
        },
        {
          speaker: 'THE RUNNER',
          kicker: 'NOT FINISHED',
          portrait: 'runner',
          title: 'Steal the ship again.',
          body: 'Haven is still a garden. The first word is still yours to carry.',
        },
      ],
    },
  },
  rangeUnlockLine: 'The dark is not as wide as they said.',
  furtherLandingLine: 'A whole neighbourhood is talking.',
  commandApproachLine: 'A network cannot be imprisoned.',
  camera: {
    followPlayer: true,
    viewportWorldHeight: 24,
    viewportWorldWidth: 20,
    outOfBoundsDistance: 88,
  },
  completion: {
    eyebrow: "BREAKER'S REACH LIBERATED",
    title: 'The first command signal is broken.',
    perfectTitle: 'Every signal in the Reach is free.',
    body: 'The Runner banks the route while the freed worlds answer one another.',
    perfectBody: 'The entire Reach shines beyond the Stillness.',
    endingReveal: 'You did not save them alone. You reminded them they were never alone.',
    expansionSting: 'WARDEN NODE DISCONNECTED · SECTOR WARDENS: 11',
    emblems: {
      heart: { title: 'COMMAND', subtitle: 'DEFEATED' },
      bloom: { title: 'SOLIDARITY', subtitle: 'ALL WORLDS' },
      arc: { title: 'WAYFINDER', subtitle: '3 STARDUST' },
    },
    continueToNextSystem: true,
  },
  constellation: {
    nodes: [
      { id: 'meadow', label: 'Haven', x: 36, y: 64 },
      { id: 'ember', label: 'Ember', x: 70, y: 82 },
      { id: 'grove', label: 'Grove', x: 108, y: 58 },
      { id: 'tide', label: 'Tide', x: 154, y: 46 },
      { id: 'frost', label: 'Frost', x: 70, y: 28 },
      { id: 'bastion', label: 'Bastion', x: 128, y: 20 },
      { id: 'spindle', label: 'Spindle', x: 12, y: 40 },
      { id: 'quarry', label: 'Quarry', x: 108, y: 92 },
      { id: 'mirage', label: 'Mirage', x: 176, y: 16 },
      { id: 'worldheart', label: 'Command', x: 218, y: 30, isHeart: true },
    ],
    edges: [
      ['meadow', 'ember'], ['ember', 'grove'], ['grove', 'tide'],
      ['meadow', 'frost'], ['frost', 'bastion'], ['bastion', 'tide'],
      ['meadow', 'spindle'], ['spindle', 'frost'],
      ['ember', 'quarry'], ['quarry', 'tide'],
      ['bastion', 'mirage'], ['tide', 'mirage'],
      ['tide', 'worldheart'], ['bastion', 'worldheart'], ['mirage', 'worldheart'],
    ],
  },
  startingWorldIdentifier: 'meadow',
  openingGuideTargetIdentifier: 'ember',
  innerClusterWorldIdentifiers: ['meadow', 'ember', 'grove'],
  furtherReachWorldIdentifiers: ['tide', 'frost', 'bastion', 'spindle', 'quarry', 'mirage'],
  worldheartUnlockThreshold: 3,
  commandWorldRequiresShieldBreaks: true,
  routeSuggestions: {
    meadow: ['ember', 'frost', 'spindle'],
    ember: ['grove', 'quarry'],
    grove: ['tide', 'bastion'],
    frost: ['bastion', 'spindle'],
    bastion: ['worldheart', 'mirage'],
    tide: ['worldheart', 'quarry'],
    spindle: ['frost', 'meadow'],
    quarry: ['ember', 'tide'],
    mirage: ['worldheart', 'bastion'],
    seedstone: ['bastion', 'grove'],
  },
  routeGuidance: {
    grove: {
      meadow: "Walk Grove's far rim, then aim back around Ember until the path locks Haven. The whole arc is on the map—hold it to close the gold loop.",
    },
    frost: {
      ember: 'Ember is the direct lock; Grove is the alternate arc. Either closes the second gold loop and exposes Command.',
    },
  },
  worlds: [
    {
      ...FirstLightSystemDefinition.worlds[0],
      label: 'HAVEN', position: { x: -22, y: -8, z: 0 }, gravitationalParameter: 105,
      occupationScarAngles: [-2.62, -2.42, -2.22],
      memory: 'The Runner leaves the last free garden behind.',
    },
    {
      ...FirstLightSystemDefinition.worlds[1],
      position: { x: -8, y: -13, z: 0 }, radius: 3.2, gravitationalParameter: 340,
      occupationScarAngles: [2.28, 2.5, 2.72, 2.94],
      hostileEncounter: {
        clampOffsetsRadians: [0.55],
        cutHitRadius: 0.48,
        maxCutLength: 2.85,
      },
      memory: 'The furnaces remember who they warmed.',
    },
    {
      ...FirstLightSystemDefinition.worlds[2],
      position: { x: 6, y: -4, z: 0 }, radius: 2.5, gravitationalParameter: 220,
      occupationScarAngles: [-0.58, -0.29, 0],
      memory: 'Roots split the perfect grid from below.',
    },
    {
      ...FirstLightSystemDefinition.worlds[4],
      position: { x: 18, y: 2, z: 0 }, radius: 2.8, gravitationalParameter: 240,
      occupationScarAngles: [1.18, 1.37, 1.56, 1.75],
      memory: 'The water refuses its ordered orbit.',
    },
    {
      ...FirstLightSystemDefinition.worlds[3],
      position: { x: -8, y: 11, z: 0 }, radius: 4.2, gravitationalParameter: 220,
      slingshotValue: 1000, liberationValue: 1400,
      occupationScarAngles: [-2.08, -1.9, -1.72],
      memory: 'A giant ocean turns beneath the ice.',
    },
    {
      id: 'bastion', label: 'BASTION', visualKey: 'vault',
      position: { x: 12, y: 14, z: 0 }, radius: 2.8, gravitationalParameter: 200,
      slingshotValue: 650, liberationValue: 1500,
      aliveColor: 0x746fa8, atmosphereColor: 0xb7b7ff, accentColor: 0xf2c1ff,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true,
      occupationScarAngles: [0.08, 0.28, 0.48],
      disposition: 'hostile',
      hostileEncounter: {
        clampOffsetsRadians: [0.4, 0.85, 1.3],
        cutHitRadius: 0.48,
        maxCutLength: 2.85,
      },
      memory: 'The watchtowers turn their lights away from the Command World.',
      restoration: {
        durationSeconds: 2.25, waveWidth: 0.048, growthTrailWidth: 0.19,
        waveColor: 0xf1d4ff, atmosphereOpacity: 0, rotationSpeed: 0.0008,
        surfaceVariation: 0.055,
      },
    },
    {
      id: 'spindle', label: 'SPINDLE', visualKey: 'loom',
      position: { x: -48, y: 18, z: 0 }, radius: 2.35, gravitationalParameter: 55,
      slingshotValue: 550, liberationValue: 1200,
      aliveColor: 0x789a7c, atmosphereColor: 0xb9e2c5, accentColor: 0xcfe89a,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      occupationScarAngles: [2.05, 2.28, 2.51],
      memory: 'The looms remember every route they were forbidden to weave.',
      restoration: {
        durationSeconds: 1.9, waveWidth: 0.055, growthTrailWidth: 0.2,
        waveColor: 0xe4f8bd, atmosphereOpacity: 0, rotationSpeed: 0.00065,
        surfaceVariation: 0.09,
      },
    },
    {
      id: 'quarry', label: 'QUARRY', visualKey: 'kiln',
      position: { x: 8, y: -38, z: 0 }, radius: 2.7, gravitationalParameter: 68,
      slingshotValue: 700, liberationValue: 1300,
      aliveColor: 0xb76545, atmosphereColor: 0xffad72, accentColor: 0xffcf76,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      occupationScarAngles: [-1.15, -0.92, -0.69],
      memory: 'The pit stops sending stone to Command and starts sending it home.',
      restoration: {
        durationSeconds: 2.3, waveWidth: 0.048, growthTrailWidth: 0.18,
        waveColor: 0xffd9a0, atmosphereOpacity: 0, rotationSpeed: 0.00115,
        surfaceVariation: 0.05,
      },
    },
    {
      id: 'mirage', label: 'MIRAGE', visualKey: 'shard',
      position: { x: 48, y: 34, z: 0 }, radius: 3.1, gravitationalParameter: 84,
      slingshotValue: 900, liberationValue: 1600,
      aliveColor: 0x7085a8, atmosphereColor: 0xb9cdf9, accentColor: 0xd8e5ff,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      occupationScarAngles: [0.72, 0.94, 1.16, 1.38],
      memory: 'The glass shows the moving crown instead of an empty sky.',
      restoration: {
        durationSeconds: 2.4, waveWidth: 0.044, growthTrailWidth: 0.2,
        waveColor: 0xe9f2ff, atmosphereOpacity: 0, rotationSpeed: 0.0009,
        surfaceVariation: 0.04,
      },
    },
  ],
  tacticalBodies: [
    {
      ...FirstLightSystemDefinition.tacticalBodies[0],
      position: { x: 2, y: 2.5, z: 0 },
    },
    {
      ...FirstLightSystemDefinition.tacticalBodies[1],
      orbit: {
        centre: { x: 18, y: 2, z: 0 }, radius: 7,
        phaseRadians: -1.05, angularSpeedRadiansPerSecond: 0.28,
      },
    },
    {
      ...FirstLightSystemDefinition.tacticalBodies[2],
      position: { x: 28, y: 8, z: 0 },
      orbit: {
        centre: { x: 24, y: 8, z: 0 }, radius: 4,
        phaseRadians: 0, angularSpeedRadiansPerSecond: 0.08,
      },
      hostileEncounter: {
        clampOffsetsRadians: [0.35, 0.75, 1.2],
        cutHitRadius: 0.5,
        maxCutLength: 2.7,
      },
    },
  ],
  stardust: [
    { id: 'breaker-arc-1', position: { x: -16, y: -1, z: 0 } },
    { id: 'breaker-arc-2', position: { x: -14, y: 4, z: 0 } },
    { id: 'breaker-arc-3', position: { x: -6, y: 10, z: 0 } },
  ],
};

