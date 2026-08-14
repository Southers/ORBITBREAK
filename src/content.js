/**
 * Pure authored-system data and validation.
 *
 * Runtime factories inject vectors and colours so this module stays testable without WebGL.
 * Mutable play state is always cloned from these definitions.
 */

const RequiredRestorationNumbers = [
  'durationSeconds',
  'waveWidth',
  'growthTrailWidth',
  'atmosphereOpacity',
  'rotationSpeed',
  'surfaceVariation',
];
const SupportedTacticalBodyKinds = new Set(['seedstone', 'hazard', 'worldheart']);
const DefaultEnvironmentDefinition = {
  backgroundColor: 0x06101a,
  fogColor: 0x06101a,
  fogDensity: 0.012,
  hemisphereSkyColor: 0xa9c6d8,
  hemisphereGroundColor: 0x17212a,
  keyLightColor: 0xfff4dc,
  fillLightColor: 0x7aa3d1,
  rimLightColor: 0x83d7ff,
  toneMappingExposure: 1.15,
};

function isFiniteVector(VectorValue) {
  return VectorValue
    && Number.isFinite(VectorValue.x)
    && Number.isFinite(VectorValue.y)
    && Number.isFinite(VectorValue.z);
}

function isColorValue(ColorValue) {
  return Number.isInteger(ColorValue) && ColorValue >= 0 && ColorValue <= 0xffffff;
}

function addDuplicateIdentifierErrors(Definitions, DefinitionType, SeenIdentifiers, Errors) {
  for (const Definition of Definitions) {
    if (!Definition?.id || typeof Definition.id !== 'string') {
      Errors.push(`${DefinitionType} requires a string id.`);
      continue;
    }
    if (SeenIdentifiers.has(Definition.id)) {
      Errors.push(`Duplicate authored identifier: ${Definition.id}.`);
    }
    SeenIdentifiers.add(Definition.id);
  }
}

/** Returns every authoring error without mutating or partially instantiating the system. */
export function validateAuthoredSystemDefinition(SystemDefinition) {
  const Errors = [];
  if (!SystemDefinition || typeof SystemDefinition !== 'object') {
    return ['Authored system must be an object.'];
  }

  if (!SystemDefinition.id || typeof SystemDefinition.id !== 'string') {
    Errors.push('Authored system requires a string id.');
  }
  if (!SystemDefinition.label || typeof SystemDefinition.label !== 'string') {
    Errors.push('Authored system requires a display label.');
  }
  if (!SystemDefinition.openingBody || typeof SystemDefinition.openingBody !== 'string') {
    Errors.push('Authored system requires openingBody story copy.');
  }
  if (!Number.isInteger(SystemDefinition.launchBudget) || SystemDefinition.launchBudget < 1) {
    Errors.push('Authored system requires a positive integer launchBudget.');
  }
  if (SystemDefinition.environment) {
    for (const ColorField of [
      'backgroundColor', 'fogColor', 'hemisphereSkyColor', 'hemisphereGroundColor',
      'keyLightColor', 'fillLightColor', 'rimLightColor',
    ]) {
      if (!isColorValue(SystemDefinition.environment[ColorField])) {
        Errors.push(`Authored system environment.${ColorField} requires a colour integer.`);
      }
    }
    if (
      !(SystemDefinition.environment.fogDensity >= 0)
      || !(SystemDefinition.environment.fogDensity <= 0.05)
      || !(SystemDefinition.environment.toneMappingExposure > 0.5)
      || !(SystemDefinition.environment.toneMappingExposure <= 2)
    ) {
      Errors.push('Authored system environment has invalid fog or exposure ranges.');
    }
  }
  if (SystemDefinition.finale) {
    if (SystemDefinition.finale.isCampaignFinale !== true) {
      Errors.push('Authored finale must declare isCampaignFinale.');
    }
    if (
      !(SystemDefinition.finale.victoryDelaySeconds >= 1.5)
      || !(SystemDefinition.finale.victoryDelaySeconds <= 6)
      || !isColorValue(SystemDefinition.finale.pulseColor)
      || !isColorValue(SystemDefinition.finale.awakenedBackgroundColor)
    ) {
      Errors.push('Authored finale has invalid timing or colour data.');
    }
  }
  const CompletionDefinition = SystemDefinition.completion;
  for (const CompletionField of [
    'eyebrow', 'title', 'perfectTitle', 'body', 'perfectBody',
  ]) {
    if (!CompletionDefinition?.[CompletionField]) {
      Errors.push(`Authored system completion.${CompletionField} is required.`);
    }
  }

  const WorldDefinitions = Array.isArray(SystemDefinition.worlds)
    ? SystemDefinition.worlds
    : [];
  const TacticalBodyDefinitions = Array.isArray(SystemDefinition.tacticalBodies)
    ? SystemDefinition.tacticalBodies
    : [];
  const StardustDefinitions = Array.isArray(SystemDefinition.stardust)
    ? SystemDefinition.stardust
    : [];
  if (WorldDefinitions.length < 3) {
    Errors.push('Authored system requires a starting world and at least two destinations.');
  }

  const SeenIdentifiers = new Set();
  addDuplicateIdentifierErrors(WorldDefinitions, 'World', SeenIdentifiers, Errors);
  addDuplicateIdentifierErrors(TacticalBodyDefinitions, 'Tactical body', SeenIdentifiers, Errors);
  addDuplicateIdentifierErrors(StardustDefinitions, 'Stardust pickup', SeenIdentifiers, Errors);

  const StartingWorldDefinition = WorldDefinitions.find(
    (WorldDefinition) => WorldDefinition.id === SystemDefinition.startingWorldIdentifier,
  );
  if (!StartingWorldDefinition) {
    Errors.push('startingWorldIdentifier must reference an authored world.');
  } else if (StartingWorldDefinition.initiallyRestored !== true) {
    Errors.push('The starting world must be initially restored.');
  }

  const OpeningGuideTargetDefinition = WorldDefinitions.find(
    (WorldDefinition) => WorldDefinition.id === SystemDefinition.openingGuideTargetIdentifier,
  );
  if (!OpeningGuideTargetDefinition) {
    Errors.push('openingGuideTargetIdentifier must reference an authored world.');
  } else if (OpeningGuideTargetDefinition.id === SystemDefinition.startingWorldIdentifier) {
    Errors.push('The opening guide target must differ from the starting world.');
  }

  for (const WorldDefinition of WorldDefinitions) {
    if (!WorldDefinition.label || !isFiniteVector(WorldDefinition.position)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires a label and finite position.`);
    }
    if (!(WorldDefinition.radius > 0) || !(WorldDefinition.gravitationalParameter > 0)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires positive physics values.`);
    }
    if (
      WorldDefinition.slingshotValue !== undefined
      && (!Number.isInteger(WorldDefinition.slingshotValue) || WorldDefinition.slingshotValue < 1)
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has an invalid slingshotValue.`);
    }
    if (
      WorldDefinition.liberationValue !== undefined
      && (!Number.isInteger(WorldDefinition.liberationValue) || WorldDefinition.liberationValue < 1)
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has an invalid liberationValue.`);
    }
    if (!WorldDefinition.visualKey || typeof WorldDefinition.visualKey !== 'string') {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires a visualKey.`);
    }
    if (!WorldDefinition.memory || typeof WorldDefinition.memory !== 'string') {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires an awakening memory.`);
    }
    if (!isColorValue(WorldDefinition.aliveColor)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires an aliveColor integer.`);
    }
    if (!isColorValue(WorldDefinition.atmosphereColor)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires an atmosphereColor integer.`);
    }
    const RestorationDefinition = WorldDefinition.restoration;
    if (!RestorationDefinition || !isColorValue(RestorationDefinition.waveColor)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires restoration colour data.`);
      continue;
    }
    for (const NumberField of RequiredRestorationNumbers) {
      if (!Number.isFinite(RestorationDefinition[NumberField])) {
        Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} restoration.${NumberField} is required.`);
      }
    }
    if (
      !(RestorationDefinition.durationSeconds > 0)
      || !(RestorationDefinition.waveWidth > 0)
      || !(RestorationDefinition.growthTrailWidth > 0)
      || RestorationDefinition.atmosphereOpacity < 0
      || RestorationDefinition.atmosphereOpacity > 1
      || RestorationDefinition.surfaceVariation < 0
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has invalid restoration ranges.`);
    }
  }

  const ObjectiveWorldCount = WorldDefinitions.filter(
    (WorldDefinition) => WorldDefinition.id !== SystemDefinition.startingWorldIdentifier
      && WorldDefinition.countsTowardRestoration !== false,
  ).length;
  if (
    !Number.isInteger(SystemDefinition.worldheartUnlockThreshold)
    || SystemDefinition.worldheartUnlockThreshold < 1
    || SystemDefinition.worldheartUnlockThreshold > ObjectiveWorldCount
  ) {
    Errors.push('worldheartUnlockThreshold must fit the authored objective-world count.');
  }

  const WorldheartDefinitions = TacticalBodyDefinitions.filter(
    (BodyDefinition) => BodyDefinition.kind === 'worldheart',
  );
  const SeedstoneDefinitions = TacticalBodyDefinitions.filter(
    (BodyDefinition) => BodyDefinition.kind === 'seedstone',
  );
  const HazardDefinitions = TacticalBodyDefinitions.filter(
    (BodyDefinition) => BodyDefinition.kind === 'hazard',
  );
  if (WorldheartDefinitions.length !== 1) {
    Errors.push('Authored system requires exactly one Worldheart body.');
  }
  if (SeedstoneDefinitions.length !== 1) {
    Errors.push('Current authored-system runtime requires exactly one Seedstone body.');
  }
  if (HazardDefinitions.length !== 1) {
    Errors.push('Current authored-system runtime requires exactly one deterministic hazard.');
  }
  if (
    WorldheartDefinitions.length === 1
    && WorldheartDefinitions[0].isRouteDestination !== true
  ) {
    Errors.push('Worldheart must be authored as a physical route destination.');
  }

  for (const BodyDefinition of TacticalBodyDefinitions) {
    if (!SupportedTacticalBodyKinds.has(BodyDefinition.kind)) {
      Errors.push(`Tactical body ${BodyDefinition.id ?? '<unknown>'} has an unsupported kind.`);
    }
    if (!(BodyDefinition.radius > 0)) {
      Errors.push(`Tactical body ${BodyDefinition.id ?? '<unknown>'} requires a positive radius.`);
    }
    if (BodyDefinition.orbit && (
      !isFiniteVector(BodyDefinition.orbit.centre)
      || !(BodyDefinition.orbit.radius > 0)
      || !Number.isFinite(BodyDefinition.orbit.phaseRadians)
      || !Number.isFinite(BodyDefinition.orbit.angularSpeedRadiansPerSecond)
    )) {
      Errors.push(
        `Tactical body ${BodyDefinition.id ?? '<unknown>'} has an invalid deterministic orbit.`,
      );
    }
    if (BodyDefinition.kind === 'hazard' && !BodyDefinition.orbit) {
      Errors.push(`Hazard ${BodyDefinition.id ?? '<unknown>'} requires a deterministic orbit.`);
    }
    if (BodyDefinition.kind !== 'hazard' && !isFiniteVector(BodyDefinition.position)) {
      Errors.push(`Tactical body ${BodyDefinition.id ?? '<unknown>'} requires a finite position.`);
    }
    if (BodyDefinition.kind === 'seedstone' && !(BodyDefinition.uses > 0)) {
      Errors.push(`Seedstone ${BodyDefinition.id ?? '<unknown>'} requires at least one use.`);
    }
  }

  const RouteNodeIdentifiers = new Set([
    ...WorldDefinitions.map((WorldDefinition) => WorldDefinition.id),
    ...TacticalBodyDefinitions
      .filter((BodyDefinition) => BodyDefinition.kind !== 'hazard')
      .map((BodyDefinition) => BodyDefinition.id),
  ]);
  for (const [SourceIdentifier, TargetIdentifiers] of Object.entries(
    SystemDefinition.routeSuggestions ?? {},
  )) {
    if (!RouteNodeIdentifiers.has(SourceIdentifier)) {
      Errors.push(`Route source ${SourceIdentifier} does not exist.`);
    }
    if (!Array.isArray(TargetIdentifiers) || TargetIdentifiers.length === 0) {
      Errors.push(`Route source ${SourceIdentifier} requires at least one target.`);
      continue;
    }
    if (new Set(TargetIdentifiers).size !== TargetIdentifiers.length) {
      Errors.push(`Route source ${SourceIdentifier} contains duplicate targets.`);
    }
    for (const TargetIdentifier of TargetIdentifiers) {
      if (!RouteNodeIdentifiers.has(TargetIdentifier)) {
        Errors.push(`Route target ${TargetIdentifier} does not exist.`);
      }
      if (TargetIdentifier === SourceIdentifier) {
        Errors.push(`Route source ${SourceIdentifier} cannot target itself.`);
      }
    }
  }

  const OpeningSuggestions = SystemDefinition.routeSuggestions?.[
    SystemDefinition.startingWorldIdentifier
  ];
  if (!Array.isArray(OpeningSuggestions) || OpeningSuggestions.length < 2) {
    Errors.push('The starting world requires at least two authored route suggestions.');
  }

  for (const StardustDefinition of StardustDefinitions) {
    if (!isFiniteVector(StardustDefinition.position)) {
      Errors.push(`Stardust ${StardustDefinition.id ?? '<unknown>'} requires a finite position.`);
    }
  }

  const ConstellationDefinition = SystemDefinition.constellation;
  const ConstellationNodes = Array.isArray(ConstellationDefinition?.nodes)
    ? ConstellationDefinition.nodes
    : [];
  const ConstellationEdges = Array.isArray(ConstellationDefinition?.edges)
    ? ConstellationDefinition.edges
    : [];
  const ExpectedConstellationIdentifiers = new Set([
    ...WorldDefinitions.map((WorldDefinition) => WorldDefinition.id),
    ...WorldheartDefinitions.map((WorldheartDefinition) => WorldheartDefinition.id),
  ]);
  const ConstellationNodeIdentifiers = new Set();
  for (const ConstellationNode of ConstellationNodes) {
    if (ConstellationNodeIdentifiers.has(ConstellationNode.id)) {
      Errors.push(`Duplicate constellation node: ${ConstellationNode.id ?? '<unknown>'}.`);
    }
    if (!ExpectedConstellationIdentifiers.has(ConstellationNode.id)) {
      Errors.push(`Constellation node ${ConstellationNode.id ?? '<unknown>'} does not exist.`);
    }
    if (
      !Number.isFinite(ConstellationNode.x)
      || !Number.isFinite(ConstellationNode.y)
    ) {
      Errors.push(`Constellation node ${ConstellationNode.id ?? '<unknown>'} needs finite coordinates.`);
    }
    ConstellationNodeIdentifiers.add(ConstellationNode.id);
  }
  for (const ExpectedIdentifier of ExpectedConstellationIdentifiers) {
    if (!ConstellationNodeIdentifiers.has(ExpectedIdentifier)) {
      Errors.push(`Constellation is missing node ${ExpectedIdentifier}.`);
    }
  }
  for (const ConstellationEdge of ConstellationEdges) {
    if (
      !Array.isArray(ConstellationEdge)
      || ConstellationEdge.length !== 2
      || !ConstellationNodeIdentifiers.has(ConstellationEdge[0])
      || !ConstellationNodeIdentifiers.has(ConstellationEdge[1])
    ) {
      Errors.push('Constellation edges must reference two authored nodes.');
    }
  }

  return Errors;
}

/** Throws once with every authoring error so invalid content cannot silently reach gameplay. */
export function assertValidAuthoredSystemDefinition(SystemDefinition) {
  const Errors = validateAuthoredSystemDefinition(SystemDefinition);
  if (Errors.length > 0) {
    throw new Error(`Invalid authored system:\n- ${Errors.join('\n- ')}`);
  }
  return SystemDefinition;
}

function clonePosition(Position, CreateVector) {
  return CreateVector(Position.x, Position.y, Position.z);
}

/** Creates isolated mutable runtime state from one validated authored system. */
export function createAuthoredSystemRuntime(
  SystemDefinition,
  {
    createVector = (x = 0, y = 0, z = 0) => ({ x, y, z }),
    createColor = (ColorValue) => ColorValue,
  } = {},
) {
  assertValidAuthoredSystemDefinition(SystemDefinition);

  const Worlds = SystemDefinition.worlds.map((WorldDefinition) => ({
    ...WorldDefinition,
    position: clonePosition(WorldDefinition.position, createVector),
    aliveColor: createColor(WorldDefinition.aliveColor),
    atmosphereColor: createColor(WorldDefinition.atmosphereColor),
    accentColor: Number.isInteger(WorldDefinition.accentColor)
      ? createColor(WorldDefinition.accentColor)
      : undefined,
    restored: WorldDefinition.initiallyRestored === true,
    isStartingWorld: WorldDefinition.id === SystemDefinition.startingWorldIdentifier,
    restoration: {
      ...WorldDefinition.restoration,
      waveColor: createColor(WorldDefinition.restoration.waveColor),
    },
  }));

  const TacticalBodies = SystemDefinition.tacticalBodies.map((BodyDefinition) => ({
    ...BodyDefinition,
    position: BodyDefinition.position
      ? clonePosition(BodyDefinition.position, createVector)
      : undefined,
    orbit: BodyDefinition.orbit
      ? {
        ...BodyDefinition.orbit,
        centre: clonePosition(BodyDefinition.orbit.centre, createVector),
      }
      : undefined,
    restored: BodyDefinition.initiallyRestored === true,
    routeAvailable: BodyDefinition.routeAvailableInitially === true,
  }));
  const EnvironmentDefinition = {
    ...DefaultEnvironmentDefinition,
    ...SystemDefinition.environment,
  };

  return {
    id: SystemDefinition.id,
    label: SystemDefinition.label,
    openingBody: SystemDefinition.openingBody,
    environment: {
      ...EnvironmentDefinition,
      backgroundColor: createColor(EnvironmentDefinition.backgroundColor),
      fogColor: createColor(EnvironmentDefinition.fogColor),
      hemisphereSkyColor: createColor(EnvironmentDefinition.hemisphereSkyColor),
      hemisphereGroundColor: createColor(EnvironmentDefinition.hemisphereGroundColor),
      keyLightColor: createColor(EnvironmentDefinition.keyLightColor),
      fillLightColor: createColor(EnvironmentDefinition.fillLightColor),
      rimLightColor: createColor(EnvironmentDefinition.rimLightColor),
    },
    finale: SystemDefinition.finale
      ? {
        ...SystemDefinition.finale,
        pulseColor: createColor(SystemDefinition.finale.pulseColor),
        awakenedBackgroundColor: createColor(
          SystemDefinition.finale.awakenedBackgroundColor,
        ),
      }
      : null,
    completion: { ...SystemDefinition.completion },
    constellation: {
      nodes: SystemDefinition.constellation.nodes.map((NodeDefinition) => ({
        ...NodeDefinition,
      })),
      edges: SystemDefinition.constellation.edges.map((EdgeDefinition) => [
        ...EdgeDefinition,
      ]),
    },
    startingWorldIdentifier: SystemDefinition.startingWorldIdentifier,
    openingGuideTargetIdentifier: SystemDefinition.openingGuideTargetIdentifier,
    launchBudget: SystemDefinition.launchBudget,
    worldheartUnlockThreshold: SystemDefinition.worldheartUnlockThreshold,
    routeSuggestions: Object.fromEntries(Object.entries(SystemDefinition.routeSuggestions ?? {}).map(
      ([SourceIdentifier, TargetIdentifiers]) => [SourceIdentifier, [...TargetIdentifiers]],
    )),
    worlds: Worlds,
    tacticalBodies: TacticalBodies,
    stardust: (SystemDefinition.stardust ?? []).map((StardustDefinition) => ({
      ...StardustDefinition,
      position: clonePosition(StardustDefinition.position, createVector),
      collected: false,
    })),
  };
}

/** Current prologue authored through the same contract future systems will use. */
export const FirstLightSystemDefinition = {
  id: 'first-light',
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

/** The first full chapter: a fractured relay system held together by remembered routes. */
export const BrokenBeltSystemDefinition = {
  id: 'broken-belt',
  label: 'BROKEN BELT',
  launchBudget: 8,
  openingBody: 'The Belt is coming apart. Choose which lost signal to wake first.',
  completion: {
    eyebrow: 'THE BROKEN BELT HOLDS',
    title: 'The first lost system answers.',
    perfectTitle: 'Every broken signal is singing.',
    body: 'A repaired path points deeper into the dark. Return for the dim emblems whenever you like.',
    perfectBody: 'Every world and every arc now carries life across the Belt.',
  },
  constellation: {
    nodes: [
      { id: 'relay', label: 'Relay', x: 22, y: 72 },
      { id: 'loom', label: 'Loom', x: 58, y: 34 },
      { id: 'shard', label: 'Shard', x: 112, y: 16 },
      { id: 'drift', label: 'Drift', x: 174, y: 30 },
      { id: 'kiln', label: 'Kiln', x: 112, y: 72 },
      { id: 'vault', label: 'Vault', x: 94, y: 46 },
      { id: 'belt-heart', label: 'Belt Heart', x: 216, y: 68, isHeart: true },
    ],
    edges: [
      ['relay', 'loom'], ['relay', 'kiln'], ['loom', 'shard'],
      ['loom', 'vault'], ['kiln', 'vault'], ['kiln', 'drift'],
      ['vault', 'shard'], ['vault', 'drift'], ['shard', 'drift'],
      ['drift', 'belt-heart'], ['shard', 'belt-heart'],
    ],
  },
  startingWorldIdentifier: 'relay',
  openingGuideTargetIdentifier: 'kiln',
  worldheartUnlockThreshold: 3,
  routeSuggestions: {
    relay: ['loom', 'kiln'],
    loom: ['belt-heart', 'shard', 'vault', 'kiln'],
    kiln: ['belt-heart', 'drift', 'vault', 'shard'],
    vault: ['belt-heart', 'shard', 'drift', 'loom'],
    shard: ['belt-heart', 'drift', 'loom'],
    drift: ['belt-heart', 'shard', 'kiln'],
    splinter: ['kiln', 'vault'],
  },
  worlds: [
    {
      id: 'relay', label: 'RELAY', visualKey: 'relay',
      position: { x: -8, y: -6.4, z: 0 }, radius: 3.35, gravitationalParameter: 92,
      aliveColor: 0x658f84, atmosphereColor: 0xa7e1c7, accentColor: 0xf4dc8f,
      initiallyRestored: true, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'One relay had kept calling into the dark.',
      restoration: {
        durationSeconds: 2.2, waveWidth: 0.045, growthTrailWidth: 0.18,
        waveColor: 0xf6edbd, atmosphereOpacity: 0, rotationSpeed: 0.00045,
        surfaceVariation: 0.08,
      },
    },
    {
      id: 'kiln', label: 'KILN', visualKey: 'kiln',
      position: { x: 7.8, y: -3.3, z: 0 }, radius: 3, gravitationalParameter: 82,
      aliveColor: 0xb76545, atmosphereColor: 0xffad72, accentColor: 0xffcf76,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'The furnaces had guarded one patient coal.',
      restoration: {
        durationSeconds: 2.3, waveWidth: 0.048, growthTrailWidth: 0.18,
        waveColor: 0xffd9a0, atmosphereOpacity: 0, rotationSpeed: 0.00115,
        surfaceVariation: 0.05,
      },
    },
    {
      id: 'loom', label: 'LOOM', visualKey: 'loom',
      position: { x: -8.8, y: 3, z: 0 }, radius: 2.05, gravitationalParameter: 44,
      aliveColor: 0x789a7c, atmosphereColor: 0xb9e2c5, accentColor: 0xcfe89a,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'Its old bridges still remembered every neighbour.',
      restoration: {
        durationSeconds: 1.9, waveWidth: 0.055, growthTrailWidth: 0.2,
        waveColor: 0xe4f8bd, atmosphereOpacity: 0, rotationSpeed: 0.00065,
        surfaceVariation: 0.09,
      },
    },
    {
      id: 'shard', label: 'SHARD', visualKey: 'shard',
      position: { x: 0.7, y: 8, z: 0 }, radius: 3.55, gravitationalParameter: 102,
      aliveColor: 0x7085a8, atmosphereColor: 0xb9cdf9, accentColor: 0xd8e5ff,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'The broken crystal held a map in every face.',
      restoration: {
        durationSeconds: 2.55, waveWidth: 0.042, growthTrailWidth: 0.2,
        waveColor: 0xe9f2ff, atmosphereOpacity: 0, rotationSpeed: 0.00095,
        surfaceVariation: 0.04,
      },
    },
    {
      id: 'drift', label: 'DRIFT', visualKey: 'drift',
      position: { x: 9.7, y: 6, z: 0 }, radius: 2.15, gravitationalParameter: 48,
      aliveColor: 0x3e7895, atmosphereColor: 0x8fdbe6, accentColor: 0xb1f0e0,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'A quiet current was still circling home.',
      restoration: {
        durationSeconds: 1.95, waveWidth: 0.052, growthTrailWidth: 0.2,
        waveColor: 0xbdf6ff, atmosphereOpacity: 0, rotationSpeed: 0.00082,
        surfaceVariation: 0.06,
      },
    },
    {
      id: 'vault', label: 'VAULT', visualKey: 'vault',
      position: { x: 3.5, y: 1, z: 0 }, radius: 1.45, gravitationalParameter: 18,
      aliveColor: 0x7c6c91, atmosphereColor: 0xcbb8e1, accentColor: 0xf2d59c,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'Inside the little vault, names were waiting to be spoken.',
      restoration: {
        durationSeconds: 1.7, waveWidth: 0.06, growthTrailWidth: 0.22,
        waveColor: 0xf4ddbd, atmosphereOpacity: 0, rotationSpeed: 0.00055,
        surfaceVariation: 0.07,
      },
    },
  ],
  tacticalBodies: [
    {
      id: 'splinter', label: 'SPLINTER', kind: 'seedstone',
      position: { x: -2.3, y: -1.8, z: 0 }, radius: 0.68, uses: 1,
      initiallyRestored: true, countsTowardRestoration: false,
    },
    {
      id: 'sentinel', label: 'SENTINEL', kind: 'hazard', radius: 0.68,
      countsTowardRestoration: false,
      orbit: {
        centre: { x: 0.7, y: 8, z: 0 }, radius: 5.35,
        phaseRadians: -1.18, angularSpeedRadiansPerSecond: 0.34,
      },
    },
    {
      id: 'belt-heart', label: 'BELT HEART', kind: 'worldheart',
      position: { x: -4.35, y: 8.75, z: 0 }, radius: 0.9,
      initiallyRestored: false, countsTowardRestoration: false,
      isRouteDestination: true, routeAvailableInitially: false,
    },
  ],
  stardust: [
    { id: 'broken-belt-arc-1', position: { x: -4.946, y: -3.769, z: 0 } },
    { id: 'broken-belt-arc-2', position: { x: -5.718, y: -2.29, z: 0 } },
    { id: 'broken-belt-arc-3', position: { x: -6.525, y: -0.946, z: 0 } },
  ],
};

/** A living system whose useful routes open and close as its small bodies move. */
export const WanderingGardenSystemDefinition = {
  id: 'wandering-garden',
  label: 'WANDERING GARDEN',
  launchBudget: 8,
  openingBody: 'The Garden is still turning. Wake a path, then ride its little moon into bloom.',
  completion: {
    eyebrow: 'THE GARDEN TURNS AGAIN',
    title: 'Life has learned to move with the dark.',
    perfectTitle: 'Every wandering root has found the light.',
    body: 'The Garden Heart sends a green pulse toward the long night ahead.',
    perfectBody: 'Every world and every moonlit arc now flowers in the living constellation.',
  },
  constellation: {
    nodes: [
      { id: 'bower', label: 'Bower', x: 22, y: 72 },
      { id: 'canopy', label: 'Canopy', x: 58, y: 34 },
      { id: 'crown', label: 'Crown', x: 112, y: 16 },
      { id: 'dew', label: 'Dew', x: 174, y: 30 },
      { id: 'lantern', label: 'Lantern', x: 112, y: 72 },
      { id: 'nest', label: 'Nest', x: 104, y: 45 },
      { id: 'garden-heart', label: 'Garden Heart', x: 216, y: 68, isHeart: true },
    ],
    edges: [
      ['bower', 'canopy'], ['bower', 'lantern'], ['canopy', 'crown'],
      ['canopy', 'nest'], ['lantern', 'nest'], ['lantern', 'dew'],
      ['nest', 'crown'], ['nest', 'dew'], ['crown', 'dew'],
      ['crown', 'garden-heart'], ['dew', 'garden-heart'],
    ],
  },
  startingWorldIdentifier: 'bower',
  openingGuideTargetIdentifier: 'lantern',
  worldheartUnlockThreshold: 3,
  routeSuggestions: {
    bower: ['canopy', 'lantern'],
    canopy: ['pollen-moon', 'crown', 'nest', 'lantern'],
    lantern: ['pollen-moon', 'dew', 'nest', 'canopy'],
    nest: ['garden-heart', 'crown', 'dew', 'canopy'],
    crown: ['garden-heart', 'dew', 'canopy', 'nest'],
    dew: ['garden-heart', 'crown', 'lantern', 'nest'],
    'pollen-moon': ['crown', 'nest', 'dew', 'lantern'],
  },
  worlds: [
    {
      id: 'bower', label: 'BOWER', visualKey: 'bower',
      position: { x: -8, y: -6.4, z: 0 }, radius: 3.35, gravitationalParameter: 92,
      aliveColor: 0x4f9870, atmosphereColor: 0x9ce6b2, accentColor: 0xf2e69a,
      initiallyRestored: true, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'The first shelter had kept one leaf warm.',
      restoration: {
        durationSeconds: 2.2, waveWidth: 0.045, growthTrailWidth: 0.18,
        waveColor: 0xe8ffc0, atmosphereOpacity: 0, rotationSpeed: 0.00045,
        surfaceVariation: 0.1,
      },
    },
    {
      id: 'lantern', label: 'LANTERN', visualKey: 'lantern',
      position: { x: 7.8, y: -3.3, z: 0 }, radius: 3, gravitationalParameter: 82,
      aliveColor: 0xa88a45, atmosphereColor: 0xffe895, accentColor: 0xfff2b6,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'A patient flower opened its lamp to the void.',
      restoration: {
        durationSeconds: 2.3, waveWidth: 0.048, growthTrailWidth: 0.18,
        waveColor: 0xffefad, atmosphereOpacity: 0, rotationSpeed: 0.00105,
        surfaceVariation: 0.05,
      },
    },
    {
      id: 'canopy', label: 'CANOPY', visualKey: 'canopy',
      position: { x: -8.8, y: 3, z: 0 }, radius: 2.05, gravitationalParameter: 44,
      aliveColor: 0x5b9c73, atmosphereColor: 0xb6e8bd, accentColor: 0xe6f39b,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'Its branches bent together, remembering the shape of rain.',
      restoration: {
        durationSeconds: 1.9, waveWidth: 0.055, growthTrailWidth: 0.2,
        waveColor: 0xddffb7, atmosphereOpacity: 0, rotationSpeed: 0.00068,
        surfaceVariation: 0.09,
      },
    },
    {
      id: 'crown', label: 'CROWN', visualKey: 'crown',
      position: { x: 0.7, y: 8, z: 0 }, radius: 3.55, gravitationalParameter: 102,
      aliveColor: 0x8160a4, atmosphereColor: 0xd7b8ef, accentColor: 0xffc5ec,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'The old crown bloomed only when the moon passed close.',
      restoration: {
        durationSeconds: 2.55, waveWidth: 0.042, growthTrailWidth: 0.2,
        waveColor: 0xf6c8ff, atmosphereOpacity: 0, rotationSpeed: 0.0009,
        surfaceVariation: 0.04,
      },
    },
    {
      id: 'dew', label: 'DEW', visualKey: 'dew',
      position: { x: 9.7, y: 6, z: 0 }, radius: 2.15, gravitationalParameter: 48,
      aliveColor: 0x3d8f91, atmosphereColor: 0x9ff4dc, accentColor: 0xc2ffef,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'One clear drop still held the reflection of a blue sky.',
      restoration: {
        durationSeconds: 1.95, waveWidth: 0.052, growthTrailWidth: 0.2,
        waveColor: 0xb9ffe7, atmosphereOpacity: 0, rotationSpeed: 0.00082,
        surfaceVariation: 0.06,
      },
    },
    {
      id: 'nest', label: 'NEST', visualKey: 'nest',
      position: { x: 3.5, y: 1, z: 0 }, radius: 1.45, gravitationalParameter: 18,
      aliveColor: 0x8b704c, atmosphereColor: 0xe8cf9b, accentColor: 0xb8e58c,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'The smallest world had saved a place for every traveller.',
      restoration: {
        durationSeconds: 1.7, waveWidth: 0.06, growthTrailWidth: 0.22,
        waveColor: 0xf4e4aa, atmosphereOpacity: 0, rotationSpeed: 0.00055,
        surfaceVariation: 0.07,
      },
    },
  ],
  tacticalBodies: [
    {
      id: 'pollen-moon', label: 'POLLEN MOON', kind: 'seedstone',
      position: { x: 0.5, y: -0.6, z: 0 }, radius: 0.72, uses: 1,
      countsTowardRestoration: false, isRouteDestination: true,
      routeAvailableInitially: true,
      orbit: {
        centre: { x: 3.5, y: 1, z: 0 }, radius: 3.4,
        phaseRadians: -2.65, angularSpeedRadiansPerSecond: 0.18,
      },
    },
    {
      id: 'thornwing', label: 'THORNWING', kind: 'hazard', radius: 0.66,
      countsTowardRestoration: false,
      orbit: {
        centre: { x: 0.7, y: 8, z: 0 }, radius: 5.35,
        phaseRadians: -0.9, angularSpeedRadiansPerSecond: 0.28,
      },
    },
    {
      id: 'garden-heart', label: 'GARDEN HEART', kind: 'worldheart',
      position: { x: -4.35, y: 8.75, z: 0 }, radius: 0.9,
      initiallyRestored: false, countsTowardRestoration: false,
      isRouteDestination: true, routeAvailableInitially: false,
    },
  ],
  stardust: [
    { id: 'wandering-garden-arc-1', position: { x: -4.9, y: -3.7, z: 0 } },
    { id: 'wandering-garden-arc-2', position: { x: -5.7, y: -2.25, z: 0 } },
    { id: 'wandering-garden-arc-3', position: { x: -6.5, y: -0.9, z: 0 } },
  ],
};

/** The campaign's deepest authored system, built around long assists and narrow clearings. */
export const LongNightSystemDefinition = {
  id: 'long-night',
  label: 'THE LONG NIGHT',
  launchBudget: 8,
  openingBody: 'Dawn is gone here. Carry the Garden\'s green pulse through the longest dark.',
  environment: {
    backgroundColor: 0x02030b,
    fogColor: 0x030411,
    fogDensity: 0.014,
    hemisphereSkyColor: 0x59617f,
    hemisphereGroundColor: 0x090914,
    keyLightColor: 0xd9dbff,
    fillLightColor: 0x574c91,
    rimLightColor: 0x8a93ff,
    toneMappingExposure: 1.08,
  },
  completion: {
    eyebrow: 'THE LONG NIGHT BREAKS',
    title: 'A road to the Worldheart burns beyond the dark.',
    perfectTitle: 'Every watchfire carries the coming dawn.',
    body: 'The forgotten systems now point together toward the Worldheart.',
    perfectBody: 'Every world and every long arc now burns in one unbroken constellation.',
  },
  constellation: {
    nodes: [
      { id: 'vigil', label: 'Vigil', x: 22, y: 72 },
      { id: 'hollow', label: 'Hollow', x: 56, y: 34 },
      { id: 'beacon', label: 'Beacon', x: 112, y: 14 },
      { id: 'umbra', label: 'Umbra', x: 178, y: 28 },
      { id: 'pyre', label: 'Pyre', x: 112, y: 72 },
      { id: 'lumen', label: 'Lumen', x: 108, y: 46 },
      { id: 'night-heart', label: 'Night Heart', x: 216, y: 68, isHeart: true },
    ],
    edges: [
      ['vigil', 'hollow'], ['vigil', 'pyre'], ['hollow', 'beacon'],
      ['hollow', 'lumen'], ['pyre', 'lumen'], ['pyre', 'umbra'],
      ['lumen', 'beacon'], ['lumen', 'umbra'], ['beacon', 'umbra'],
      ['beacon', 'night-heart'], ['umbra', 'night-heart'],
    ],
  },
  startingWorldIdentifier: 'vigil',
  openingGuideTargetIdentifier: 'pyre',
  worldheartUnlockThreshold: 4,
  routeSuggestions: {
    vigil: ['hollow', 'pyre'],
    hollow: ['beacon', 'nightglass', 'lumen', 'pyre'],
    pyre: ['lumen', 'umbra', 'nightglass', 'hollow'],
    lumen: ['umbra', 'beacon', 'pyre', 'hollow'],
    beacon: ['night-heart', 'umbra', 'hollow', 'lumen'],
    umbra: ['night-heart', 'beacon', 'pyre', 'lumen'],
    nightglass: ['beacon', 'lumen', 'hollow'],
  },
  worlds: [
    {
      id: 'vigil', label: 'VIGIL', visualKey: 'vigil',
      position: { x: -9, y: -7, z: 0 }, radius: 3.15, gravitationalParameter: 90,
      aliveColor: 0x536d72, atmosphereColor: 0x9ebfc2, accentColor: 0xf4d790,
      initiallyRestored: true, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'One watchfire had refused to go out.',
      restoration: {
        durationSeconds: 2.25, waveWidth: 0.044, growthTrailWidth: 0.18,
        waveColor: 0xe8e5b5, atmosphereOpacity: 0, rotationSpeed: 0.00038,
        surfaceVariation: 0.08,
      },
    },
    {
      id: 'pyre', label: 'PYRE', visualKey: 'pyre',
      position: { x: 9, y: -5.6, z: 0 }, radius: 2.6, gravitationalParameter: 72,
      aliveColor: 0x9b5447, atmosphereColor: 0xffa27e, accentColor: 0xffd08b,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'Ash lifted, remembering it had once been flame.',
      restoration: {
        durationSeconds: 2.2, waveWidth: 0.05, growthTrailWidth: 0.18,
        waveColor: 0xffcb93, atmosphereOpacity: 0, rotationSpeed: 0.0011,
        surfaceVariation: 0.045,
      },
    },
    {
      id: 'hollow', label: 'HOLLOW', visualKey: 'hollow',
      position: { x: -9.5, y: 3.8, z: 0 }, radius: 2.2, gravitationalParameter: 50,
      aliveColor: 0x5c667d, atmosphereColor: 0xa8b8dc, accentColor: 0xd5ddff,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'The empty bells rang for a dawn they had never seen.',
      restoration: {
        durationSeconds: 1.95, waveWidth: 0.054, growthTrailWidth: 0.2,
        waveColor: 0xdbe3ff, atmosphereOpacity: 0, rotationSpeed: 0.00062,
        surfaceVariation: 0.07,
      },
    },
    {
      id: 'beacon', label: 'BEACON', visualKey: 'beacon',
      position: { x: 0, y: 8.3, z: 0 }, radius: 4.1, gravitationalParameter: 145,
      aliveColor: 0x827eab, atmosphereColor: 0xd3ceff, accentColor: 0xffefb0,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'Its buried star opened one patient eye.',
      restoration: {
        durationSeconds: 2.8, waveWidth: 0.04, growthTrailWidth: 0.2,
        waveColor: 0xf3e8ff, atmosphereOpacity: 0, rotationSpeed: 0.00088,
        surfaceVariation: 0.035,
      },
    },
    {
      id: 'umbra', label: 'UMBRA', visualKey: 'umbra',
      position: { x: 10, y: 6.8, z: 0 }, radius: 2.4, gravitationalParameter: 60,
      aliveColor: 0x414f76, atmosphereColor: 0x929fd3, accentColor: 0xc3d2ff,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'Even the shadow had been keeping the light safe.',
      restoration: {
        durationSeconds: 2.05, waveWidth: 0.05, growthTrailWidth: 0.2,
        waveColor: 0xc7d4ff, atmosphereOpacity: 0, rotationSpeed: 0.00076,
        surfaceVariation: 0.05,
      },
    },
    {
      id: 'lumen', label: 'LUMEN', visualKey: 'lumen',
      position: { x: 3.2, y: 0.6, z: 0 }, radius: 1.5, gravitationalParameter: 21,
      aliveColor: 0x9d884c, atmosphereColor: 0xf3dda0, accentColor: 0xfff1b5,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'The smallest lamp had counted every hour.',
      restoration: {
        durationSeconds: 1.72, waveWidth: 0.06, growthTrailWidth: 0.22,
        waveColor: 0xffedb5, atmosphereOpacity: 0, rotationSpeed: 0.00052,
        surfaceVariation: 0.065,
      },
    },
  ],
  tacticalBodies: [
    {
      id: 'nightglass', label: 'NIGHTGLASS', kind: 'seedstone',
      position: { x: -1.8, y: -2, z: 0 }, radius: 0.68, uses: 1,
      initiallyRestored: true, countsTowardRestoration: false,
    },
    {
      id: 'eclipse', label: 'ECLIPSE', kind: 'hazard', radius: 0.74,
      countsTowardRestoration: false,
      orbit: {
        centre: { x: 0, y: 8.3, z: 0 }, radius: 5.8,
        phaseRadians: 2.8, angularSpeedRadiansPerSecond: 0.24,
      },
    },
    {
      id: 'night-heart', label: 'NIGHT HEART', kind: 'worldheart',
      position: { x: -5.2, y: 9.5, z: 0 }, radius: 0.9,
      initiallyRestored: false, countsTowardRestoration: false,
      isRouteDestination: true, routeAvailableInitially: false,
    },
  ],
  stardust: [
    { id: 'long-night-arc-1', position: { x: -3.12, y: -3.78, z: 0 } },
    { id: 'long-night-arc-2', position: { x: -3.43, y: -1.22, z: 0 } },
    { id: 'long-night-arc-3', position: { x: -3.81, y: 1.65, z: 0 } },
  ],
};

/** The campaign finale, recombining every learned route decision around the true Worldheart. */
export const WorldheartSystemDefinition = {
  id: 'worldheart',
  label: 'WORLDHEART',
  launchBudget: 8,
  openingBody: 'Every restored system is behind you. Choose how the last living seed comes home.',
  environment: {
    backgroundColor: 0x070616,
    fogColor: 0x0b0920,
    fogDensity: 0.011,
    hemisphereSkyColor: 0x8d83b8,
    hemisphereGroundColor: 0x171126,
    keyLightColor: 0xffedd0,
    fillLightColor: 0x776bb4,
    rimLightColor: 0xa9e8d0,
    toneMappingExposure: 1.18,
  },
  finale: {
    isCampaignFinale: true,
    victoryDelaySeconds: 3.4,
    pulseColor: 0xffe0a0,
    awakenedBackgroundColor: 0x19152f,
  },
  completion: {
    eyebrow: 'THE WORLDHEART LIVES',
    title: 'Life has a way home again.',
    perfectTitle: 'Every world answers the seed.',
    body: 'The forgotten systems breathe together. The last living seed is no longer the last.',
    perfectBody: 'Every route, memory and mote now shines in one living constellation.',
  },
  constellation: {
    nodes: [
      { id: 'confluence', label: 'Confluence', x: 22, y: 72 },
      { id: 'memory', label: 'Memory', x: 56, y: 34 },
      { id: 'starwell', label: 'Starwell', x: 112, y: 14 },
      { id: 'dawn', label: 'Dawn', x: 178, y: 28 },
      { id: 'kindle', label: 'Kindle', x: 112, y: 72 },
      { id: 'chorus', label: 'Chorus', x: 108, y: 46 },
      { id: 'worldheart-core', label: 'Worldheart', x: 216, y: 68, isHeart: true },
    ],
    edges: [
      ['confluence', 'memory'], ['confluence', 'kindle'], ['memory', 'starwell'],
      ['memory', 'chorus'], ['kindle', 'chorus'], ['kindle', 'dawn'],
      ['chorus', 'starwell'], ['chorus', 'dawn'], ['starwell', 'dawn'],
      ['starwell', 'worldheart-core'], ['dawn', 'worldheart-core'],
    ],
  },
  startingWorldIdentifier: 'confluence',
  openingGuideTargetIdentifier: 'kindle',
  worldheartUnlockThreshold: 4,
  routeSuggestions: {
    confluence: ['worldheart-core', 'memory', 'kindle'],
    memory: ['worldheart-core', 'memory-moon', 'starwell', 'chorus', 'kindle'],
    kindle: ['worldheart-core', 'chorus', 'dawn', 'memory-moon', 'memory'],
    chorus: ['worldheart-core', 'memory-moon', 'dawn', 'starwell', 'kindle'],
    starwell: ['worldheart-core', 'dawn', 'memory', 'chorus'],
    dawn: ['worldheart-core', 'starwell', 'kindle', 'chorus'],
    'memory-moon': ['worldheart-core', 'starwell', 'dawn', 'chorus'],
  },
  worlds: [
    {
      id: 'confluence', label: 'CONFLUENCE', visualKey: 'confluence',
      position: { x: -9, y: -7, z: 0 }, radius: 3.15, gravitationalParameter: 90,
      aliveColor: 0x5e8178, atmosphereColor: 0xa9e8d0, accentColor: 0xffdda0,
      initiallyRestored: true, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'Every path you restored was already flowing toward this place.',
      restoration: {
        durationSeconds: 2.35, waveWidth: 0.044, growthTrailWidth: 0.18,
        waveColor: 0xe9f1bd, atmosphereOpacity: 0, rotationSpeed: 0.00042,
        surfaceVariation: 0.075,
      },
    },
    {
      id: 'kindle', label: 'KINDLE', visualKey: 'kindle',
      position: { x: 9, y: -5.6, z: 0 }, radius: 2.6, gravitationalParameter: 72,
      aliveColor: 0xa55f50, atmosphereColor: 0xffad82, accentColor: 0xffe09d,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'The first spark and the last watchfire recognised one another.',
      restoration: {
        durationSeconds: 2.3, waveWidth: 0.05, growthTrailWidth: 0.18,
        waveColor: 0xffcd94, atmosphereOpacity: 0, rotationSpeed: 0.00105,
        surfaceVariation: 0.045,
      },
    },
    {
      id: 'memory', label: 'MEMORY', visualKey: 'memory',
      position: { x: -9.5, y: 3.8, z: 0 }, radius: 2.2, gravitationalParameter: 50,
      aliveColor: 0x668777, atmosphereColor: 0xbbe2ca, accentColor: 0xe2edc2,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'Roots, bridges and bells had kept the same promise in different words.',
      restoration: {
        durationSeconds: 2.05, waveWidth: 0.054, growthTrailWidth: 0.2,
        waveColor: 0xd8efcf, atmosphereOpacity: 0, rotationSpeed: 0.00064,
        surfaceVariation: 0.065,
      },
    },
    {
      id: 'starwell', label: 'STARWELL', visualKey: 'starwell',
      position: { x: 0, y: 8.3, z: 0 }, radius: 4.1, gravitationalParameter: 145,
      aliveColor: 0x817cac, atmosphereColor: 0xd8d0ff, accentColor: 0xffe7a5,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'The gravity of every small kindness became a road through the dark.',
      restoration: {
        durationSeconds: 2.9, waveWidth: 0.04, growthTrailWidth: 0.2,
        waveColor: 0xf0e5ff, atmosphereOpacity: 0, rotationSpeed: 0.00086,
        surfaceVariation: 0.035,
      },
    },
    {
      id: 'dawn', label: 'DAWN', visualKey: 'dawn',
      position: { x: 10, y: 6.8, z: 0 }, radius: 2.4, gravitationalParameter: 60,
      aliveColor: 0xb18461, atmosphereColor: 0xffd7a6, accentColor: 0xfff1b3,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 2,
      memory: 'Dawn was not a place. It was every world choosing to answer.',
      restoration: {
        durationSeconds: 2.18, waveWidth: 0.05, growthTrailWidth: 0.2,
        waveColor: 0xffe7b6, atmosphereOpacity: 0, rotationSpeed: 0.00078,
        surfaceVariation: 0.05,
      },
    },
    {
      id: 'chorus', label: 'CHORUS', visualKey: 'chorus',
      position: { x: 3.2, y: 0.6, z: 0 }, radius: 1.5, gravitationalParameter: 21,
      aliveColor: 0x7e9171, atmosphereColor: 0xcfe6ae, accentColor: 0xffedaa,
      initiallyRestored: false, usesMergedSurfaceLandmarks: true, biomeStyle: 1,
      memory: 'No world had survived alone; together, they became a song.',
      restoration: {
        durationSeconds: 1.82, waveWidth: 0.06, growthTrailWidth: 0.22,
        waveColor: 0xe9efb5, atmosphereOpacity: 0, rotationSpeed: 0.00056,
        surfaceVariation: 0.06,
      },
    },
  ],
  tacticalBodies: [
    {
      id: 'memory-moon', label: 'MEMORY MOON', kind: 'seedstone',
      position: { x: 0.65, y: 0.6, z: 0 }, radius: 0.82, uses: 1,
      countsTowardRestoration: false, isRouteDestination: true,
      routeAvailableInitially: true,
      orbit: {
        centre: { x: 3.2, y: 0.6, z: 0 }, radius: 2.55,
        phaseRadians: Math.PI, angularSpeedRadiansPerSecond: 0.22,
      },
    },
    {
      id: 'last-shadow', label: 'LAST SHADOW', kind: 'hazard', radius: 0.74,
      countsTowardRestoration: false,
      orbit: {
        centre: { x: 0, y: 8.3, z: 0 }, radius: 5.8,
        phaseRadians: 2.8, angularSpeedRadiansPerSecond: 0.24,
      },
    },
    {
      id: 'worldheart-core', label: 'WORLDHEART', kind: 'worldheart',
      position: { x: -5.2, y: 9.5, z: 0 }, radius: 1.18,
      initiallyRestored: false, countsTowardRestoration: false,
      isRouteDestination: true, routeAvailableInitially: false,
    },
  ],
  stardust: [
    { id: 'worldheart-arc-1', position: { x: -3.12, y: -3.78, z: 0 } },
    { id: 'worldheart-arc-2', position: { x: -3.43, y: -1.22, z: 0 } },
    { id: 'worldheart-arc-3', position: { x: -3.81, y: 1.65, z: 0 } },
  ],
};

export const DefaultAuthoredSystemIdentifier = FirstLightSystemDefinition.id;

export const AuthoredSystemDefinitions = {
  [FirstLightSystemDefinition.id]: FirstLightSystemDefinition,
  [BrokenBeltSystemDefinition.id]: BrokenBeltSystemDefinition,
  [WanderingGardenSystemDefinition.id]: WanderingGardenSystemDefinition,
  [LongNightSystemDefinition.id]: LongNightSystemDefinition,
  [WorldheartSystemDefinition.id]: WorldheartSystemDefinition,
};

export const AuthoredCampaignSystemIdentifiers = [
  FirstLightSystemDefinition.id,
  BrokenBeltSystemDefinition.id,
  WanderingGardenSystemDefinition.id,
  LongNightSystemDefinition.id,
  WorldheartSystemDefinition.id,
];

/** Resolves a requested authored system and safely falls back to the campaign entry. */
export function getAuthoredSystemDefinition(SystemIdentifier) {
  return AuthoredSystemDefinitions[SystemIdentifier]
    ?? AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier];
}

/** Returns the next authored chapter, or null when the current campaign frontier is reached. */
export function getNextAuthoredSystemIdentifier(SystemIdentifier) {
  const CurrentSystemIndex = AuthoredCampaignSystemIdentifiers.indexOf(SystemIdentifier);
  return CurrentSystemIndex >= 0
    ? AuthoredCampaignSystemIdentifiers[CurrentSystemIndex + 1] ?? null
    : null;
}
