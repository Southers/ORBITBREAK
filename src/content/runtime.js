/**
 * Runtime factories inject vectors and colours so authored data stays testable without WebGL.
 * Mutable play state is always cloned from these definitions.
 */

import { assertValidAuthoredSystemDefinition } from './schema.js';

const DefaultEnvironmentDefinition = {
  backgroundColor: 0x0a1826,
  fogColor: 0x0a1826,
  fogDensity: 0.007,
  hemisphereSkyColor: 0xc4dcec,
  hemisphereGroundColor: 0x1b2a36,
  keyLightColor: 0xfff4dc,
  fillLightColor: 0x8fb4d8,
  rimLightColor: 0x9ae0ff,
  toneMappingExposure: 1.22,
};

function clonePosition(Position, CreateVector) {
  return CreateVector(Position.x, Position.y, Position.z);
}

function cloneStoryPage(Page) {
  const ClonedPage = {
    speaker: Page.speaker,
    kicker: Page.kicker,
    title: Page.title,
    body: Page.body,
    portrait: Page.portrait,
  };
  if (typeof Page.focusWorldId === 'string' && Page.focusWorldId.trim() !== '') {
    ClonedPage.focusWorldId = Page.focusWorldId;
  }
  return ClonedPage;
}

function cloneStoryBoards(StoryBoards) {
  if (!StoryBoards || typeof StoryBoards !== 'object') {
    return {};
  }
  return Object.fromEntries(Object.entries(StoryBoards).map(([BoardId, Board]) => [
    BoardId,
    {
      skipLabel: Board.skipLabel,
      continueLabel: Board.continueLabel,
      pages: (Board.pages ?? []).map((Page) => cloneStoryPage(Page)),
    },
  ]));
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
    occupationScarAngles: WorldDefinition.occupationScarAngles
      ? [...WorldDefinition.occupationScarAngles]
      : undefined,
    hostileEncounter: WorldDefinition.hostileEncounter
      ? {
        ...WorldDefinition.hostileEncounter,
        clampOffsetsRadians: [...WorldDefinition.hostileEncounter.clampOffsetsRadians],
      }
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
    hostileEncounter: BodyDefinition.hostileEncounter
      ? {
        ...BodyDefinition.hostileEncounter,
        clampOffsetsRadians: [...BodyDefinition.hostileEncounter.clampOffsetsRadians],
      }
      : undefined,
  }));
  const EnvironmentDefinition = {
    ...DefaultEnvironmentDefinition,
    ...SystemDefinition.environment,
  };

  return {
    id: SystemDefinition.id,
    label: SystemDefinition.label,
    contentVersion: SystemDefinition.contentVersion,
    openingBody: SystemDefinition.openingBody,
    openingBroadcast: SystemDefinition.openingBroadcast ?? null,
    openingBriefing: Array.isArray(SystemDefinition.openingBriefing)
      ? SystemDefinition.openingBriefing.map((Page) => cloneStoryPage(Page))
      : [],
    wardenArrivalBroadcast: SystemDefinition.wardenArrivalBroadcast ?? null,
    storyBoards: cloneStoryBoards(SystemDefinition.storyBoards),
    rangeUnlockLine: SystemDefinition.rangeUnlockLine ?? null,
    furtherLandingLine: SystemDefinition.furtherLandingLine ?? null,
    commandApproachLine: SystemDefinition.commandApproachLine ?? null,
    camera: SystemDefinition.camera ? { ...SystemDefinition.camera } : null,
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
    completion: {
      ...SystemDefinition.completion,
      emblems: SystemDefinition.completion.emblems
        ? Object.fromEntries(Object.entries(SystemDefinition.completion.emblems).map(
          ([EmblemIdentifier, EmblemDefinition]) => [
            EmblemIdentifier,
            { ...EmblemDefinition },
          ],
        ))
        : undefined,
    },
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
    innerClusterWorldIdentifiers: [...SystemDefinition.innerClusterWorldIdentifiers],
    furtherReachWorldIdentifiers: [...SystemDefinition.furtherReachWorldIdentifiers],
    commandWorldIdentifier: TacticalBodies.find((Body) => Body.kind === 'worldheart')?.id
      ?? null,
    launchBudget: SystemDefinition.launchBudget,
    circuitBonusValue: SystemDefinition.circuitBonusValue ?? 1000,
    wardenVictoryValuePerStep: SystemDefinition.wardenVictoryValuePerStep ?? 1000,
    worldheartUnlockThreshold: SystemDefinition.worldheartUnlockThreshold,
    commandWorldRequiresShieldBreaks:
      SystemDefinition.commandWorldRequiresShieldBreaks === true,
    routeSuggestions: Object.fromEntries(Object.entries(SystemDefinition.routeSuggestions ?? {}).map(
      ([SourceIdentifier, TargetIdentifiers]) => [SourceIdentifier, [...TargetIdentifiers]],
    )),
    routeGuidance: Object.fromEntries(Object.entries(SystemDefinition.routeGuidance ?? {}).map(
      ([SourceIdentifier, TargetGuidance]) => [SourceIdentifier, { ...TargetGuidance }],
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
