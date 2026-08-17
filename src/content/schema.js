/** Authored-system schema validation. Stays free of runtime cloning. */

const RequiredRestorationNumbers = [
  'durationSeconds',
  'waveWidth',
  'growthTrailWidth',
  'atmosphereOpacity',
  'rotationSpeed',
  'surfaceVariation',
];
const SupportedTacticalBodyKinds = new Set(['seedstone', 'hazard', 'worldheart']);
function isFiniteVector(VectorValue) {
  return VectorValue
    && Number.isFinite(VectorValue.x)
    && Number.isFinite(VectorValue.y)
    && Number.isFinite(VectorValue.z);
}

function isColorValue(ColorValue) {
  return Number.isInteger(ColorValue) && ColorValue >= 0 && ColorValue <= 0xffffff;
}

function isValidHostileEncounter(Encounter) {
  const Offsets = Encounter?.clampOffsetsRadians;
  if (!Array.isArray(Offsets) || Offsets.length < 1 || Offsets.length > 5) {
    return false;
  }
  if (Offsets.some((Offset) => !Number.isFinite(Offset) || Math.abs(Offset) > Math.PI)) {
    return false;
  }
  if (
    Encounter.cutHitRadius !== undefined
    && (!(Encounter.cutHitRadius > 0) || Encounter.cutHitRadius > 1.5)
  ) {
    return false;
  }
  if (
    Encounter.maxCutLength !== undefined
    && (!(Encounter.maxCutLength > 0) || Encounter.maxCutLength > 8)
  ) {
    return false;
  }
  return true;
}

const AllowedStoryBoardPortraits = new Set([
  'warden', 'runner', 'haven', 'orbitbreaker', 'ember', 'grove',
  'tide', 'frost', 'bastion', 'command',
]);
const RequiredCampaignStoryBoardIds = [
  'firstAnswer', 'secondAnswer', 'rangeUnlock', 'neighbourhood',
  'wardenArrival', 'circuitClosed', 'suppression', 'recapture',
  'commandExposed', 'runLost',
];

function validateStoryBoardPages(Pages, Label) {
  const Errors = [];
  if (!Array.isArray(Pages) || Pages.length < 1) {
    Errors.push(`Authored system ${Label} must be a non-empty array when present.`);
    return Errors;
  }
  Pages.forEach((Page, PageIndex) => {
    for (const Field of ['speaker', 'kicker', 'title', 'body', 'portrait']) {
      if (typeof Page?.[Field] !== 'string' || Page[Field].trim() === '') {
        Errors.push(`Authored system ${Label} page ${PageIndex + 1} requires ${Field}.`);
      }
    }
    if (typeof Page?.portrait === 'string' && !AllowedStoryBoardPortraits.has(Page.portrait)) {
      Errors.push(`Authored system ${Label} page ${PageIndex + 1} has unknown portrait.`);
    }
    if (
      Page?.focusWorldId !== undefined
      && (typeof Page.focusWorldId !== 'string' || Page.focusWorldId.trim() === '')
    ) {
      Errors.push(
        `Authored system ${Label} page ${PageIndex + 1} requires a non-empty focusWorldId when present.`,
      );
    }
  });
  return Errors;
}

function validateCampaignStoryBoards(StoryBoards) {
  const Errors = [];
  if (!StoryBoards || typeof StoryBoards !== 'object' || Array.isArray(StoryBoards)) {
    return ['Authored system storyBoards must be an object when present.'];
  }
  for (const BoardId of RequiredCampaignStoryBoardIds) {
    if (!StoryBoards[BoardId]) {
      Errors.push(`Authored system storyBoards requires ${BoardId}.`);
    }
  }
  for (const [BoardId, Board] of Object.entries(StoryBoards)) {
    if (typeof BoardId !== 'string' || BoardId.trim() === '') {
      Errors.push('Authored story board ids must be non-empty strings.');
    }
    if (typeof Board?.skipLabel !== 'string' || Board.skipLabel.trim() === ''
      || typeof Board?.continueLabel !== 'string' || Board.continueLabel.trim() === '') {
      Errors.push(`Authored story board ${BoardId} requires skipLabel and continueLabel.`);
    }
    Errors.push(...validateStoryBoardPages(Board?.pages, `storyBoards.${BoardId}`));
  }
  return Errors;
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
  if (!SystemDefinition.contentVersion || typeof SystemDefinition.contentVersion !== 'string') {
    Errors.push('Authored system requires a contentVersion.');
  }
  if (!SystemDefinition.openingBody || typeof SystemDefinition.openingBody !== 'string') {
    Errors.push('Authored system requires openingBody story copy.');
  }
  for (const OptionalStoryField of [
    'openingBroadcast', 'wardenArrivalBroadcast', 'commandApproachLine',
    'rangeUnlockLine', 'furtherLandingLine',
  ]) {
    if (
      SystemDefinition[OptionalStoryField] !== undefined
      && (
        typeof SystemDefinition[OptionalStoryField] !== 'string'
        || SystemDefinition[OptionalStoryField].trim() === ''
      )
    ) {
      Errors.push(
        `Authored system ${OptionalStoryField} must be a non-empty string when present.`,
      );
    }
  }
  if (SystemDefinition.openingBriefing !== undefined) {
    Errors.push(...validateStoryBoardPages(
      SystemDefinition.openingBriefing,
      'openingBriefing',
    ));
  }
  if (SystemDefinition.storyBoards !== undefined) {
    Errors.push(...validateCampaignStoryBoards(SystemDefinition.storyBoards));
  }
  if (!Number.isInteger(SystemDefinition.launchBudget) || SystemDefinition.launchBudget < 1) {
    Errors.push('Authored system requires a positive integer launchBudget.');
  }
  for (const ScoreField of ['circuitBonusValue', 'wardenVictoryValuePerStep']) {
    if (
      SystemDefinition[ScoreField] !== undefined
      && (!Number.isInteger(SystemDefinition[ScoreField]) || SystemDefinition[ScoreField] < 1)
    ) {
      Errors.push(`Authored system ${ScoreField} must be a positive integer when present.`);
    }
  }
  if (SystemDefinition.camera) {
    if (
      SystemDefinition.camera.followPlayer !== true
      || !(SystemDefinition.camera.viewportWorldHeight > 0)
      || !(SystemDefinition.camera.viewportWorldWidth > 0)
      || !(SystemDefinition.camera.outOfBoundsDistance > 0)
    ) {
      Errors.push('Authored exploration camera requires follow and positive viewport bounds.');
    }
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
  if (CompletionDefinition?.emblems) {
    for (const EmblemIdentifier of ['heart', 'bloom', 'arc']) {
      const EmblemDefinition = CompletionDefinition.emblems[EmblemIdentifier];
      if (!EmblemDefinition?.title || !EmblemDefinition?.subtitle) {
        Errors.push(`Authored system completion.emblems.${EmblemIdentifier} requires title and subtitle.`);
      }
    }
  }
  if (
    CompletionDefinition?.continueToNextSystem !== undefined
    && typeof CompletionDefinition.continueToNextSystem !== 'boolean'
  ) {
    Errors.push('Authored system completion.continueToNextSystem must be boolean when present.');
  }
  for (const OptionalCompletionField of ['endingReveal', 'expansionSting']) {
    if (
      CompletionDefinition?.[OptionalCompletionField] !== undefined
      && (
        typeof CompletionDefinition[OptionalCompletionField] !== 'string'
        || CompletionDefinition[OptionalCompletionField].trim() === ''
      )
    ) {
      Errors.push(
        `Authored system completion.${OptionalCompletionField} must be a non-empty string when present.`,
      );
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

  const AuthoredWorldIdentifiers = new Set(
    WorldDefinitions.map((WorldDefinition) => WorldDefinition.id).filter(Boolean),
  );
  const StoryFocusPages = [
    ...(Array.isArray(SystemDefinition.openingBriefing) ? SystemDefinition.openingBriefing : []),
    ...Object.values(SystemDefinition.storyBoards ?? {}).flatMap((Board) => Board?.pages ?? []),
  ];
  for (const Page of StoryFocusPages) {
    if (
      typeof Page?.focusWorldId === 'string'
      && Page.focusWorldId.trim() !== ''
      && !AuthoredWorldIdentifiers.has(Page.focusWorldId)
    ) {
      Errors.push(`Story page focusWorldId ${Page.focusWorldId} does not exist.`);
    }
  }
  const validateWorldIdentifierList = (List, Label) => {
    if (!Array.isArray(List) || List.length < 1) {
      Errors.push(`Authored system ${Label} must be a non-empty array of world ids.`);
      return;
    }
    const SeenClusterIdentifiers = new Set();
    for (const Identifier of List) {
      if (typeof Identifier !== 'string' || !AuthoredWorldIdentifiers.has(Identifier)) {
        Errors.push(`Authored system ${Label} references unknown world ${Identifier}.`);
      }
      if (SeenClusterIdentifiers.has(Identifier)) {
        Errors.push(`Authored system ${Label} contains duplicate world ${Identifier}.`);
      }
      SeenClusterIdentifiers.add(Identifier);
    }
  };
  validateWorldIdentifierList(
    SystemDefinition.innerClusterWorldIdentifiers,
    'innerClusterWorldIdentifiers',
  );
  validateWorldIdentifierList(
    SystemDefinition.furtherReachWorldIdentifiers,
    'furtherReachWorldIdentifiers',
  );

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
    if (
      WorldDefinition.occupationScarAngles !== undefined
      && (
        !Array.isArray(WorldDefinition.occupationScarAngles)
        || WorldDefinition.occupationScarAngles.length < 2
        || WorldDefinition.occupationScarAngles.length > 6
        || WorldDefinition.occupationScarAngles.some((Angle) => !Number.isFinite(Angle))
      )
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has invalid occupation scar angles.`);
    }
    if (
      WorldDefinition.occupationSites !== undefined
      && (
        !Array.isArray(WorldDefinition.occupationSites)
        || WorldDefinition.occupationSites.length < 2
        || WorldDefinition.occupationSites.length > 6
        || WorldDefinition.occupationSites.some((Site) => (
          !Number.isFinite(Site?.longitude)
          || !Number.isFinite(Site?.latitude)
          || Math.abs(Site.latitude) > (Math.PI / 2)
        ))
      )
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has invalid occupation sites.`);
    }
    if (!isColorValue(WorldDefinition.aliveColor)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires an aliveColor integer.`);
    }
    if (!isColorValue(WorldDefinition.atmosphereColor)) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} requires an atmosphereColor integer.`);
    }
    if (
      WorldDefinition.disposition === 'hostile'
      && !isValidHostileEncounter(WorldDefinition.hostileEncounter)
    ) {
      Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has invalid hostile encounter data.`);
    }
    if (WorldDefinition.relayPort !== undefined) {
      const PortDefinition = WorldDefinition.relayPort;
      if (
        !PortDefinition
        || !Number.isFinite(PortDefinition.angleRadians)
        || !Number.isFinite(PortDefinition.halfWidthRadians)
        || PortDefinition.halfWidthRadians <= 0
        || PortDefinition.halfWidthRadians > Math.PI / 2
      ) {
        Errors.push(`World ${WorldDefinition.id ?? '<unknown>'} has an invalid relay port arc.`);
      }
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
    if (BodyDefinition.hostileEncounter && !isValidHostileEncounter(BodyDefinition.hostileEncounter)) {
      Errors.push(`Tactical body ${BodyDefinition.id ?? '<unknown>'} has invalid encounter data.`);
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

  const RouteGuidanceDefinition = SystemDefinition.routeGuidance;
  if (
    RouteGuidanceDefinition !== undefined
    && (
      !RouteGuidanceDefinition
      || typeof RouteGuidanceDefinition !== 'object'
      || Array.isArray(RouteGuidanceDefinition)
    )
  ) {
    Errors.push('Authored routeGuidance must be an object when present.');
  }
  for (const [SourceIdentifier, TargetGuidance] of Object.entries(
    RouteGuidanceDefinition
      && typeof RouteGuidanceDefinition === 'object'
      && !Array.isArray(RouteGuidanceDefinition)
      ? RouteGuidanceDefinition
      : {},
  )) {
    if (!RouteNodeIdentifiers.has(SourceIdentifier)) {
      Errors.push(`Route guidance source ${SourceIdentifier} does not exist.`);
    }
    if (
      !TargetGuidance
      || typeof TargetGuidance !== 'object'
      || Array.isArray(TargetGuidance)
      || Object.keys(TargetGuidance).length === 0
    ) {
      Errors.push(`Route guidance source ${SourceIdentifier} requires target guidance.`);
      continue;
    }
    for (const [TargetIdentifier, Guidance] of Object.entries(TargetGuidance)) {
      if (!RouteNodeIdentifiers.has(TargetIdentifier)) {
        Errors.push(`Route guidance target ${TargetIdentifier} does not exist.`);
      }
      if (TargetIdentifier === SourceIdentifier) {
        Errors.push(`Route guidance source ${SourceIdentifier} cannot target itself.`);
      }
      if (typeof Guidance !== 'string' || Guidance.trim() === '') {
        Errors.push(
          `Route guidance ${SourceIdentifier} to ${TargetIdentifier} requires non-empty copy.`,
        );
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
