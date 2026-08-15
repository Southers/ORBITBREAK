/** Current prologue authored through the same contract future systems will use. */

export const FirstLightSystemDefinition = {
  id: 'first-light',
  contentVersion: 'migration-1',
  label: 'FIRST LIGHT',
  launchBudget: 8,
  openingBody: 'The Runner has eight launches. Pull away from a gold ring, then release.',
  completion: {
    eyebrow: 'FIRST LIGHT LIBERATED',
    title: 'The command signal is broken.',
    perfectTitle: 'First Light is completely free.',
    body: 'The Runner banks this route. Return to free more worlds whenever you like.',
    perfectBody: 'Every world and every arc now shines outside the Stillness.',
  },
  constellation: {
    nodes: [
      { id: 'meadow', label: 'Meadow', x: 24, y: 70 },
      { id: 'grove', label: 'Grove', x: 64, y: 32 },
      { id: 'frost', label: 'Frost', x: 120, y: 18 },
      { id: 'tide', label: 'Tide', x: 184, y: 30 },
      { id: 'ember', label: 'Ember', x: 118, y: 70 },
      { id: 'worldheart', label: 'Command', x: 214, y: 68, isHeart: true },
    ],
    edges: [
      ['meadow', 'grove'], ['grove', 'frost'], ['frost', 'tide'],
      ['tide', 'worldheart'], ['meadow', 'ember'], ['ember', 'tide'],
      ['grove', 'ember'],
    ],
  },
  startingWorldIdentifier: 'meadow',
  openingGuideTargetIdentifier: 'ember',
  innerClusterWorldIdentifiers: ['meadow', 'ember', 'grove'],
  furtherReachWorldIdentifiers: ['tide', 'frost'],
  worldheartUnlockThreshold: 3,
  routeSuggestions: {
    meadow: ['grove', 'ember'],
    grove: ['frost', 'ember'],
    ember: ['tide', 'frost'],
    frost: ['worldheart', 'tide', 'grove'],
    tide: ['worldheart', 'frost', 'ember'],
    seedstone: ['ember', 'grove'],
  },
  worlds: [
    {
      id: 'meadow', label: 'MEADOW', visualKey: 'meadow',
      position: { x: -8, y: -6.4, z: 0 }, radius: 3.35, gravitationalParameter: 92,
      slingshotValue: 350, liberationValue: 1000,
      aliveColor: 0x5f9b63, atmosphereColor: 0x9bcfb4, initiallyRestored: true,
      memory: 'The first free signal crosses the rain.',
      restoration: {
        durationSeconds: 2.2, waveWidth: 0.045, growthTrailWidth: 0.18,
        waveColor: 0xe8ffc5, atmosphereOpacity: 0.15, rotationSpeed: 0.00035,
        surfaceVariation: 0.1,
      },
    },
    {
      id: 'ember', label: 'EMBER', visualKey: 'ember',
      position: { x: 7.8, y: -3.3, z: 0 }, radius: 3, gravitationalParameter: 82,
      slingshotValue: 450, liberationValue: 1000,
      aliveColor: 0xc47a46, atmosphereColor: 0xffbe78, initiallyRestored: false,
      memory: 'One hidden spark answers the Runner.',
      restoration: {
        durationSeconds: 2.35, waveWidth: 0.05, growthTrailWidth: 0.18,
        waveColor: 0xffdfa1, atmosphereOpacity: 0.16, rotationSpeed: 0.00125,
        surfaceVariation: 0.045,
      },
    },
    {
      id: 'grove', label: 'GROVE', visualKey: 'grove',
      position: { x: -8.8, y: 3, z: 0 }, radius: 2.05, gravitationalParameter: 44,
      slingshotValue: 300, liberationValue: 1000,
      aliveColor: 0x78aa66, atmosphereColor: 0xb7e5a4, accentColor: 0xc6e886,
      initiallyRestored: false, isPrototypeWorld: true, biomeStyle: 1,
      memory: 'The roots were still holding hands.',
      restoration: {
        durationSeconds: 1.85, waveWidth: 0.055, growthTrailWidth: 0.2,
        waveColor: 0xddffbc, atmosphereOpacity: 0, rotationSpeed: 0.0007,
        surfaceVariation: 0.08,
      },
    },
    {
      id: 'frost', label: 'FROST', visualKey: 'frost',
      position: { x: 0.7, y: 8, z: 0 }, radius: 3.55, gravitationalParameter: 102,
      slingshotValue: 700, liberationValue: 1000,
      aliveColor: 0x81b6c9, atmosphereColor: 0xbbe8f5, initiallyRestored: false,
      memory: 'Under the ice, the old ocean was still dreaming.',
      restoration: {
        durationSeconds: 2.65, waveWidth: 0.042, growthTrailWidth: 0.2,
        waveColor: 0xe4fbff, atmosphereOpacity: 0.18, rotationSpeed: 0.001,
        surfaceVariation: 0.035,
      },
    },
    {
      id: 'tide', label: 'TIDE', visualKey: 'tide',
      position: { x: 9.7, y: 6, z: 0 }, radius: 2.15, gravitationalParameter: 48,
      slingshotValue: 400, liberationValue: 1000,
      aliveColor: 0x4d91aa, atmosphereColor: 0x9ce7ef, accentColor: 0x9de9df,
      initiallyRestored: false, isPrototypeWorld: true, biomeStyle: 2,
      memory: 'The moon-pulled water found its rhythm.',
      restoration: {
        durationSeconds: 1.95, waveWidth: 0.052, growthTrailWidth: 0.2,
        waveColor: 0xb9fbff, atmosphereOpacity: 0, rotationSpeed: 0.00085,
        surfaceVariation: 0.06,
      },
    },
  ],
  tacticalBodies: [
    {
      id: 'seedstone', label: 'SEEDSTONE', kind: 'seedstone',
      position: { x: 0.15, y: -0.55, z: 0 }, radius: 0.72, uses: 1,
      initiallyRestored: true, countsTowardRestoration: false,
    },
    {
      id: 'wayfarer', label: 'WAYFARER', kind: 'hazard', radius: 0.66,
      countsTowardRestoration: false,
      orbit: {
        centre: { x: 0.7, y: 8, z: 0 }, radius: 5.35,
        phaseRadians: -1.18, angularSpeedRadiansPerSecond: 0.34,
      },
    },
    {
      id: 'worldheart', label: 'COMMAND WORLD', kind: 'worldheart',
      position: { x: -4.35, y: 8.75, z: 0 }, radius: 0.9,
      initiallyRestored: false, countsTowardRestoration: false,
      isRouteDestination: true, routeAvailableInitially: false,
    },
  ],
  stardust: [
    { id: 'first-light-arc-1', position: { x: -1.56, y: -2.72, z: 0 } },
    { id: 'first-light-arc-2', position: { x: -1.2, y: -0.45, z: 0 } },
    { id: 'first-light-arc-3', position: { x: -0.99, y: 1.45, z: 0 } },
  ],
};

