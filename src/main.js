import * as THREE from 'three';

import { WorldseedAudio } from './audio.js?v=20260814-ob8';
import {
  SurfaceGestureModes,
  adjustSurfaceAngle,
  adjustKeyboardAimState,
  classifySurfaceGesture,
  createKeyboardAimState,
  getKeyboardAimDragVector,
  getSurfacePosition,
} from './controls.js?v=20260814-ob14';
import {
  createHostileEncounterState,
  getHostileEncounterAngularDistance,
  isHostilePulseReady,
  resolveHostilePulse,
} from './encounter.js?v=20260814-ob19';
import {
  MotionPreferences,
  cycleMotionPreference,
  getMotionPreferencePresentation,
  parseMotionPreference,
  resolveReducedMotion,
} from './preferences.js?v=20260814-ob12';
import {
  SmoothSamplesBeforeUpgrade,
  advanceAdaptivePixelRatio,
  getViewportPixelRatioCap,
} from './performance.js?v=20260814-ob13';

import {
  DefaultAuthoredSystemIdentifier,
  createAuthoredSystemRuntime,
  getAuthoredSystemDefinition,
  getNextAuthoredSystemIdentifier,
} from './content.js?v=20260815-ob25';

import {
  countRestoredWorlds,
  getLandingAccolade,
  getRestorableWorlds,
  getRouteChoices,
  getSystemEmblems,
  getTrajectoryPickupIdentifiers,
  isSystemRestored,
  isWorldheartUnlocked,
  rollbackFlightPickups,
} from './campaign.js?v=20260814-ob8';

import {
  applyBreakerBurn,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  predictTrajectory,
  simulatePhysicsStep,
} from './physics.js?v=20260814-ob14';
import { createLeaderboardClient } from './leaderboard-client.js?v=20260814-ob9';
import {
  connectRelayWorlds,
  countLiveRelayWorlds,
  createRelayNetworkState,
  listLiveRelayCircuits,
  listLiveRelayLinks,
  listProtectedRelayWorlds,
  listRelayLinks,
  listVulnerableRelayWorlds,
  suppressRelayWorld,
  wouldCloseRelayCircuit,
} from './network.js?v=20260814-ob18';
import {
  WardenPursuitEvents,
  chooseWardenTarget,
  createWardenPursuitState,
  resetWardenAfterSuppression,
  resolveWardenPursuit,
  shouldWardenCatchRunner,
} from './warden.js?v=20260815-ob22';
import {
  createRunResult,
  loadPersonalBest,
  savePersonalBest,
} from './records.js?v=20260814-ob8';
import {
  getLiberationFlashOpacity,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
  getStillnessPresentation,
} from './presentation.js?v=20260814-ob14';
import {
  PhysicsModelVersion,
  createReplayRecorder,
  finishReplay,
  getPersonalBestGhostStorageKey,
  getReplayStorageKey,
  parseReplay,
  recordReplayBurn,
  recordReplayLaunch,
  serializeReplay,
} from './replay.js?v=20260815-ob23';
import { getReplayGhostWaypoints } from './ghost.js?v=20260815-ob23';
import {
  consumeDueReplayBurn,
  consumeDueReplayLaunch,
  createReplayPlaybackState,
} from './replay-playback.js?v=20260814-ob14';
import { validateSerializedReplay } from './replay-validator.js?v=20260815-ob22';
import {
  calculateNormalizedSphericalDistance,
  calculateRestorationWaveProgress,
  calculateStagedGrowthProgress,
} from './restoration.js?v=20260814-ob8';
import {
  createRunState,
  failRunToWarden,
  releaseRunLaunch,
  settleRunFlight,
} from './run.js?v=20260815-ob22';
import {
  addCircuitBonus,
  addVictoryBonus,
  bankFlightScore,
  createScoreState,
  predictSlingshotEvents,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from './scoring.js?v=20260815-ob22';

const PageSearchParameters = new URLSearchParams(window.location.search);
const RequestedSystemIdentifier = PageSearchParameters.get('system')
  ?? DefaultAuthoredSystemIdentifier;
const ConfiguredLeaderboardApiBaseUrl = document.querySelector(
  'meta[name="orbitbreak-leaderboard-api"]',
)?.content.trim() ?? '';
const IsLocalDevelopmentHost = window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1';
const IsReleaseDiagnosticsEnabled = IsLocalDevelopmentHost
  && PageSearchParameters.get('diagnostics') === '1';
const LeaderboardApiBaseUrl = IsLocalDevelopmentHost
  ? PageSearchParameters.get('leaderboardApi')
    ?? ConfiguredLeaderboardApiBaseUrl
  : ConfiguredLeaderboardApiBaseUrl;
const LeaderboardClient = createLeaderboardClient({
  baseUrl: LeaderboardApiBaseUrl,
  fetch: window.fetch.bind(window),
});
const ActiveSystem = createAuthoredSystemRuntime(
  getAuthoredSystemDefinition(RequestedSystemIdentifier),
  {
    createVector,
    createColor: (ColorValue) => new THREE.Color(ColorValue),
  },
);
const NextSystemIdentifier = getNextAuthoredSystemIdentifier(ActiveSystem.id);
const WorldDefinitions = ActiveSystem.worlds;
const TacticalBodyDefinitions = ActiveSystem.tacticalBodies;
const SeedstoneDefinition = TacticalBodyDefinitions.find(
  (BodyDefinition) => BodyDefinition.kind === 'seedstone',
);
const AsteroidDefinition = TacticalBodyDefinitions.find(
  (BodyDefinition) => BodyDefinition.kind === 'hazard',
);
const WorldheartDefinition = TacticalBodyDefinitions.find(
  (BodyDefinition) => BodyDefinition.kind === 'worldheart',
);
const CampaignNodeDefinitions = [
  ...WorldDefinitions,
  SeedstoneDefinition,
  WorldheartDefinition,
];
const StardustDefinitions = ActiveSystem.stardust;

/**
 * ORBITBREAK — deterministic gravity score-attack foundation.
 *
 * The game deliberately keeps the simulation in a flat orbital plane while rendering
 * fully three-dimensional worlds. This produces immediately readable slingshot controls
 * on mouse and touch devices, while preserving spherical gravity and the visual language
 * of tiny planets floating in space.
 */

const GameCanvas = document.querySelector('#GameCanvas');
const LiberationFlashElement = document.querySelector('#LiberationFlash');
const CounterElement = document.querySelector('.counter');
const LaunchCounterElement = document.querySelector('#LaunchCounter');
const WorldCounterElement = document.querySelector('#WorldCounter');
const ScoreCounterElement = document.querySelector('#ScoreCounter');
const FlightScoreElement = document.querySelector('#FlightScore');
const FlightScoreValueElement = document.querySelector('#FlightScoreValue');
const ChainValueElement = document.querySelector('#ChainValue');
const ScannerPanelElement = document.querySelector('#ScannerPanel');
const ScannerBodyLayerElement = document.querySelector('#ScannerBodyLayer');
const ScannerWardenElement = document.querySelector('#ScannerWarden');
const ScannerRunnerElement = document.querySelector('#ScannerRunner');
const StardustCounterElement = document.querySelector('#StardustCounter');
const ObjectivePanelElement = document.querySelector('#ObjectivePanel');
const ObjectiveStateElement = document.querySelector('#ObjectiveState');
const ObjectivePipsElement = document.querySelector('#ObjectivePips');
const WardenPanelElement = document.querySelector('#WardenPanel');
const WardenDistanceElement = document.querySelector('#WardenDistance');
const WardenTargetElement = document.querySelector('#WardenTarget');
let ObjectivePipElements = [];
const InstructionPanelElement = document.querySelector('#InstructionPanel');
const InstructionTitleElement = document.querySelector('#InstructionTitle');
const InstructionBodyElement = document.querySelector('#InstructionBody');
const AimPanelElement = document.querySelector('#AimPanel');
const AimLabelElement = document.querySelector('#AimLabel');
const AimPowerFillElement = document.querySelector('#AimPowerFill');
const AimPowerValueElement = document.querySelector('#AimPowerValue');
const StatusToastElement = document.querySelector('#StatusToast');
const ReplayIndicatorElement = document.querySelector('#ReplayIndicator');
const RouteLabelElements = [...document.querySelectorAll('.route-label')];
const TacticalLabelElements = [...document.querySelectorAll('.tactical-label')];
const VictoryPanelElement = document.querySelector('#VictoryPanel');
const VictoryEyebrowElement = document.querySelector('#VictoryEyebrow');
const VictoryTitleElement = document.querySelector('#VictoryTitle');
const VictoryBodyElement = document.querySelector('#VictoryBody');
const PersonalBestLabelElement = document.querySelector('#PersonalBestLabel');
const ResultSlingshotScoreElement = document.querySelector('#ResultSlingshotScore');
const ResultLiberationScoreElement = document.querySelector('#ResultLiberationScore');
const ResultCompletionBonusElement = document.querySelector('#ResultCompletionBonus');
const ResultFlightTimeElement = document.querySelector('#ResultFlightTime');
const ConstellationSummaryElement = document.querySelector('#ConstellationSummary');
const EmblemRowElement = document.querySelector('#EmblemRow');
const EmblemElements = [...document.querySelectorAll('[data-emblem]')];
let ConstellationNodeElements = [];
const PlayAgainButtonElement = document.querySelector('#PlayAgainButton');
const ReplayButtonElement = document.querySelector('#ReplayButton');
const WatchReplayButtonElement = document.querySelector('#WatchReplayButton');
const LeaderboardButtonElement = document.querySelector('#LeaderboardButton');
const LeaderboardPanelElement = document.querySelector('#LeaderboardPanel');
const LeaderboardStatusElement = document.querySelector('#LeaderboardStatus');
const LeaderboardFormElement = document.querySelector('#LeaderboardForm');
const CallsignInputElement = document.querySelector('#CallsignInput');
const SubmitScoreButtonElement = document.querySelector('#SubmitScoreButton');
const LeaderboardListElement = document.querySelector('#LeaderboardList');
const CloseLeaderboardButtonElement = document.querySelector('#CloseLeaderboardButton');
const ResetButtonElement = document.querySelector('#ResetButton');
const AudioButtonElement = document.querySelector('#AudioButton');
const MotionButtonElement = document.querySelector('#MotionButton');
const ScoutButtonElement = document.querySelector('#ScoutButton');
const ScoutZoomOutButtonElement = document.querySelector('#ScoutZoomOutButton');
const ScoutZoomInButtonElement = document.querySelector('#ScoutZoomInButton');
const GhostButtonElement = document.querySelector('#GhostButton');
const BurnButtonElement = document.querySelector('#BurnButton');
configureSystemInterface();
GameCanvas.dataset.build = '20260815-ob28';
GameCanvas.dataset.system = ActiveSystem.id;
GameCanvas.dataset.leaderboardConfigured = String(LeaderboardClient.configured);
GameCanvas.dataset.pageActive = String(!document.hidden);
GameCanvas.dataset.webglAvailable = 'true';

/** Fixed-step physics makes live movement and trajectory prediction agree across frame rates. */
const FixedPhysicsStepHertz = 120;
const FixedPhysicsStepSeconds = 1 / FixedPhysicsStepHertz;
const MaximumFrameDeltaSeconds = 0.05;
const SeedRadius = 0.46;
const MaximumDragDistance = 6.25;
const LaunchVelocityPerDragUnit = 2.95;
const MinimumLaunchDragDistance = 0.22;
const MaximumTrajectoryPredictionSteps = 520;
const RankedPredictionVisibleSteps = 160;
GameCanvas.dataset.rankedPredictionSteps = String(RankedPredictionVisibleSteps);
const OutOfBoundsDistance = ActiveSystem.camera?.outOfBoundsDistance ?? 34;
const StartingWorldIdentifier = ActiveSystem.startingWorldIdentifier;
GameCanvas.dataset.currentNode = StartingWorldIdentifier;
const MaximumDrawCallBudget = 190;
const WorldheartUnlockThreshold = ActiveSystem.worldheartUnlockThreshold;
const StardustPickupRadius = 0.22;
const StardustCollectionRadius = SeedRadius + StardustPickupRadius;
const WorldClosePassClearance = 1.35;
const AsteroidClosePassClearance = 1.05;
const ReducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let MotionPreference = MotionPreferences.system;
try {
  MotionPreference = parseMotionPreference(window.localStorage.getItem('orbitbreak.motion'));
} catch {
  MotionPreference = MotionPreferences.system;
}
let PrefersReducedMotion = resolveReducedMotion(
  MotionPreference,
  ReducedMotionMediaQuery.matches,
);
GameCanvas.dataset.motionPreference = MotionPreference;
GameCanvas.dataset.reducedMotion = String(PrefersReducedMotion);
GameCanvas.dataset.releaseDiagnostics = String(IsReleaseDiagnosticsEnabled);

const Scene = new THREE.Scene();
Scene.background = ActiveSystem.environment.backgroundColor;
Scene.fog = new THREE.FogExp2(
  ActiveSystem.environment.fogColor,
  ActiveSystem.environment.fogDensity,
);

const PersonalBestGhostGeometry = new THREE.BufferGeometry();
const PersonalBestGhostMaterial = new THREE.LineDashedMaterial({
  color: 0x72d9ff,
  transparent: true,
  opacity: 0.56,
  dashSize: 0.48,
  gapSize: 0.3,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const PersonalBestGhostLine = new THREE.Line(
  PersonalBestGhostGeometry,
  PersonalBestGhostMaterial,
);
PersonalBestGhostLine.visible = false;
PersonalBestGhostLine.frustumCulled = false;
PersonalBestGhostLine.renderOrder = 2;
Scene.add(PersonalBestGhostLine);

const Renderer = new THREE.WebGLRenderer({
  canvas: GameCanvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
Renderer.outputColorSpace = THREE.SRGBColorSpace;
Renderer.toneMapping = THREE.ACESFilmicToneMapping;
Renderer.toneMappingExposure = ActiveSystem.environment.toneMappingExposure;
Renderer.shadowMap.enabled = true;
Renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const Camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
Camera.position.set(0, 0, 42);
Camera.lookAt(0, 0, 0);

const Clock = new THREE.Clock();
const PointerRaycaster = new THREE.Raycaster();
const PointerNormalizedDeviceCoordinates = new THREE.Vector2();
const OrbitalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const PointerWorldPosition = new THREE.Vector3();
const TemporaryThreeVector = new THREE.Vector3();
const CameraLookTarget = new THREE.Vector3();
const DesiredCameraLookTarget = new THREE.Vector3();
const AimDragVector = new THREE.Vector3();
const AimLaunchVelocity = new THREE.Vector3();
const LastAimPointerWorldPosition = new THREE.Vector3();
const PointerGestureStartWorldPosition = new THREE.Vector3();
const ScoutPointerStartWorldPosition = new THREE.Vector3();
const ScoutCameraStartTarget = new THREE.Vector3();
const ScoutCameraTarget = new THREE.Vector3();
const LocalSwayAxis = new THREE.Vector3(0, 0, 1);
const SurfaceSwayQuaternion = new THREE.Quaternion();
const RouteLabelProjection = new THREE.Vector3();

let PhysicsAccumulatorSeconds = 0;
let PhysicsElapsedTimeSeconds = 0;
let GameElapsedTimeSeconds = 0;
let RunFlightTimeSeconds = 0;
let IsPageActive = !document.hidden;
let IsWebGLContextAvailable = true;
let AdaptivePixelRatioCap = 2;
let SmoothPerformanceSampleCount = 0;
let PerformanceSampleElapsedSeconds = 0;
let PerformanceSampleFrameCount = 0;
let PerformanceSampleDeltaSeconds = 0;
let MaximumObservedDrawCalls = 0;
let GamePhase = 'attached';
let CurrentWorldIdentifier = StartingWorldIdentifier;
let LaunchIgnoredWorldIdentifier = null;
let LaunchIgnoredBodyIdentifier = null;
let IsPointerAiming = false;
let PointerGestureMode = SurfaceGestureModes.pending;
let IsPointerWalking = false;
let IsPointerScouting = false;
let IsKeyboardAiming = false;
let ActivePointerIdentifier = null;
let KeyboardAimState = createKeyboardAimState();
let IsScoutMode = false;
let ScoutZoomScale = 1;
let IsPersonalBestGhostEnabled = false;
let HasPersonalBestGhost = false;
let BaseCameraDistance = 42;
let FlightElapsedSeconds = 0;
let IsBreakerBurnAvailable = false;
let IsBreakerBurnPending = false;
let LastSafeSeedPosition = createVector();
let LastSafeWorldIdentifier = StartingWorldIdentifier;
let RecoveryTimeoutIdentifier = null;
let RunFailureTimeoutIdentifier = null;
let StatusToastTimeoutIdentifier = null;
let WorldheartCompletionTimeoutIdentifier = null;
let LeaderboardLoadSequence = 0;
let HasLaunchedOnce = false;
let LaunchPulseLifeSeconds = 0;
let ImpactPulseLifeSeconds = 0;
let CameraImpactLifeSeconds = 0;
let LiberationFlashLifeSeconds = 0;
let SeedstoneUsesRemaining = SeedstoneDefinition.uses;
let SeedstoneCrumbleStartedAtSeconds = null;
let AttachedSeedstoneSurfaceOffset = null;
let AttachedWorldheartSurfaceAngle = null;
let PendingWorldheartBankedPoints = 0;
let WorldheartJustUnlocked = false;
let FinaleRestorationStartedAtSeconds = null;
let PredictedStardustIdentifiers = new Set();
const FlightCollectedStardustIdentifiers = new Set();
let FlightOriginWorldIdentifier = null;
let FlightHadAsteroidClosePass = false;
const FlightClosePassWorldIdentifiers = new Set();
let SeedPhysicsState = {
  position: createVector(),
  velocity: createVector(),
};
let RunState = createRunState(ActiveSystem.launchBudget);
let ScoreState = createScoreState();
let ReplayState = createReplayRecorder({
  systemIdentifier: ActiveSystem.id,
  contentVersion: ActiveSystem.contentVersion,
  fixedStepHz: FixedPhysicsStepHertz,
});
let ReplayPlaybackState = null;
let RelayNetworkState = createRelayNetworkState(StartingWorldIdentifier);
let WardenPursuitState = createWardenPursuitState();
let ActiveHostileEncounterState = null;
const CompletedHostileEncounterWorldIdentifiers = new Set();
const WorldseedSound = new WorldseedAudio();
const ScannerWorldElements = new Map();
let ScannerHazardElement = null;
let ScannerCommandElement = null;
let ScannerProjection = null;
configureScannerInterface();

const WorldRuntimeByIdentifier = new Map();
const WorldRuntimesByVisualKey = new Map();
const EmptyWorldRuntimeList = [];
const ShaderMotionVisualKeys = ['grove', 'tide'];
const DeadWorldColor = new THREE.Color(0x575d60);
const DarkWorldColor = new THREE.Color(0x2c3337);
const RestorableWorldCount = getRestorableWorlds(WorldDefinitions).length;
const IsCampaignFinale = ActiveSystem.finale?.isCampaignFinale === true;
const InitialSceneBackgroundColor = ActiveSystem.environment.backgroundColor.clone();

/** Builds system-specific objective and completion UI from authored content. */
function configureSystemInterface() {
  VictoryEyebrowElement.textContent = ActiveSystem.completion.eyebrow;
  VictoryTitleElement.textContent = ActiveSystem.completion.title;
  VictoryBodyElement.textContent = ActiveSystem.completion.body;
  ConstellationSummaryElement.setAttribute(
    'aria-label',
    `${ActiveSystem.label} constellation summary`,
  );
  EmblemRowElement.setAttribute('aria-label', `${ActiveSystem.label} emblems`);
  PlayAgainButtonElement.textContent = NextSystemIdentifier
    ? `Continue to ${getAuthoredSystemDefinition(NextSystemIdentifier).label}`
    : '';
  PlayAgainButtonElement.hidden = !NextSystemIdentifier;

  ObjectivePipsElement.replaceChildren();
  for (let PipIndex = 0; PipIndex < ActiveSystem.worldheartUnlockThreshold; PipIndex += 1) {
    ObjectivePipsElement.append(document.createElement('span'));
  }
  ObjectivePipElements = [...ObjectivePipsElement.children];

  const SvgNamespace = 'http://www.w3.org/2000/svg';
  const ConstellationNodeByIdentifier = new Map(
    ActiveSystem.constellation.nodes.map((NodeDefinition) => [NodeDefinition.id, NodeDefinition]),
  );
  const ConstellationPath = document.createElementNS(SvgNamespace, 'path');
  ConstellationPath.setAttribute('d', ActiveSystem.constellation.edges.map((EdgeDefinition) => {
    const SourceNode = ConstellationNodeByIdentifier.get(EdgeDefinition[0]);
    const TargetNode = ConstellationNodeByIdentifier.get(EdgeDefinition[1]);
    return `M${SourceNode.x} ${SourceNode.y} L${TargetNode.x} ${TargetNode.y}`;
  }).join(' '));
  ConstellationSummaryElement.replaceChildren(ConstellationPath);

  for (const NodeDefinition of ActiveSystem.constellation.nodes) {
    const NodeGroup = document.createElementNS(SvgNamespace, 'g');
    NodeGroup.setAttribute('data-world-id', NodeDefinition.id);
    NodeGroup.classList.toggle('is-heart', NodeDefinition.isHeart === true);
    const NodeCircle = document.createElementNS(SvgNamespace, 'circle');
    NodeCircle.setAttribute('cx', String(NodeDefinition.x));
    NodeCircle.setAttribute('cy', String(NodeDefinition.y));
    NodeCircle.setAttribute('r', NodeDefinition.isHeart ? '7' : '5');
    const NodeTitle = document.createElementNS(SvgNamespace, 'title');
    NodeTitle.textContent = NodeDefinition.label;
    NodeGroup.append(NodeCircle, NodeTitle);
    ConstellationSummaryElement.append(NodeGroup);
  }
  ConstellationNodeElements = [
    ...ConstellationSummaryElement.querySelectorAll('[data-world-id]'),
  ];
}

function projectScannerPosition(Position) {
  const NormalizedX = (Position.x - ScannerProjection.minimumX) / ScannerProjection.width;
  const NormalizedY = (Position.y - ScannerProjection.minimumY) / ScannerProjection.height;
  return {
    x: 8 + (NormalizedX * 144),
    y: 82 - (NormalizedY * 74),
  };
}

/** Builds a compact spatial map only for systems that intentionally span several views. */
function configureScannerInterface() {
  const UsesExplorationCamera = ActiveSystem.camera?.followPlayer === true;
  ScannerPanelElement.hidden = !UsesExplorationCamera;
  GameCanvas.dataset.scannerAvailable = String(UsesExplorationCamera);
  if (!UsesExplorationCamera) {
    return;
  }

  const BoundsPositions = [
    ...WorldDefinitions.map((WorldDefinition) => WorldDefinition.position),
    WorldheartDefinition.position,
  ];
  if (AsteroidDefinition.orbit) {
    const Orbit = AsteroidDefinition.orbit;
    BoundsPositions.push(
      { x: Orbit.centre.x - Orbit.radius, y: Orbit.centre.y - Orbit.radius },
      { x: Orbit.centre.x + Orbit.radius, y: Orbit.centre.y + Orbit.radius },
    );
  }
  if (WorldheartDefinition.orbit) {
    const Orbit = WorldheartDefinition.orbit;
    BoundsPositions.push(
      { x: Orbit.centre.x - Orbit.radius, y: Orbit.centre.y - Orbit.radius },
      { x: Orbit.centre.x + Orbit.radius, y: Orbit.centre.y + Orbit.radius },
    );
  }
  const Margin = 4;
  const MinimumX = Math.min(...BoundsPositions.map((Position) => Position.x)) - Margin;
  const MaximumX = Math.max(...BoundsPositions.map((Position) => Position.x)) + Margin;
  const MinimumY = Math.min(...BoundsPositions.map((Position) => Position.y)) - Margin;
  const MaximumY = Math.max(...BoundsPositions.map((Position) => Position.y)) + Margin;
  ScannerProjection = {
    minimumX: MinimumX,
    minimumY: MinimumY,
    width: MaximumX - MinimumX,
    height: MaximumY - MinimumY,
  };

  const SvgNamespace = 'http://www.w3.org/2000/svg';
  ScannerBodyLayerElement.replaceChildren();
  ScannerWorldElements.clear();
  for (const WorldDefinition of WorldDefinitions) {
    const Marker = document.createElementNS(SvgNamespace, 'circle');
    const MarkerPosition = projectScannerPosition(WorldDefinition.position);
    Marker.setAttribute('cx', String(MarkerPosition.x));
    Marker.setAttribute('cy', String(MarkerPosition.y));
    Marker.setAttribute('r', String(Math.max(2.2, WorldDefinition.radius * 0.85)));
    Marker.classList.add('scanner-world');
    Marker.dataset.bodyIdentifier = WorldDefinition.id;
    ScannerBodyLayerElement.append(Marker);
    ScannerWorldElements.set(WorldDefinition.id, Marker);
  }

  const CommandMarker = document.createElementNS(SvgNamespace, 'circle');
  const CommandPosition = projectScannerPosition(WorldheartDefinition.position);
  CommandMarker.setAttribute('cx', String(CommandPosition.x));
  CommandMarker.setAttribute('cy', String(CommandPosition.y));
  CommandMarker.setAttribute('r', '4');
  CommandMarker.classList.add('scanner-command');
  ScannerBodyLayerElement.append(CommandMarker);
  ScannerCommandElement = CommandMarker;

  ScannerHazardElement = document.createElementNS(SvgNamespace, 'circle');
  ScannerHazardElement.setAttribute('r', '2');
  ScannerHazardElement.classList.add('scanner-hazard');
  ScannerBodyLayerElement.append(ScannerHazardElement);
}

function updateScannerInterface() {
  if (!ScannerProjection) {
    return;
  }
  const RunnerPosition = projectScannerPosition(SeedPhysicsState.position);
  ScannerRunnerElement.setAttribute('cx', String(RunnerPosition.x));
  ScannerRunnerElement.setAttribute('cy', String(RunnerPosition.y));
  for (const WorldDefinition of WorldDefinitions) {
    ScannerWorldElements.get(WorldDefinition.id)?.classList.toggle(
      'is-restored',
      WorldDefinition.restored,
    );
  }
  const HazardPosition = projectScannerPosition(calculateBodyPositionAtTime(
    AsteroidDefinition,
    PhysicsElapsedTimeSeconds,
  ));
  ScannerHazardElement.setAttribute('cx', String(HazardPosition.x));
  ScannerHazardElement.setAttribute('cy', String(HazardPosition.y));
  const CommandPosition = projectScannerPosition(WorldheartDefinition.position);
  ScannerCommandElement?.setAttribute('cx', String(CommandPosition.x));
  ScannerCommandElement?.setAttribute('cy', String(CommandPosition.y));
  GameCanvas.dataset.scannerRunnerX = RunnerPosition.x.toFixed(1);
  GameCanvas.dataset.scannerRunnerY = RunnerPosition.y.toFixed(1);
}

/**
 * Adds restrained scene lighting. The tiny-world art pass can later replace this with a
 * more authored lighting rig without changing gameplay code.
 */
function createLighting() {
  const HemisphereLight = new THREE.HemisphereLight(
    ActiveSystem.environment.hemisphereSkyColor,
    ActiveSystem.environment.hemisphereGroundColor,
    1.55,
  );
  Scene.add(HemisphereLight);

  const KeyLight = new THREE.DirectionalLight(ActiveSystem.environment.keyLightColor, 3.2);
  KeyLight.position.set(-12, 18, 24);
  KeyLight.castShadow = true;
  KeyLight.shadow.mapSize.set(1024, 1024);
  KeyLight.shadow.camera.left = -24;
  KeyLight.shadow.camera.right = 24;
  KeyLight.shadow.camera.top = 24;
  KeyLight.shadow.camera.bottom = -24;
  KeyLight.shadow.camera.near = 4;
  KeyLight.shadow.camera.far = 80;
  KeyLight.shadow.bias = -0.0004;
  KeyLight.shadow.normalBias = 0.035;
  Scene.add(KeyLight);

  const FillLight = new THREE.DirectionalLight(ActiveSystem.environment.fillLightColor, 1.0);
  FillLight.position.set(18, -10, 14);
  Scene.add(FillLight);

  const RimLight = new THREE.DirectionalLight(ActiveSystem.environment.rimLightColor, 1.15);
  RimLight.position.set(8, 12, -18);
  Scene.add(RimLight);
}

/** Adds a soft generated colour field behind the stars without an external texture. */
function createBackgroundGlow(Position, Scale, InnerRed, InnerGreen, InnerBlue, InnerAlpha) {
  const GlowCanvas = document.createElement('canvas');
  GlowCanvas.width = 128;
  GlowCanvas.height = 128;
  const GlowContext = GlowCanvas.getContext('2d');
  const GlowGradient = GlowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  GlowGradient.addColorStop(
    0,
    `rgba(${InnerRed}, ${InnerGreen}, ${InnerBlue}, ${InnerAlpha})`,
  );
  GlowGradient.addColorStop(
    0.45,
    `rgba(${InnerRed}, ${InnerGreen}, ${InnerBlue}, ${InnerAlpha * 0.36})`,
  );
  GlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  GlowContext.fillStyle = GlowGradient;
  GlowContext.fillRect(0, 0, 128, 128);

  const GlowTexture = new THREE.CanvasTexture(GlowCanvas);
  GlowTexture.colorSpace = THREE.SRGBColorSpace;
  const GlowMaterial = new THREE.SpriteMaterial({
    map: GlowTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const GlowSprite = new THREE.Sprite(GlowMaterial);
  GlowSprite.position.copy(Position);
  GlowSprite.scale.set(Scale.x, Scale.y, 1);
  Scene.add(GlowSprite);
}

/**
 * Creates a deterministic star field using a small seeded pseudo-random generator. The
 * fixed layout avoids visual popping between resets and keeps screenshots reproducible.
 */
function createStarField() {
  let RandomState = 732451;

  function nextRandomValue() {
    RandomState = (RandomState * 1664525 + 1013904223) % 4294967296;
    return RandomState / 4294967296;
  }

  const StarCount = 620;
  const StarPositions = new Float32Array(StarCount * 3);

  for (let StarIndex = 0; StarIndex < StarCount; StarIndex += 1) {
    const PositionOffset = StarIndex * 3;
    StarPositions[PositionOffset] = (nextRandomValue() - 0.5) * 92;
    StarPositions[PositionOffset + 1] = (nextRandomValue() - 0.5) * 68;
    StarPositions[PositionOffset + 2] = -8 - (nextRandomValue() * 28);
  }

  const StarGeometry = new THREE.BufferGeometry();
  StarGeometry.setAttribute('position', new THREE.BufferAttribute(StarPositions, 3));

  const StarMaterial = new THREE.PointsMaterial({
    color: 0xc9d8e1,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  const StarField = new THREE.Points(StarGeometry, StarMaterial);
  Scene.add(StarField);

  createBackgroundGlow(
    new THREE.Vector3(-15, -9, -24),
    new THREE.Vector2(35, 27),
    40,
    106,
    92,
    0.16,
  );
  createBackgroundGlow(
    new THREE.Vector3(14, 10, -26),
    new THREE.Vector2(31, 25),
    52,
    75,
    130,
    0.14,
  );
}

/**
 * Creates simple contour rings around a world. These are placeholder composition tools,
 * but they already make each sphere read as a self-contained miniature object rather than
 * as an arbitrary collision primitive.
 *
 * @param {number} WorldRadius - Radius of the world being decorated.
 * @param {THREE.Color} RingColor - Accent colour for restored-state rings.
 * @returns {THREE.Group} Group containing the ring meshes.
 */
function createWorldContourRings(WorldRadius, RingColor) {
  const RingGroup = new THREE.Group();

  for (let RingIndex = 0; RingIndex < 2; RingIndex += 1) {
    const RingGeometry = new THREE.TorusGeometry(
      WorldRadius * (1.01 + (RingIndex * 0.008)),
      0.015,
      4,
      96,
    );
    const RingMaterial = new THREE.MeshBasicMaterial({
      color: RingColor,
      transparent: true,
      opacity: RingIndex === 0 ? 0.12 : 0.07,
      depthWrite: false,
    });
    const RingMesh = new THREE.Mesh(RingGeometry, RingMaterial);
    RingMesh.rotation.x = Math.PI * (0.42 + (RingIndex * 0.19));
    RingMesh.rotation.y = Math.PI * (0.12 + (RingIndex * 0.17));
    RingGroup.add(RingMesh);
  }

  return RingGroup;
}

/** Wraps an occupied world in a rigid, readable Stillness control field. */
function createStillnessCage(WorldDefinition) {
  const CageGroup = new THREE.Group();
  const CageMaterial = new THREE.MeshBasicMaterial({
    color: 0x82a8b4,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const CageRadius = WorldDefinition.radius * 1.14;
  const Rotations = [
    [Math.PI * 0.5, 0, 0],
    [Math.PI * 0.22, Math.PI * 0.34, Math.PI * 0.08],
    [Math.PI * 0.72, Math.PI * -0.2, Math.PI * 0.38],
  ];
  for (const [RotationX, RotationY, RotationZ] of Rotations) {
    const CageRing = new THREE.Mesh(
      new THREE.TorusGeometry(CageRadius, 0.025, 5, 72),
      CageMaterial,
    );
    CageRing.rotation.set(RotationX, RotationY, RotationZ);
    CageGroup.add(CageRing);
  }
  CageGroup.visible = !WorldDefinition.restored;
  return { group: CageGroup, material: CageMaterial };
}

/**
 * Extends a standard lit material with the spherical dead-to-alive colour wave.
 *
 * @param {object} WorldDefinition - Gameplay and visual definition for the world.
 * @returns {{material:THREE.MeshStandardMaterial, uniforms:object}} Material and live uniforms.
 */
function createRestorationSurfaceMaterial(WorldDefinition) {
  const RestorationUniforms = {
    restorationOrigin: { value: new THREE.Vector3(1, 0, 0) },
    restorationProgress: { value: WorldDefinition.restored ? 1.2 : -0.1 },
    restorationWaveWidth: { value: WorldDefinition.restoration.waveWidth },
    deadColor: { value: DeadWorldColor.clone() },
    aliveColor: { value: WorldDefinition.aliveColor.clone() },
    waveColor: { value: WorldDefinition.restoration.waveColor.clone() },
    surfaceVariation: { value: WorldDefinition.restoration.surfaceVariation },
    accentColor: { value: (WorldDefinition.accentColor ?? WorldDefinition.aliveColor).clone() },
    biomeStyle: { value: WorldDefinition.biomeStyle ?? 0 },
    biomeTime: { value: 0 },
  };
  const SurfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: false,
  });

  SurfaceMaterial.onBeforeCompile = (Shader) => {
    Object.assign(Shader.uniforms, RestorationUniforms);
    Shader.vertexShader = Shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float restorationProgress;
        attribute vec3 restorationDirection;
        attribute float landmarkMask;
        varying vec3 vRestorationDirection;
        varying float vLandmarkMask;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vRestorationDirection = normalize(restorationDirection);
        vLandmarkMask = landmarkMask;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float landmarkGrowth = smoothstep(-0.02, 0.72, restorationProgress);
        transformed *= mix(1.0, 0.28 + (landmarkGrowth * 0.72), landmarkMask);`,
      );
    Shader.fragmentShader = Shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRestorationDirection;
        varying float vLandmarkMask;
        uniform vec3 restorationOrigin;
        uniform float restorationProgress;
        uniform float restorationWaveWidth;
        uniform vec3 deadColor;
        uniform vec3 aliveColor;
        uniform vec3 waveColor;
        uniform float surfaceVariation;
        uniform vec3 accentColor;
        uniform float biomeStyle;
        uniform float biomeTime;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float restorationDistance = acos(clamp(dot(
          normalize(vRestorationDirection),
          normalize(restorationOrigin)
        ), -1.0, 1.0)) / PI;
        float restoredSurface = 1.0 - smoothstep(
          restorationProgress - restorationWaveWidth,
          restorationProgress + restorationWaveWidth,
          restorationDistance
        );
        float activeRestorationWave = 1.0 - step(1.001, restorationProgress);
        float restorationBand = 1.0 - smoothstep(
          restorationWaveWidth * 0.35,
          restorationWaveWidth * 2.2,
          abs(restorationDistance - restorationProgress)
        );
        float surfacePattern = sin(vRestorationDirection.x * 17.0)
          * sin(vRestorationDirection.y * 23.0)
          * sin(vRestorationDirection.z * 19.0);
        vec3 variedAliveColor = aliveColor * (1.0 + (surfacePattern * surfaceVariation));
        if (biomeStyle > 0.5 && biomeStyle < 1.5) {
          float rootVeins = 0.5 + (0.5 * sin(
            (vRestorationDirection.x * 18.0)
            + (vRestorationDirection.y * 9.0)
            + (vRestorationDirection.z * 15.0)
            + (biomeTime * 0.18)
          ));
          variedAliveColor = mix(variedAliveColor, accentColor, rootVeins * 0.34);
        } else if (biomeStyle > 1.5) {
          float tideBands = 0.5 + (0.5 * sin(
            (vRestorationDirection.y * 24.0)
            + (vRestorationDirection.x * 7.0)
            + (biomeTime * 0.9)
          ));
          variedAliveColor = mix(variedAliveColor, accentColor, tideBands * 0.52);
        }
        variedAliveColor = mix(variedAliveColor, accentColor, vLandmarkMask * 0.82);
        float controlLatitude = abs(sin(vRestorationDirection.y * 24.0));
        float controlLongitude = abs(sin(
          atan(vRestorationDirection.z, vRestorationDirection.x) * 9.0
        ));
        float controlGrid = smoothstep(0.88, 0.98, max(
          controlLatitude,
          controlLongitude
        ));
        vec3 occupiedColor = deadColor * (0.72 + (surfacePattern * 0.035));
        occupiedColor += vec3(0.11, 0.2, 0.23) * controlGrid;
        diffuseColor.rgb = mix(occupiedColor, variedAliveColor, restoredSurface);
        diffuseColor.rgb += waveColor * restorationBand * activeRestorationWave * 0.9;`,
      );
  };
  SurfaceMaterial.customProgramCacheKey = () => 'orbitbreak-restoration-surface-v3';

  return { material: SurfaceMaterial, uniforms: RestorationUniforms };
}

/**
 * Creates a transparent additive shell that blooms along the active wavefront.
 *
 * @param {object} WorldDefinition - Gameplay and visual definition for the world.
 * @param {object} RestorationUniforms - Uniforms shared with the surface material.
 * @returns {{mesh:THREE.Mesh, material:THREE.ShaderMaterial}} Shell render components.
 */
function createRestorationWaveShell(WorldDefinition, RestorationUniforms) {
  const WaveMaterial = new THREE.ShaderMaterial({
    uniforms: {
      restorationOrigin: RestorationUniforms.restorationOrigin,
      restorationProgress: RestorationUniforms.restorationProgress,
      restorationWaveWidth: RestorationUniforms.restorationWaveWidth,
      waveColor: RestorationUniforms.waveColor,
    },
    vertexShader: `
      varying vec3 vSurfaceNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        vSurfaceNormal = normalize(normal);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vSurfaceNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;
      uniform vec3 restorationOrigin;
      uniform float restorationProgress;
      uniform float restorationWaveWidth;
      uniform vec3 waveColor;

      void main() {
        float restorationDistance = acos(clamp(dot(
          normalize(vSurfaceNormal),
          normalize(restorationOrigin)
        ), -1.0, 1.0)) / 3.141592653589793;
        float waveBand = 1.0 - smoothstep(
          restorationWaveWidth * 0.45,
          restorationWaveWidth * 1.8,
          abs(restorationDistance - restorationProgress)
        );
        float fresnel = pow(1.0 - max(dot(vViewNormal, vViewDirection), 0.0), 2.0);
        float activeWave = step(-0.001, restorationProgress)
          * (1.0 - step(1.001, restorationProgress));
        float alpha = waveBand * (0.52 + (fresnel * 0.58)) * activeWave;
        gl_FragColor = vec4(waveColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const WaveGeometry = new THREE.SphereGeometry(
    WorldDefinition.radius * 1.018,
    usesMergedSurfaceLandmarks(WorldDefinition) ? 32 : 64,
    usesMergedSurfaceLandmarks(WorldDefinition) ? 20 : 40,
  );
  const WaveMesh = new THREE.Mesh(WaveGeometry, WaveMaterial);
  WaveMesh.visible = false;
  WaveMesh.renderOrder = 5;

  return { mesh: WaveMesh, material: WaveMaterial };
}

/** Records a prop material's authored colour so the restoration wave can reveal it. */
function registerRestorableMaterial(PropObject, Material, AliveColor = Material.color) {
  if (!PropObject.userData.restorationMaterials) {
    PropObject.userData.restorationMaterials = [];
  }
  PropObject.userData.restorationMaterials.push({
    material: Material,
    aliveColor: AliveColor.clone(),
    aliveEmissive: Material.emissive ? Material.emissive.clone() : null,
    aliveEmissiveIntensity: Material.emissiveIntensity ?? 0,
  });
}

/** Applies dead-to-alive colour to every material owned by a surface prop. */
function setSurfacePropRestorationProgress(PropObject, RestorationProgress) {
  const RestorationMaterials = PropObject.userData.restorationMaterials ?? [];
  for (const RestorationMaterial of RestorationMaterials) {
    RestorationMaterial.material.color.copy(DarkWorldColor).lerp(
      RestorationMaterial.aliveColor,
      RestorationProgress,
    );
    if (RestorationMaterial.aliveEmissive && RestorationMaterial.material.emissive) {
      RestorationMaterial.material.emissive.set(0x000000).lerp(
        RestorationMaterial.aliveEmissive,
        RestorationProgress,
      );
      RestorationMaterial.material.emissiveIntensity = (
        RestorationMaterial.aliveEmissiveIntensity * RestorationProgress
      );
    }
  }
}

/** Places a local-Y-up prop against a spherical surface and registers wave metadata. */
function placeSurfaceProp(
  PropObject,
  SurfaceDirection,
  WorldRadius,
  BaseScale = 1,
  SurfaceOffset = 0,
) {
  const NormalizedDirection = SurfaceDirection.clone().normalize();
  PropObject.position.copy(NormalizedDirection).multiplyScalar(WorldRadius + SurfaceOffset);
  PropObject.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), NormalizedDirection);
  PropObject.userData.baseQuaternion = PropObject.quaternion.clone();
  PropObject.scale.setScalar(BaseScale);
  PropObject.userData.surfaceDirection = NormalizedDirection;
  PropObject.userData.baseScale = BaseScale;
  PropObject.userData.restorationDistance = 1;
  return PropObject;
}

/** Creates a compact placeholder prop set for worlds awaiting their authored art pass. */
function createPlaceholderSurfaceProps(WorldDefinition) {
  const SurfacePropGroup = new THREE.Group();
  const MarkerGeometry = new THREE.ConeGeometry(0.16, 0.55, 5);

  for (let MarkerIndex = 0; MarkerIndex < 9; MarkerIndex += 1) {
    const MarkerMaterial = new THREE.MeshStandardMaterial({
      color: WorldDefinition.restored
        ? WorldDefinition.aliveColor.clone().offsetHSL(0, 0, 0.16)
        : DarkWorldColor,
      roughness: 0.92,
    });
    const MarkerMesh = new THREE.Mesh(MarkerGeometry, MarkerMaterial);
    const MarkerAngle = (MarkerIndex / 9) * Math.PI * 2;
    const MarkerLatitudeOffset = Math.sin(MarkerIndex * 1.7) * 0.42;
    const SurfaceDirection = new THREE.Vector3(
      Math.cos(MarkerAngle) * Math.cos(MarkerLatitudeOffset),
      Math.sin(MarkerAngle) * Math.cos(MarkerLatitudeOffset),
      Math.sin(MarkerLatitudeOffset),
    );
    const MarkerBaseScale = 0.9 + ((MarkerIndex % 3) * 0.2);

    placeSurfaceProp(MarkerMesh, SurfaceDirection, WorldDefinition.radius + 0.22, MarkerBaseScale);
    registerRestorableMaterial(
      MarkerMesh,
      MarkerMaterial,
      WorldDefinition.aliveColor.clone().offsetHSL(0, 0, 0.16),
    );
    SurfacePropGroup.add(MarkerMesh);
  }

  return SurfacePropGroup;
}

/** Adds the custom attributes shared by the restoration and landmark-growth shaders. */
function addRestorationGeometryAttributes(
  Geometry,
  FixedRestorationDirection = null,
  LandmarkMaskValue = 0,
) {
  const PositionAttribute = Geometry.getAttribute('position');
  const RestorationDirections = new Float32Array(PositionAttribute.count * 3);
  const LandmarkMasks = new Float32Array(PositionAttribute.count);

  for (let VertexIndex = 0; VertexIndex < PositionAttribute.count; VertexIndex += 1) {
    const AttributeOffset = VertexIndex * 3;
    if (FixedRestorationDirection) {
      RestorationDirections[AttributeOffset] = FixedRestorationDirection.x;
      RestorationDirections[AttributeOffset + 1] = FixedRestorationDirection.y;
      RestorationDirections[AttributeOffset + 2] = FixedRestorationDirection.z;
    } else {
      TemporaryThreeVector.set(
        PositionAttribute.getX(VertexIndex),
        PositionAttribute.getY(VertexIndex),
        PositionAttribute.getZ(VertexIndex),
      ).normalize();
      RestorationDirections[AttributeOffset] = TemporaryThreeVector.x;
      RestorationDirections[AttributeOffset + 1] = TemporaryThreeVector.y;
      RestorationDirections[AttributeOffset + 2] = TemporaryThreeVector.z;
    }
    LandmarkMasks[VertexIndex] = LandmarkMaskValue;
  }

  Geometry.setAttribute(
    'restorationDirection',
    new THREE.BufferAttribute(RestorationDirections, 3),
  );
  Geometry.setAttribute('landmarkMask', new THREE.BufferAttribute(LandmarkMasks, 1));
  return Geometry;
}

/** Places one geometry on a spherical surface before it enters a merged one-call landmark. */
function createPlacedLandmarkGeometry(
  SourceGeometry,
  SurfaceDirection,
  WorldRadius,
  Scale = 1,
  TangentRotationRadians = 0,
) {
  const LandmarkGeometry = SourceGeometry.index
    ? SourceGeometry.toNonIndexed()
    : SourceGeometry.clone();
  const NormalizedDirection = SurfaceDirection.clone().normalize();
  const Placement = new THREE.Object3D();
  Placement.position.copy(NormalizedDirection).multiplyScalar(WorldRadius);
  Placement.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), NormalizedDirection);
  Placement.rotateY(TangentRotationRadians);
  Placement.scale.setScalar(Scale);
  Placement.updateMatrix();
  LandmarkGeometry.applyMatrix4(Placement.matrix);
  addRestorationGeometryAttributes(LandmarkGeometry, NormalizedDirection, 1);
  return LandmarkGeometry;
}

/** Places a readable front-facing silhouette into the rotating one-call surface mesh. */
function createFrontLandmarkGeometry(
  SourceGeometry,
  WorldRadius,
  OffsetX = 0,
  OffsetY = 0,
  Scale = 1,
  RotationRadians = 0,
  SurfaceYawRadians = 0,
) {
  const LandmarkGeometry = SourceGeometry.index
    ? SourceGeometry.toNonIndexed()
    : SourceGeometry.clone();
  const Placement = new THREE.Object3D();
  Placement.position.set(OffsetX, OffsetY, WorldRadius);
  Placement.rotation.z = RotationRadians;
  Placement.scale.setScalar(Scale);
  Placement.updateMatrix();
  LandmarkGeometry.applyMatrix4(Placement.matrix);
  LandmarkGeometry.rotateY(SurfaceYawRadians);
  addRestorationGeometryAttributes(
    LandmarkGeometry,
    new THREE.Vector3(Math.sin(SurfaceYawRadians), 0, Math.cos(SurfaceYawRadians)),
    1,
  );
  return LandmarkGeometry;
}

/** Merges compatible non-indexed geometries into one surface draw call. */
function mergeRestorationGeometries(Geometries) {
  const AttributeNames = ['position', 'normal', 'restorationDirection', 'landmarkMask'];
  const MergedGeometry = new THREE.BufferGeometry();

  for (const AttributeName of AttributeNames) {
    const ItemSize = Geometries[0].getAttribute(AttributeName).itemSize;
    const TotalValueCount = Geometries.reduce(
      (ValueCount, Geometry) => ValueCount + Geometry.getAttribute(AttributeName).array.length,
      0,
    );
    const MergedValues = new Float32Array(TotalValueCount);
    let ValueOffset = 0;
    for (const Geometry of Geometries) {
      const SourceValues = Geometry.getAttribute(AttributeName).array;
      MergedValues.set(SourceValues, ValueOffset);
      ValueOffset += SourceValues.length;
    }
    MergedGeometry.setAttribute(AttributeName, new THREE.BufferAttribute(MergedValues, ItemSize));
  }

  MergedGeometry.computeBoundingSphere();
  for (const Geometry of Geometries) {
    Geometry.dispose();
  }
  return MergedGeometry;
}

/** Starts one lightweight authored world with a faceted restorable sphere. */
function createMergedWorldSurfaceBase(WorldDefinition) {
  const BaseSourceGeometry = new THREE.IcosahedronGeometry(WorldDefinition.radius, 3);
  const BaseGeometry = BaseSourceGeometry.index
    ? BaseSourceGeometry.toNonIndexed()
    : BaseSourceGeometry.clone();
  BaseSourceGeometry.dispose();
  addRestorationGeometryAttributes(BaseGeometry);
  return [BaseGeometry];
}

/** Builds Relay's three fractured signal rings into its surface draw call. */
function createRelaySurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const RingSource = new THREE.TorusGeometry(
    WorldDefinition.radius * 1.06,
    0.095,
    5,
    42,
  );
  const RingRotations = [
    { x: 0.08, y: 0.18 },
    { x: 1.03, y: -0.34 },
    { x: -0.82, y: 0.7 },
  ];
  for (const RingRotation of RingRotations) {
    const RingGeometry = RingSource.index
      ? RingSource.toNonIndexed()
      : RingSource.clone();
    RingGeometry.rotateX(RingRotation.x);
    RingGeometry.rotateY(RingRotation.y);
    addRestorationGeometryAttributes(RingGeometry, null, 1);
    Geometries.push(RingGeometry);
  }
  RingSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Kiln's crown of dormant exhaust stacks into its surface draw call. */
function createKilnSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const VentSource = new THREE.ConeGeometry(0.28, 1.15, 6, 1, true);
  VentSource.translate(0, 0.575, 0);
  const VentDirections = [
    new THREE.Vector3(-0.58, 0.2, 0.82),
    new THREE.Vector3(-0.18, 0.54, 0.84),
    new THREE.Vector3(0.28, 0.48, 0.86),
    new THREE.Vector3(0.62, 0.08, 0.8),
    new THREE.Vector3(0.12, -0.46, 0.9),
  ];
  VentDirections.forEach((VentDirection, VentIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      VentSource,
      VentDirection,
      WorldDefinition.radius - 0.04,
      0.85 + ((VentIndex % 3) * 0.13),
      VentIndex * 0.53,
    ));
  });
  VentSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Loom's linked route arches around the world in one draw call. */
function createLoomSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const ArchSource = new THREE.TorusGeometry(0.7, 0.11, 5, 20, Math.PI);
  const ArchYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
  for (const ArchYaw of ArchYaws) {
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource,
      WorldDefinition.radius + 0.08,
      -0.26,
      -0.04,
      0.92,
      -0.12,
      ArchYaw,
    ));
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource,
      WorldDefinition.radius + 0.08,
      0.26,
      -0.04,
      0.92,
      0.12,
      ArchYaw,
    ));
  }
  ArchSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Shard's asymmetric crystal crown into its surface draw call. */
function createShardSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const CrystalSource = new THREE.ConeGeometry(0.34, 1.45, 5);
  CrystalSource.translate(0, 0.725, 0);
  const CrystalDirections = [
    new THREE.Vector3(-0.5, 0.42, 0.82),
    new THREE.Vector3(-0.1, 0.68, 0.76),
    new THREE.Vector3(0.32, 0.52, 0.82),
    new THREE.Vector3(0.58, 0.05, 0.84),
    new THREE.Vector3(-0.18, -0.42, 0.9),
    new THREE.Vector3(0.38, -0.35, 0.88),
  ];
  CrystalDirections.forEach((CrystalDirection, CrystalIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      CrystalSource,
      CrystalDirection,
      WorldDefinition.radius - 0.06,
      0.72 + ((CrystalIndex % 4) * 0.18),
      CrystalIndex * 0.64,
    ));
  });
  CrystalSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Vault's protective ribs around its memory core in one draw call. */
function createVaultSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const RibSource = new THREE.TorusGeometry(0.82, 0.1, 5, 24, Math.PI);
  const RibYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
  RibYaws.forEach((RibYaw, RibIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      RibSource,
      WorldDefinition.radius + 0.1,
      0,
      -0.08,
      0.92 + ((RibIndex % 2) * 0.08),
      (RibIndex % 2 === 0 ? -1 : 1) * 0.14,
      RibYaw,
    ));
  });
  RibSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Grove's joined-root arch and clustered saplings into its existing surface call. */
function createGroveSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);

  const RootArchSource = new THREE.TorusGeometry(0.92, 0.14, 5, 20, Math.PI);
  Geometries.push(createFrontLandmarkGeometry(
    RootArchSource,
    WorldDefinition.radius - 0.04,
    0,
    -0.12,
    1,
    -0.08,
  ));

  const TrunkSource = new THREE.CylinderGeometry(0.085, 0.13, 0.68, 6);
  TrunkSource.translate(0, 0.34, 0);
  const CanopySource = new THREE.IcosahedronGeometry(0.34, 1);
  CanopySource.translate(0, 0.82, 0);
  const SaplingDirections = [
    new THREE.Vector3(-0.45, 0.1, 0.9),
    new THREE.Vector3(0.42, 0.16, 0.9),
    new THREE.Vector3(0, -0.38, 0.92),
  ];
  SaplingDirections.forEach((SurfaceDirection, SaplingIndex) => {
    const SaplingScale = 0.95 + (SaplingIndex * 0.11);
    Geometries.push(createPlacedLandmarkGeometry(
      TrunkSource,
      SurfaceDirection,
      WorldDefinition.radius,
      SaplingScale,
      SaplingIndex * 0.7,
    ));
    Geometries.push(createPlacedLandmarkGeometry(
      CanopySource,
      SurfaceDirection,
      WorldDefinition.radius,
      SaplingScale,
      SaplingIndex * 0.7,
    ));
  });

  RootArchSource.dispose();
  TrunkSource.dispose();
  CanopySource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Tide's three repeating wave crests into its existing surface call. */
function createTideSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const WaveCrestSource = new THREE.TorusGeometry(0.75, 0.16, 5, 18, Math.PI);
  const WaveCrestRows = [
    { y: 0.52, scale: 0.7, rotation: 0.08 },
    { y: 0, scale: 0.86, rotation: 0 },
    { y: -0.52, scale: 0.72, rotation: -0.08 },
  ];
  const WaveClusterYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
  WaveClusterYaws.forEach((WaveClusterYaw) => {
    WaveCrestRows.forEach((WaveCrestRow) => {
      Geometries.push(createFrontLandmarkGeometry(
        WaveCrestSource,
        WorldDefinition.radius + 0.18,
        0,
        WaveCrestRow.y,
        WaveCrestRow.scale,
        WaveCrestRow.rotation,
        WaveClusterYaw,
      ));
    });
  });
  WaveCrestSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Bower's sheltering vine arches into one restorable silhouette. */
function createBowerSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const ArchSource = new THREE.TorusGeometry(0.92, 0.13, 5, 20, Math.PI);
  [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5].forEach((ArchYaw, ArchIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource,
      WorldDefinition.radius + 0.08,
      0,
      -0.18,
      0.92 + ((ArchIndex % 2) * 0.12),
      ArchIndex % 2 === 0 ? -0.12 : 0.12,
      ArchYaw,
    ));
  });
  ArchSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Lantern's upward flower lamps into its existing surface call. */
function createLanternSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const LampSource = new THREE.ConeGeometry(0.4, 1.25, 7, 1, true);
  LampSource.translate(0, 0.625, 0);
  const LampDirections = [
    new THREE.Vector3(-0.52, 0.26, 0.84),
    new THREE.Vector3(-0.12, 0.58, 0.82),
    new THREE.Vector3(0.34, 0.48, 0.84),
    new THREE.Vector3(0.6, 0.04, 0.82),
    new THREE.Vector3(0.08, -0.48, 0.9),
  ];
  LampDirections.forEach((LampDirection, LampIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      LampSource,
      LampDirection,
      WorldDefinition.radius - 0.06,
      0.78 + ((LampIndex % 3) * 0.13),
      LampIndex * 0.72,
    ));
  });
  LampSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Canopy's clustered treetops as a single low-cost world mesh. */
function createCanopySurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const TrunkSource = new THREE.CylinderGeometry(0.08, 0.15, 0.72, 6);
  TrunkSource.translate(0, 0.36, 0);
  const CrownSource = new THREE.IcosahedronGeometry(0.42, 1);
  CrownSource.translate(0, 0.86, 0);
  const TreeDirections = [
    new THREE.Vector3(-0.52, 0.24, 0.84),
    new THREE.Vector3(-0.08, 0.62, 0.8),
    new THREE.Vector3(0.44, 0.38, 0.84),
    new THREE.Vector3(0.28, -0.38, 0.9),
    new THREE.Vector3(-0.36, -0.34, 0.88),
  ];
  TreeDirections.forEach((TreeDirection, TreeIndex) => {
    const TreeScale = 0.82 + ((TreeIndex % 3) * 0.13);
    Geometries.push(createPlacedLandmarkGeometry(
      TrunkSource, TreeDirection, WorldDefinition.radius, TreeScale, TreeIndex * 0.6,
    ));
    Geometries.push(createPlacedLandmarkGeometry(
      CrownSource, TreeDirection, WorldDefinition.radius, TreeScale, TreeIndex * 0.6,
    ));
  });
  TrunkSource.dispose();
  CrownSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Crown's ring of oversized petals around a dark central bloom. */
function createCrownSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const PetalSource = new THREE.IcosahedronGeometry(0.48, 1);
  PetalSource.scale(0.62, 1.45, 0.8);
  PetalSource.translate(0, 0.62, 0);
  const PetalDirections = [
    new THREE.Vector3(-0.58, 0.3, 0.8),
    new THREE.Vector3(-0.18, 0.64, 0.78),
    new THREE.Vector3(0.28, 0.58, 0.8),
    new THREE.Vector3(0.62, 0.16, 0.8),
    new THREE.Vector3(0.42, -0.38, 0.84),
    new THREE.Vector3(-0.12, -0.52, 0.88),
    new THREE.Vector3(-0.54, -0.22, 0.84),
  ];
  PetalDirections.forEach((PetalDirection, PetalIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      PetalSource,
      PetalDirection,
      WorldDefinition.radius - 0.08,
      0.8 + ((PetalIndex % 2) * 0.12),
      PetalIndex * 0.84,
    ));
  });
  PetalSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Dew's crystalline droplets into a clean, cool silhouette. */
function createDewSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const DropSource = new THREE.ConeGeometry(0.3, 1.05, 7);
  DropSource.translate(0, 0.525, 0);
  const DropDirections = [
    new THREE.Vector3(-0.5, 0.4, 0.82),
    new THREE.Vector3(0, 0.68, 0.76),
    new THREE.Vector3(0.48, 0.38, 0.82),
    new THREE.Vector3(0.5, -0.28, 0.84),
    new THREE.Vector3(-0.12, -0.5, 0.88),
  ];
  DropDirections.forEach((DropDirection, DropIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      DropSource,
      DropDirection,
      WorldDefinition.radius - 0.04,
      0.72 + ((DropIndex % 3) * 0.16),
      DropIndex * 0.66,
    ));
  });
  DropSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Nest's woven protective ribs around its small resting place. */
function createNestSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const RibSource = new THREE.TorusGeometry(0.78, 0.09, 5, 22, Math.PI * 1.25);
  [0, 0.74, 1.48, 2.22].forEach((RibRotation, RibIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      RibSource,
      WorldDefinition.radius + 0.1,
      0,
      -0.12,
      0.9 + ((RibIndex % 2) * 0.1),
      RibRotation * 0.16,
      RibRotation,
    ));
  });
  RibSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Vigil's ring of stubborn watchtowers into one restorable surface. */
function createVigilSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const TowerSource = new THREE.CylinderGeometry(0.18, 0.28, 0.92, 6);
  TowerSource.translate(0, 0.46, 0);
  const FlameSource = new THREE.ConeGeometry(0.18, 0.48, 6);
  FlameSource.translate(0, 1.03, 0);
  const TowerDirections = [
    new THREE.Vector3(-0.56, 0.3, 0.8),
    new THREE.Vector3(-0.12, 0.62, 0.8),
    new THREE.Vector3(0.42, 0.46, 0.82),
    new THREE.Vector3(0.58, -0.12, 0.84),
    new THREE.Vector3(0.08, -0.5, 0.88),
    new THREE.Vector3(-0.44, -0.3, 0.88),
  ];
  TowerDirections.forEach((TowerDirection, TowerIndex) => {
    const TowerScale = 0.82 + ((TowerIndex % 3) * 0.12);
    Geometries.push(createPlacedLandmarkGeometry(
      TowerSource, TowerDirection, WorldDefinition.radius, TowerScale, TowerIndex * 0.58,
    ));
    Geometries.push(createPlacedLandmarkGeometry(
      FlameSource, TowerDirection, WorldDefinition.radius, TowerScale, TowerIndex * 0.58,
    ));
  });
  TowerSource.dispose();
  FlameSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Pyre's swept flame crown as a single low-cost silhouette. */
function createPyreSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const FlameSource = new THREE.ConeGeometry(0.34, 1.42, 6);
  FlameSource.translate(0, 0.71, 0);
  FlameSource.rotateZ(-0.14);
  const FlameDirections = [
    new THREE.Vector3(-0.52, 0.36, 0.82),
    new THREE.Vector3(-0.12, 0.66, 0.78),
    new THREE.Vector3(0.34, 0.54, 0.8),
    new THREE.Vector3(0.62, 0.08, 0.82),
    new THREE.Vector3(0.3, -0.42, 0.88),
    new THREE.Vector3(-0.3, -0.42, 0.88),
  ];
  FlameDirections.forEach((FlameDirection, FlameIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      FlameSource,
      FlameDirection,
      WorldDefinition.radius - 0.05,
      0.76 + ((FlameIndex % 3) * 0.16),
      FlameIndex * 0.7,
    ));
  });
  FlameSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Hollow's empty bell arches around its quiet surface. */
function createHollowSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const BellSource = new THREE.ConeGeometry(0.42, 0.68, 8, 1, true);
  BellSource.translate(0, 0.4, 0);
  const ArchSource = new THREE.TorusGeometry(0.62, 0.09, 5, 18, Math.PI);
  const BellYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
  BellYaws.forEach((BellYaw, BellIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource,
      WorldDefinition.radius + 0.06,
      0,
      -0.12,
      0.88,
      BellIndex % 2 === 0 ? -0.08 : 0.08,
      BellYaw,
    ));
    Geometries.push(createFrontLandmarkGeometry(
      BellSource,
      WorldDefinition.radius + 0.08,
      0,
      0.18,
      0.82,
      Math.PI,
      BellYaw,
    ));
  });
  BellSource.dispose();
  ArchSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Beacon's radial star fins into its planet-wrapping restoration surface. */
function createBeaconSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const RaySource = new THREE.ConeGeometry(0.24, 1.62, 5);
  RaySource.translate(0, 0.81, 0);
  const RayDirections = [
    new THREE.Vector3(-0.62, 0.22, 0.78),
    new THREE.Vector3(-0.32, 0.58, 0.78),
    new THREE.Vector3(0.12, 0.68, 0.76),
    new THREE.Vector3(0.5, 0.42, 0.8),
    new THREE.Vector3(0.64, -0.06, 0.8),
    new THREE.Vector3(0.34, -0.48, 0.84),
    new THREE.Vector3(-0.1, -0.56, 0.86),
    new THREE.Vector3(-0.52, -0.3, 0.82),
  ];
  RayDirections.forEach((RayDirection, RayIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      RaySource,
      RayDirection,
      WorldDefinition.radius - 0.1,
      0.8 + ((RayIndex % 2) * 0.16),
      RayIndex * 0.72,
    ));
  });
  RaySource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Umbra's offset crescent ribs as a readable shadow-world silhouette. */
function createUmbraSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const CrescentSource = new THREE.TorusGeometry(0.82, 0.12, 5, 22, Math.PI * 1.35);
  [0, Math.PI * 0.66, Math.PI * 1.32].forEach((CrescentYaw, CrescentIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      CrescentSource,
      WorldDefinition.radius + 0.1,
      -0.16,
      -0.08,
      0.94 + (CrescentIndex * 0.05),
      -0.34 + (CrescentIndex * 0.22),
      CrescentYaw,
    ));
  });
  CrescentSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Builds Lumen's compact star prism and protective halo in one draw call. */
function createLumenSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const PrismSource = new THREE.OctahedronGeometry(0.58, 0);
  PrismSource.scale(0.72, 1.5, 0.72);
  PrismSource.translate(0, 0.72, 0);
  const HaloSource = new THREE.TorusGeometry(0.72, 0.08, 5, 22);
  const PrismDirections = [
    new THREE.Vector3(-0.42, 0.34, 0.88),
    new THREE.Vector3(0.38, 0.38, 0.88),
    new THREE.Vector3(0, -0.42, 0.92),
  ];
  PrismDirections.forEach((PrismDirection, PrismIndex) => {
    Geometries.push(createPlacedLandmarkGeometry(
      PrismSource,
      PrismDirection,
      WorldDefinition.radius - 0.04,
      0.78 + (PrismIndex * 0.1),
      PrismIndex * 0.8,
    ));
  });
  Geometries.push(createFrontLandmarkGeometry(
    HaloSource, WorldDefinition.radius + 0.16, 0, 0, 0.92, 0.18,
  ));
  PrismSource.dispose();
  HaloSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Braids restored route arches into the finale's starting confluence. */
function createConfluenceSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const ArchSource = new THREE.TorusGeometry(0.88, 0.11, 5, 22, Math.PI * 1.35);
  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((ArchYaw, ArchIndex) => {
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource,
      WorldDefinition.radius + 0.1,
      ArchIndex % 2 === 0 ? -0.18 : 0.18,
      -0.06,
      0.92 + ((ArchIndex % 2) * 0.08),
      ArchIndex % 2 === 0 ? -0.22 : 0.22,
      ArchYaw,
    ));
  });
  ArchSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Encircles a familiar flame crown with the Belt's remembered signal ring. */
function createKindleSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const FlameSource = new THREE.ConeGeometry(0.32, 1.36, 6);
  FlameSource.translate(0, 0.68, 0);
  const HaloSource = new THREE.TorusGeometry(WorldDefinition.radius * 1.06, 0.08, 5, 38);
  const FlameDirections = [
    new THREE.Vector3(-0.5, 0.34, 0.82), new THREE.Vector3(0, 0.66, 0.78),
    new THREE.Vector3(0.5, 0.34, 0.82), new THREE.Vector3(0.38, -0.38, 0.88),
    new THREE.Vector3(-0.38, -0.38, 0.88),
  ];
  FlameDirections.forEach((Direction, Index) => Geometries.push(
    createPlacedLandmarkGeometry(
      FlameSource, Direction, WorldDefinition.radius - 0.05, 0.8 + ((Index % 2) * 0.15), Index * 0.7,
    ),
  ));
  const HaloGeometry = HaloSource.index ? HaloSource.toNonIndexed() : HaloSource.clone();
  HaloGeometry.rotateX(0.82);
  addRestorationGeometryAttributes(HaloGeometry, null, 1);
  Geometries.push(HaloGeometry);
  FlameSource.dispose();
  HaloSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Joins sheltering roots and bell arches into a world made from shared memories. */
function createMemorySurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const ArchSource = new THREE.TorusGeometry(0.7, 0.1, 5, 20, Math.PI);
  const LeafSource = new THREE.IcosahedronGeometry(0.28, 1);
  LeafSource.scale(0.72, 1.45, 0.8);
  LeafSource.translate(0, 0.64, 0);
  [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5].forEach((Yaw, Index) => {
    Geometries.push(createFrontLandmarkGeometry(
      ArchSource, WorldDefinition.radius + 0.08, 0, -0.12, 0.9, Index % 2 ? 0.1 : -0.1, Yaw,
    ));
    Geometries.push(createFrontLandmarkGeometry(
      LeafSource, WorldDefinition.radius + 0.06, 0, 0.18, 0.78, Index * 0.45, Yaw,
    ));
  });
  ArchSource.dispose();
  LeafSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Wraps the finale's strongest gravity well in routes and radial star fins. */
function createStarwellSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const RingSource = new THREE.TorusGeometry(WorldDefinition.radius * 1.055, 0.075, 5, 46);
  [
    { x: 0.2, y: 0.35 }, { x: 1.08, y: -0.28 }, { x: -0.84, y: 0.72 },
  ].forEach((Rotation) => {
    const RingGeometry = RingSource.index ? RingSource.toNonIndexed() : RingSource.clone();
    RingGeometry.rotateX(Rotation.x);
    RingGeometry.rotateY(Rotation.y);
    addRestorationGeometryAttributes(RingGeometry, null, 1);
    Geometries.push(RingGeometry);
  });
  const RaySource = new THREE.ConeGeometry(0.2, 1.45, 5);
  RaySource.translate(0, 0.725, 0);
  [
    new THREE.Vector3(-0.55, 0.42, 0.76), new THREE.Vector3(0, 0.68, 0.74),
    new THREE.Vector3(0.55, 0.42, 0.76), new THREE.Vector3(0.45, -0.38, 0.82),
    new THREE.Vector3(-0.45, -0.38, 0.82),
  ].forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
    RaySource, Direction, WorldDefinition.radius - 0.08, 0.82 + ((Index % 2) * 0.12), Index * 0.8,
  )));
  RingSource.dispose();
  RaySource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Opens flower petals into long dawn rays around the finale's far world. */
function createDawnSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const PetalSource = new THREE.IcosahedronGeometry(0.4, 1);
  PetalSource.scale(0.58, 1.5, 0.76);
  PetalSource.translate(0, 0.58, 0);
  const Directions = [
    new THREE.Vector3(-0.6, 0.28, 0.78), new THREE.Vector3(-0.2, 0.64, 0.76),
    new THREE.Vector3(0.32, 0.56, 0.78), new THREE.Vector3(0.62, 0.08, 0.8),
    new THREE.Vector3(0.34, -0.44, 0.84), new THREE.Vector3(-0.28, -0.48, 0.84),
  ];
  Directions.forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
    PetalSource, Direction, WorldDefinition.radius - 0.06, 0.82 + ((Index % 2) * 0.16), Index * 0.74,
  )));
  PetalSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Suspends three memory prisms inside a single resonant halo. */
function createChorusSurfaceGeometry(WorldDefinition) {
  const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
  const PrismSource = new THREE.OctahedronGeometry(0.48, 0);
  PrismSource.scale(0.68, 1.45, 0.68);
  PrismSource.translate(0, 0.62, 0);
  const HaloSource = new THREE.TorusGeometry(0.76, 0.08, 5, 24);
  [
    new THREE.Vector3(-0.4, 0.32, 0.88),
    new THREE.Vector3(0.38, 0.36, 0.88),
    new THREE.Vector3(0, -0.42, 0.92),
  ].forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
    PrismSource, Direction, WorldDefinition.radius - 0.04, 0.82 + (Index * 0.08), Index * 0.82,
  )));
  Geometries.push(createFrontLandmarkGeometry(
    HaloSource, WorldDefinition.radius + 0.15, 0, 0, 0.95, -0.16,
  ));
  PrismSource.dispose();
  HaloSource.dispose();
  return mergeRestorationGeometries(Geometries);
}

/** Selects one-call authored geometry for lightweight route worlds. */
function createMergedSurfaceGeometry(WorldDefinition) {
  const MergedGeometryFactories = {
    grove: createGroveSurfaceGeometry,
    tide: createTideSurfaceGeometry,
    relay: createRelaySurfaceGeometry,
    kiln: createKilnSurfaceGeometry,
    loom: createLoomSurfaceGeometry,
    shard: createShardSurfaceGeometry,
    drift: createTideSurfaceGeometry,
    vault: createVaultSurfaceGeometry,
    bower: createBowerSurfaceGeometry,
    lantern: createLanternSurfaceGeometry,
    canopy: createCanopySurfaceGeometry,
    crown: createCrownSurfaceGeometry,
    dew: createDewSurfaceGeometry,
    nest: createNestSurfaceGeometry,
    vigil: createVigilSurfaceGeometry,
    pyre: createPyreSurfaceGeometry,
    hollow: createHollowSurfaceGeometry,
    beacon: createBeaconSurfaceGeometry,
    umbra: createUmbraSurfaceGeometry,
    lumen: createLumenSurfaceGeometry,
    confluence: createConfluenceSurfaceGeometry,
    kindle: createKindleSurfaceGeometry,
    memory: createMemorySurfaceGeometry,
    starwell: createStarwellSurfaceGeometry,
    dawn: createDawnSurfaceGeometry,
    chorus: createChorusSurfaceGeometry,
  };
  return (
    MergedGeometryFactories[WorldDefinition.visualKey]
    ?? ((Definition) => addRestorationGeometryAttributes(
      new THREE.IcosahedronGeometry(Definition.radius, 3),
    ))
  )(WorldDefinition);
}

/** Distinguishes low-cost merged landmark worlds from full multi-mesh dioramas. */
function usesMergedSurfaceLandmarks(WorldDefinition) {
  return WorldDefinition.usesMergedSurfaceLandmarks === true
    || WorldDefinition.isPrototypeWorld === true;
}

/** Creates Meadow's authored low-poly cottage landmark. */
function createMeadowCottage(WorldDefinition, SurfaceDirection) {
  const Cottage = new THREE.Group();
  const WallMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2dfad,
    roughness: 0.9,
  });
  const RoofMaterial = new THREE.MeshStandardMaterial({
    color: 0xb65446,
    roughness: 0.86,
  });
  const DoorMaterial = new THREE.MeshStandardMaterial({
    color: 0x503a31,
    roughness: 0.94,
  });
  const WindowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe9a3,
    emissive: 0xffbd62,
    emissiveIntensity: 0.75,
    roughness: 0.4,
  });

  const Walls = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.62), WallMaterial);
  Walls.position.y = 0.34;
  Cottage.add(Walls);

  const Roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.48, 4), RoofMaterial);
  Roof.position.y = 0.84;
  Roof.rotation.y = Math.PI * 0.25;
  Cottage.add(Roof);

  const Door = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.04), DoorMaterial);
  Door.position.set(0, 0.23, 0.33);
  Cottage.add(Door);

  const WindowGeometry = new THREE.BoxGeometry(0.16, 0.15, 0.035);
  for (const WindowX of [-0.23, 0.23]) {
    const WindowMesh = new THREE.Mesh(WindowGeometry, WindowMaterial);
    WindowMesh.position.set(WindowX, 0.42, 0.335);
    Cottage.add(WindowMesh);
  }

  placeSurfaceProp(Cottage, SurfaceDirection, WorldDefinition.radius, 1.12, 0.02);
  registerRestorableMaterial(Cottage, WallMaterial);
  registerRestorableMaterial(Cottage, RoofMaterial);
  registerRestorableMaterial(Cottage, DoorMaterial);
  registerRestorableMaterial(Cottage, WindowMaterial);
  Cottage.userData.kind = 'cottage';
  Cottage.userData.windowMaterial = WindowMaterial;
  return Cottage;
}

/** Creates one rounded toy-like Meadow tree. */
function createMeadowTree(WorldDefinition, SurfaceDirection, Scale, Phase) {
  const Tree = new THREE.Group();
  const TrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765139, roughness: 0.96 });
  const LeafMaterial = new THREE.MeshStandardMaterial({ color: 0x76b85d, roughness: 0.88 });
  const Trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.58, 6), TrunkMaterial);
  Trunk.position.y = 0.29;
  Tree.add(Trunk);

  const CanopyGeometry = new THREE.IcosahedronGeometry(0.32, 1);
  const CanopyPositions = [
    new THREE.Vector3(0, 0.69, 0),
    new THREE.Vector3(-0.18, 0.61, 0.04),
    new THREE.Vector3(0.17, 0.62, -0.03),
  ];
  for (const CanopyPosition of CanopyPositions) {
    const Canopy = new THREE.Mesh(CanopyGeometry, LeafMaterial);
    Canopy.position.copy(CanopyPosition);
    Tree.add(Canopy);
  }

  placeSurfaceProp(Tree, SurfaceDirection, WorldDefinition.radius, Scale, 0.02);
  registerRestorableMaterial(Tree, TrunkMaterial);
  registerRestorableMaterial(Tree, LeafMaterial);
  Tree.userData.kind = 'tree';
  Tree.userData.swayPhase = Phase;
  Tree.userData.swayAmount = 0.035;
  return Tree;
}

/** Creates a small readable cluster of flowers. */
function createMeadowFlowers(WorldDefinition, SurfaceDirection, FlowerColor, Phase) {
  const FlowerCluster = new THREE.Group();
  const StemMaterial = new THREE.MeshStandardMaterial({ color: 0x528f4c, roughness: 0.95 });
  const PetalMaterial = new THREE.MeshStandardMaterial({ color: FlowerColor, roughness: 0.8 });
  const CentreMaterial = new THREE.MeshStandardMaterial({
    color: 0xffda68,
    emissive: 0x7a4b12,
    emissiveIntensity: 0.28,
    roughness: 0.82,
  });

  for (let FlowerIndex = 0; FlowerIndex < 3; FlowerIndex += 1) {
    const FlowerX = (FlowerIndex - 1) * 0.15;
    const FlowerHeight = 0.25 + ((FlowerIndex % 2) * 0.08);
    const Stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, FlowerHeight, 5),
      StemMaterial,
    );
    Stem.position.set(FlowerX, FlowerHeight * 0.5, (FlowerIndex % 2) * 0.05);
    FlowerCluster.add(Stem);

    const FlowerHead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), PetalMaterial);
    FlowerHead.position.set(FlowerX, FlowerHeight, (FlowerIndex % 2) * 0.05);
    FlowerCluster.add(FlowerHead);

    const FlowerCentre = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), CentreMaterial);
    FlowerCentre.position.set(FlowerX, FlowerHeight + 0.012, 0.075 + ((FlowerIndex % 2) * 0.05));
    FlowerCluster.add(FlowerCentre);
  }

  placeSurfaceProp(FlowerCluster, SurfaceDirection, WorldDefinition.radius, 1, 0.025);
  registerRestorableMaterial(FlowerCluster, StemMaterial);
  registerRestorableMaterial(FlowerCluster, PetalMaterial);
  registerRestorableMaterial(FlowerCluster, CentreMaterial);
  FlowerCluster.userData.kind = 'flowers';
  FlowerCluster.userData.swayPhase = Phase;
  FlowerCluster.userData.swayAmount = 0.055;
  return FlowerCluster;
}

/** Creates a curved-surface grass tuft from three exaggerated blades. */
function createMeadowGrass(WorldDefinition, SurfaceDirection, Scale, Phase) {
  const Grass = new THREE.Group();
  const GrassMaterial = new THREE.MeshStandardMaterial({ color: 0x9acc68, roughness: 0.96 });
  const BladeGeometry = new THREE.ConeGeometry(0.045, 0.34, 4);

  for (let BladeIndex = 0; BladeIndex < 3; BladeIndex += 1) {
    const Blade = new THREE.Mesh(BladeGeometry, GrassMaterial);
    Blade.position.set((BladeIndex - 1) * 0.08, 0.17, 0);
    Blade.rotation.z = (BladeIndex - 1) * -0.15;
    Grass.add(Blade);
  }

  placeSurfaceProp(Grass, SurfaceDirection, WorldDefinition.radius, Scale, 0.02);
  registerRestorableMaterial(Grass, GrassMaterial);
  Grass.userData.kind = 'grass';
  Grass.userData.swayPhase = Phase;
  Grass.userData.swayAmount = 0.065;
  return Grass;
}

/** Creates Meadow's pond as a glossy tangent disc with a bright rim. */
function createMeadowPond(WorldDefinition, SurfaceDirection) {
  const Pond = new THREE.Group();
  const WaterMaterial = new THREE.MeshStandardMaterial({
    color: 0x58b7b1,
    emissive: 0x123e48,
    emissiveIntensity: 0.45,
    roughness: 0.24,
    metalness: 0.05,
  });
  const RimMaterial = new THREE.MeshStandardMaterial({ color: 0xbee58d, roughness: 0.9 });
  const Water = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), WaterMaterial);
  Water.rotation.x = -Math.PI * 0.5;
  Water.scale.z = 0.62;
  Water.position.y = 0.025;
  Pond.add(Water);

  const Rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 6, 32), RimMaterial);
  Rim.rotation.x = Math.PI * 0.5;
  Rim.scale.z = 0.62;
  Rim.position.y = 0.018;
  Pond.add(Rim);

  placeSurfaceProp(Pond, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
  registerRestorableMaterial(Pond, WaterMaterial);
  registerRestorableMaterial(Pond, RimMaterial);
  Pond.userData.kind = 'pond';
  Pond.userData.waterMaterial = WaterMaterial;
  return Pond;
}

/** Builds Meadow's final procedural prop composition. */
function createMeadowSurfaceProps(WorldDefinition) {
  const SurfacePropGroup = new THREE.Group();
  const TreeDefinitions = [
    [-0.64, 0.22, 0.74, 1.1],
    [0.43, 0.58, 0.69, 0.92],
    [-0.42, -0.48, 0.77, 0.82],
    [0.7, -0.14, 0.7, 0.72],
  ];
  TreeDefinitions.forEach(([X, Y, Z, Scale], Index) => {
    SurfacePropGroup.add(createMeadowTree(
      WorldDefinition,
      new THREE.Vector3(X, Y, Z),
      Scale,
      Index * 1.7,
    ));
  });

  SurfacePropGroup.add(createMeadowCottage(
    WorldDefinition,
    new THREE.Vector3(-0.16, 0.7, 0.72),
  ));
  SurfacePropGroup.add(createMeadowPond(
    WorldDefinition,
    new THREE.Vector3(0.2, -0.34, 0.93),
  ));

  const FlowerDefinitions = [
    [-0.08, 0.1, 0.99, 0xf0a7c6],
    [0.48, 0.18, 0.87, 0xd8b0ff],
    [-0.52, -0.1, 0.85, 0xffd68a],
    [0.1, 0.55, 0.84, 0xf59cab],
  ];
  FlowerDefinitions.forEach(([X, Y, Z, Color], Index) => {
    SurfacePropGroup.add(createMeadowFlowers(
      WorldDefinition,
      new THREE.Vector3(X, Y, Z),
      Color,
      0.7 + (Index * 1.2),
    ));
  });

  const GrassDirections = [
    [-0.8, 0.52, 0.3], [0.12, 0.84, 0.52], [0.73, 0.42, 0.54],
    [-0.76, -0.48, 0.45], [-0.18, -0.76, 0.63], [0.63, -0.58, 0.52],
    [-0.35, 0.34, 0.88], [0.42, -0.02, 0.91],
  ];
  GrassDirections.forEach(([X, Y, Z], Index) => {
    SurfacePropGroup.add(createMeadowGrass(
      WorldDefinition,
      new THREE.Vector3(X, Y, Z),
      0.78 + ((Index % 3) * 0.1),
      Index * 0.8,
    ));
  });

  const RockGeometry = new THREE.DodecahedronGeometry(0.16, 0);
  const RockDirections = [
    [-0.72, 0.68, 0.18], [0.55, 0.72, 0.42], [-0.66, -0.68, 0.3], [0.54, -0.7, 0.46],
  ];
  RockDirections.forEach(([X, Y, Z], Index) => {
    const RockMaterial = new THREE.MeshStandardMaterial({ color: 0xa5ad92, roughness: 1 });
    const Rock = new THREE.Mesh(RockGeometry, RockMaterial);
    Rock.scale.set(1.25, 0.8, 1);
    placeSurfaceProp(
      Rock,
      new THREE.Vector3(X, Y, Z),
      WorldDefinition.radius,
      0.82 + ((Index % 2) * 0.18),
      0.04,
    );
    registerRestorableMaterial(Rock, RockMaterial);
    Rock.userData.kind = 'rock';
    SurfacePropGroup.add(Rock);
  });

  return SurfacePropGroup;
}

/** Creates a cluster of rising basalt columns with a restrained inner heat glow. */
function createEmberBasaltCluster(WorldDefinition, SurfaceDirection, Scale, Phase) {
  const BasaltCluster = new THREE.Group();
  const BasaltMaterial = new THREE.MeshStandardMaterial({
    color: 0x41353a,
    roughness: 0.82,
    metalness: 0.08,
  });
  const HeatMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8a42,
    emissive: 0xff461f,
    emissiveIntensity: 1.35,
    roughness: 0.45,
  });
  const ColumnHeights = [0.56, 0.82, 0.43, 0.67, 0.36];
  const ColumnPositions = [
    [-0.18, 0], [0, 0.03], [0.18, 0.02], [-0.08, 0.18], [0.13, 0.17],
  ];

  ColumnHeights.forEach((ColumnHeight, Index) => {
    const Column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.13, ColumnHeight, 6),
      BasaltMaterial,
    );
    Column.position.set(
      ColumnPositions[Index][0],
      ColumnHeight * 0.5,
      ColumnPositions[Index][1],
    );
    Column.rotation.y = (Index % 2) * 0.22;
    BasaltCluster.add(Column);

    if (Index < 2) {
      const HeatCap = new THREE.Mesh(new THREE.CircleGeometry(0.075, 6), HeatMaterial);
      HeatCap.rotation.x = -Math.PI * 0.5;
      HeatCap.position.set(
        ColumnPositions[Index][0],
        ColumnHeight + 0.003,
        ColumnPositions[Index][1],
      );
      BasaltCluster.add(HeatCap);
    }
  });

  placeSurfaceProp(BasaltCluster, SurfaceDirection, WorldDefinition.radius, Scale, 0.025);
  registerRestorableMaterial(BasaltCluster, BasaltMaterial);
  registerRestorableMaterial(BasaltCluster, HeatMaterial);
  BasaltCluster.userData.kind = 'basalt';
  BasaltCluster.userData.heatMaterial = HeatMaterial;
  BasaltCluster.userData.motionPhase = Phase;
  return BasaltCluster;
}

/** Creates Ember's volcanic landmark with a glowing caldera. */
function createEmberCaldera(WorldDefinition, SurfaceDirection) {
  const Caldera = new THREE.Group();
  const CrustMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3432,
    roughness: 0.96,
  });
  const LavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa33e,
    emissive: 0xff3c12,
    emissiveIntensity: 2.2,
    roughness: 0.28,
  });
  const Volcano = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.85, 7, 1, true), CrustMaterial);
  Volcano.position.y = 0.42;
  Caldera.add(Volcano);

  const LavaMouth = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), LavaMaterial);
  LavaMouth.rotation.x = -Math.PI * 0.5;
  LavaMouth.position.y = 0.84;
  Caldera.add(LavaMouth);

  const CraterRim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.085, 6, 22), CrustMaterial);
  CraterRim.rotation.x = Math.PI * 0.5;
  CraterRim.position.y = 0.845;
  Caldera.add(CraterRim);

  placeSurfaceProp(Caldera, SurfaceDirection, WorldDefinition.radius, 1.08, 0.015);
  registerRestorableMaterial(Caldera, CrustMaterial);
  registerRestorableMaterial(Caldera, LavaMaterial);
  Caldera.userData.kind = 'volcano';
  Caldera.userData.lavaMaterial = LavaMaterial;
  return Caldera;
}

/** Creates a small molten pool set into Ember's curved crust. */
function createEmberLavaPool(WorldDefinition, SurfaceDirection) {
  const LavaPool = new THREE.Group();
  const LavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9a38,
    emissive: 0xff3514,
    emissiveIntensity: 1.8,
    roughness: 0.25,
  });
  const RimMaterial = new THREE.MeshStandardMaterial({ color: 0x4e3735, roughness: 0.98 });
  const Lava = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), LavaMaterial);
  Lava.rotation.x = -Math.PI * 0.5;
  Lava.scale.z = 0.55;
  Lava.position.y = 0.026;
  LavaPool.add(Lava);
  const Rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 28), RimMaterial);
  Rim.rotation.x = Math.PI * 0.5;
  Rim.scale.z = 0.55;
  Rim.position.y = 0.02;
  LavaPool.add(Rim);

  placeSurfaceProp(LavaPool, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
  registerRestorableMaterial(LavaPool, LavaMaterial);
  registerRestorableMaterial(LavaPool, RimMaterial);
  LavaPool.userData.kind = 'lavaPool';
  LavaPool.userData.lavaMaterial = LavaMaterial;
  return LavaPool;
}

/** Builds Ember's authored volcanic prop composition. */
function createEmberSurfaceProps(WorldDefinition) {
  const SurfacePropGroup = new THREE.Group();
  SurfacePropGroup.add(createEmberCaldera(
    WorldDefinition,
    new THREE.Vector3(0.24, 0.58, 0.79),
  ));
  SurfacePropGroup.add(createEmberLavaPool(
    WorldDefinition,
    new THREE.Vector3(-0.08, -0.42, 0.91),
  ));

  const ClusterDefinitions = [
    [-0.64, 0.34, 0.7, 1.0], [0.62, 0.12, 0.78, 0.86],
    [-0.54, -0.48, 0.69, 0.72], [0.58, -0.55, 0.6, 0.68],
  ];
  ClusterDefinitions.forEach(([X, Y, Z, Scale], Index) => {
    SurfacePropGroup.add(createEmberBasaltCluster(
      WorldDefinition,
      new THREE.Vector3(X, Y, Z),
      Scale,
      Index * 1.4,
    ));
  });

  const ShardGeometry = new THREE.TetrahedronGeometry(0.19, 0);
  const ShardDirections = [
    [-0.78, 0.58, 0.26], [0.72, 0.58, 0.38], [-0.72, -0.65, 0.25],
    [0.72, -0.62, 0.31], [0.05, 0.02, 1],
  ];
  ShardDirections.forEach(([X, Y, Z], Index) => {
    const ShardMaterial = new THREE.MeshStandardMaterial({
      color: Index % 2 === 0 ? 0x513a3a : 0x372f35,
      roughness: 0.88,
      metalness: 0.06,
    });
    const Shard = new THREE.Mesh(ShardGeometry, ShardMaterial);
    Shard.rotation.y = Index * 0.7;
    placeSurfaceProp(
      Shard,
      new THREE.Vector3(X, Y, Z),
      WorldDefinition.radius,
      0.8 + ((Index % 3) * 0.18),
      0.055,
    );
    registerRestorableMaterial(Shard, ShardMaterial);
    Shard.userData.kind = 'rock';
    SurfacePropGroup.add(Shard);
  });

  return SurfacePropGroup;
}

/** Creates one translucent-looking cluster of faceted Frost crystals. */
function createFrostCrystalCluster(WorldDefinition, SurfaceDirection, Scale, Phase) {
  const CrystalCluster = new THREE.Group();
  const CrystalMaterial = new THREE.MeshStandardMaterial({
    color: 0xbdebf2,
    emissive: 0x4b9db4,
    emissiveIntensity: 0.72,
    roughness: 0.2,
    metalness: 0.08,
  });
  const CrystalGeometry = new THREE.OctahedronGeometry(0.28, 0);
  const CrystalDefinitions = [
    [-0.2, 0.5, 0, 1.45], [0.02, 0.7, 0.02, 1.9], [0.23, 0.42, -0.02, 1.15],
  ];
  CrystalDefinitions.forEach(([X, Y, Z, HeightScale], Index) => {
    const Crystal = new THREE.Mesh(CrystalGeometry, CrystalMaterial);
    Crystal.position.set(X, Y * 0.52, Z);
    Crystal.scale.set(0.72, HeightScale, 0.72);
    Crystal.rotation.y = Index * 0.42;
    CrystalCluster.add(Crystal);
  });

  placeSurfaceProp(CrystalCluster, SurfaceDirection, WorldDefinition.radius, Scale, 0.025);
  registerRestorableMaterial(CrystalCluster, CrystalMaterial);
  CrystalCluster.userData.kind = 'crystal';
  CrystalCluster.userData.crystalMaterial = CrystalMaterial;
  CrystalCluster.userData.motionPhase = Phase;
  return CrystalCluster;
}

/** Creates Frost's large ice arch landmark. */
function createFrostIceArch(WorldDefinition, SurfaceDirection) {
  const IceArch = new THREE.Group();
  const IceMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9f6f8,
    emissive: 0x5cabc1,
    emissiveIntensity: 0.62,
    roughness: 0.22,
    metalness: 0.06,
  });
  for (const PillarX of [-0.4, 0.4]) {
    const Pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.66, 6), IceMaterial);
    Pillar.position.set(PillarX, 0.33, 0);
    IceArch.add(Pillar);
  }
  const Arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 6, 24, Math.PI), IceMaterial);
  Arch.position.y = 0.64;
  IceArch.add(Arch);

  placeSurfaceProp(IceArch, SurfaceDirection, WorldDefinition.radius, 1.15, 0.02);
  registerRestorableMaterial(IceArch, IceMaterial);
  IceArch.userData.kind = 'iceArch';
  IceArch.userData.crystalMaterial = IceMaterial;
  return IceArch;
}

/** Creates a luminous frozen lake on Frost. */
function createFrostLake(WorldDefinition, SurfaceDirection) {
  const FrozenLake = new THREE.Group();
  const IceMaterial = new THREE.MeshStandardMaterial({
    color: 0x99dce8,
    emissive: 0x326f91,
    emissiveIntensity: 0.48,
    roughness: 0.16,
    metalness: 0.12,
  });
  const SnowMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f5f2, roughness: 0.88 });
  const Ice = new THREE.Mesh(new THREE.CircleGeometry(0.58, 28), IceMaterial);
  Ice.rotation.x = -Math.PI * 0.5;
  Ice.scale.z = 0.62;
  Ice.position.y = 0.025;
  FrozenLake.add(Ice);
  const SnowRim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 6, 30), SnowMaterial);
  SnowRim.rotation.x = Math.PI * 0.5;
  SnowRim.scale.z = 0.62;
  SnowRim.position.y = 0.02;
  FrozenLake.add(SnowRim);

  placeSurfaceProp(FrozenLake, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
  registerRestorableMaterial(FrozenLake, IceMaterial);
  registerRestorableMaterial(FrozenLake, SnowMaterial);
  FrozenLake.userData.kind = 'frozenLake';
  FrozenLake.userData.crystalMaterial = IceMaterial;
  return FrozenLake;
}

/** Builds Frost's authored crystalline prop composition. */
function createFrostSurfaceProps(WorldDefinition) {
  const SurfacePropGroup = new THREE.Group();
  SurfacePropGroup.add(createFrostIceArch(
    WorldDefinition,
    new THREE.Vector3(-0.18, 0.68, 0.73),
  ));
  SurfacePropGroup.add(createFrostLake(
    WorldDefinition,
    new THREE.Vector3(0.22, -0.36, 0.91),
  ));

  const CrystalDefinitions = [
    [-0.64, 0.25, 0.73, 1.0], [0.55, 0.43, 0.71, 0.9],
    [-0.5, -0.53, 0.69, 0.78], [0.64, -0.45, 0.63, 0.72],
    [0.2, 0.15, 0.97, 0.64],
  ];
  CrystalDefinitions.forEach(([X, Y, Z, Scale], Index) => {
    SurfacePropGroup.add(createFrostCrystalCluster(
      WorldDefinition,
      new THREE.Vector3(X, Y, Z),
      Scale,
      Index * 1.15,
    ));
  });

  const SnowGeometry = new THREE.IcosahedronGeometry(0.24, 1);
  const SnowDirections = [
    [-0.75, 0.6, 0.27], [0.7, 0.63, 0.34], [-0.72, -0.65, 0.27],
    [0.72, -0.62, 0.31], [-0.12, 0.04, 0.99],
  ];
  SnowDirections.forEach(([X, Y, Z], Index) => {
    const SnowMaterial = new THREE.MeshStandardMaterial({ color: 0xe5f1ee, roughness: 0.94 });
    const SnowMound = new THREE.Mesh(SnowGeometry, SnowMaterial);
    SnowMound.scale.set(1.2, 0.55, 1);
    placeSurfaceProp(
      SnowMound,
      new THREE.Vector3(X, Y, Z),
      WorldDefinition.radius,
      0.78 + ((Index % 2) * 0.18),
      0.035,
    );
    registerRestorableMaterial(SnowMound, SnowMaterial);
    SnowMound.userData.kind = 'snow';
    SurfacePropGroup.add(SnowMound);
  });

  return SurfacePropGroup;
}

/** Creates a tiny deterministic halo of warm Meadow motes. */
function createMeadowMotes(WorldDefinition) {
  const MoteCount = 24;
  const MotePositions = new Float32Array(MoteCount * 3);

  for (let MoteIndex = 0; MoteIndex < MoteCount; MoteIndex += 1) {
    const GoldenAngle = Math.PI * (3 - Math.sqrt(5));
    const Longitude = MoteIndex * GoldenAngle;
    const VerticalPosition = 1 - ((MoteIndex + 0.5) / MoteCount) * 2;
    const HorizontalRadius = Math.sqrt(1 - (VerticalPosition * VerticalPosition));
    const MoteRadius = WorldDefinition.radius + 0.62 + ((MoteIndex % 4) * 0.08);
    const PositionOffset = MoteIndex * 3;
    MotePositions[PositionOffset] = Math.cos(Longitude) * HorizontalRadius * MoteRadius;
    MotePositions[PositionOffset + 1] = VerticalPosition * MoteRadius;
    MotePositions[PositionOffset + 2] = Math.sin(Longitude) * HorizontalRadius * MoteRadius;
  }

  const MoteGeometry = new THREE.BufferGeometry();
  MoteGeometry.setAttribute('position', new THREE.BufferAttribute(MotePositions, 3));
  const MoteMaterial = new THREE.PointsMaterial({
    color: 0xffef9d,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(MoteGeometry, MoteMaterial);
}

/** Creates a fixed-size deterministic particle halo for a restored biome. */
function createBiomeMotes(WorldDefinition, MoteCount, Color, Size, BaseOpacity) {
  const MotePositions = new Float32Array(MoteCount * 3);

  for (let MoteIndex = 0; MoteIndex < MoteCount; MoteIndex += 1) {
    const GoldenAngle = Math.PI * (3 - Math.sqrt(5));
    const Longitude = MoteIndex * GoldenAngle;
    const VerticalPosition = 1 - ((MoteIndex + 0.5) / MoteCount) * 2;
    const HorizontalRadius = Math.sqrt(1 - (VerticalPosition * VerticalPosition));
    const RadiusVariation = ((MoteIndex * 7) % 5) * 0.09;
    const MoteRadius = WorldDefinition.radius + 0.48 + RadiusVariation;
    const PositionOffset = MoteIndex * 3;
    MotePositions[PositionOffset] = Math.cos(Longitude) * HorizontalRadius * MoteRadius;
    MotePositions[PositionOffset + 1] = VerticalPosition * MoteRadius;
    MotePositions[PositionOffset + 2] = Math.sin(Longitude) * HorizontalRadius * MoteRadius;
  }

  const MoteGeometry = new THREE.BufferGeometry();
  MoteGeometry.setAttribute('position', new THREE.BufferAttribute(MotePositions, 3));
  const MoteMaterial = new THREE.PointsMaterial({
    color: Color,
    size: Size,
    sizeAttenuation: true,
    transparent: true,
    opacity: WorldDefinition.restored ? BaseOpacity : 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const MoteGroup = new THREE.Points(MoteGeometry, MoteMaterial);
  MoteGroup.userData.baseOpacity = BaseOpacity;
  return MoteGroup;
}

/**
 * Creates one world and records its render-time components by identifier.
 *
 * @param {object} WorldDefinition - Gameplay and visual definition for the world.
 */
function createWorld(WorldDefinition) {
  const WorldGroup = new THREE.Group();
  WorldGroup.position.set(
    WorldDefinition.position.x,
    WorldDefinition.position.y,
    WorldDefinition.position.z,
  );

  const UsesMergedSurfaceLandmarks = usesMergedSurfaceLandmarks(WorldDefinition);
  const SurfaceGeometry = UsesMergedSurfaceLandmarks
    ? createMergedSurfaceGeometry(WorldDefinition)
    : addRestorationGeometryAttributes(new THREE.IcosahedronGeometry(
      WorldDefinition.radius,
      5,
    ));
  const SurfaceRestoration = createRestorationSurfaceMaterial(WorldDefinition);
  const SurfaceMaterial = SurfaceRestoration.material;
  const SurfaceMesh = new THREE.Mesh(SurfaceGeometry, SurfaceMaterial);
  SurfaceMesh.castShadow = !UsesMergedSurfaceLandmarks;
  SurfaceMesh.receiveShadow = true;
  WorldGroup.add(SurfaceMesh);

  const RestorationWaveShell = createRestorationWaveShell(
    WorldDefinition,
    SurfaceRestoration.uniforms,
  );
  WorldGroup.add(RestorationWaveShell.mesh);

  let AtmosphereMaterial;
  let AtmosphereMesh;
  let ContourRingGroup;
  if (UsesMergedSurfaceLandmarks) {
    /** Merged landmarks preserve a strong silhouette without extra atmosphere draw calls. */
    AtmosphereMaterial = { opacity: 0 };
    AtmosphereMesh = new THREE.Object3D();
    ContourRingGroup = new THREE.Group();
  } else {
    const AtmosphereGeometry = new THREE.SphereGeometry(WorldDefinition.radius * 1.09, 48, 32);
    AtmosphereMaterial = new THREE.MeshBasicMaterial({
      color: WorldDefinition.atmosphereColor,
      transparent: true,
      opacity: WorldDefinition.restored ? 0.10 : 0.025,
      side: THREE.BackSide,
      depthWrite: false,
    });
    AtmosphereMesh = new THREE.Mesh(AtmosphereGeometry, AtmosphereMaterial);
    WorldGroup.add(AtmosphereMesh);

    ContourRingGroup = createWorldContourRings(
      WorldDefinition.radius,
      WorldDefinition.atmosphereColor,
    );
    ContourRingGroup.visible = WorldDefinition.restored;
    WorldGroup.add(ContourRingGroup);
  }

  const SurfacePropFactories = {
    meadow: createMeadowSurfaceProps,
    ember: createEmberSurfaceProps,
    frost: createFrostSurfaceProps,
  };
  const SurfaceMarkerGroup = UsesMergedSurfaceLandmarks
    ? new THREE.Group()
    : (
      SurfacePropFactories[WorldDefinition.visualKey] ?? createPlaceholderSurfaceProps
    )(WorldDefinition);

  for (const SurfacePropObject of SurfaceMarkerGroup.children) {
    const CastsUsefulShadow = [
      'cottage', 'tree', 'rock', 'basalt', 'volcano', 'crystal', 'iceArch',
    ].includes(
      SurfacePropObject.userData.kind,
    );
    SurfacePropObject.traverse((SurfaceObject) => {
      if (SurfaceObject.isMesh) {
        SurfaceObject.castShadow = CastsUsefulShadow;
        SurfaceObject.receiveShadow = true;
      }
    });
  }

  WorldGroup.add(SurfaceMarkerGroup);
  const AmbientMoteGroup = UsesMergedSurfaceLandmarks
    ? null
    : (
      WorldDefinition.visualKey === 'meadow'
        ? createMeadowMotes(WorldDefinition)
        : createBiomeMotes(
          WorldDefinition,
          WorldDefinition.visualKey === 'ember' ? 30 : 34,
          WorldDefinition.visualKey === 'ember' ? 0xff7b32 : 0xcdf8ff,
          WorldDefinition.visualKey === 'ember' ? 0.105 : 0.085,
          WorldDefinition.visualKey === 'ember' ? 0.78 : 0.64,
        )
    );
  if (AmbientMoteGroup) {
    AmbientMoteGroup.userData.baseOpacity ??= 0.72;
  }
  if (AmbientMoteGroup) {
    WorldGroup.add(AmbientMoteGroup);
  }
  const StillnessCage = createStillnessCage(WorldDefinition);
  WorldGroup.add(StillnessCage.group);
  Scene.add(WorldGroup);

  const WorldRuntime = {
    definition: WorldDefinition,
    group: WorldGroup,
    surfaceMesh: SurfaceMesh,
    surfaceMaterial: SurfaceMaterial,
    restorationUniforms: SurfaceRestoration.uniforms,
    restorationWaveMesh: RestorationWaveShell.mesh,
    atmosphereMaterial: AtmosphereMaterial,
    atmosphereMesh: AtmosphereMesh,
    contourRingGroup: ContourRingGroup,
    surfaceMarkerGroup: SurfaceMarkerGroup,
    ambientMoteGroup: AmbientMoteGroup,
    stillnessCageGroup: StillnessCage.group,
    stillnessCageMaterial: StillnessCage.material,
    restorationOriginLocal: new THREE.Vector3(1, 0, 0),
    restorationStartedAtSeconds: WorldDefinition.restored ? -Infinity : null,
    restorationCompleted: WorldDefinition.restored,
  };
  WorldRuntimeByIdentifier.set(WorldDefinition.id, WorldRuntime);
  if (!WorldRuntimesByVisualKey.has(WorldDefinition.visualKey)) {
    WorldRuntimesByVisualKey.set(WorldDefinition.visualKey, []);
  }
  WorldRuntimesByVisualKey.get(WorldDefinition.visualKey).push(WorldRuntime);
}

for (const WorldDefinition of WorldDefinitions) {
  createWorld(WorldDefinition);
}

/** Two pooled meshes pin culture-specific occupation clamps across every silenced world. */
const OccupationScarProfiles = {
  meadow: { height: 0.9, width: 0.82, depth: 0.82 },
  ember: { height: 1.25, width: 0.62, depth: 0.78 },
  grove: { height: 0.58, width: 1.18, depth: 0.72 },
  tide: { height: 0.66, width: 1.3, depth: 0.68 },
  frost: { height: 1.08, width: 0.72, depth: 0.88 },
  vault: { height: 1.35, width: 0.78, depth: 0.92 },
};
const OccupationScarInstances = WorldDefinitions.flatMap((WorldDefinition) => (
  (WorldDefinition.occupationScarAngles ?? []).map((Angle, PatternIndex) => ({
    worldDefinition: WorldDefinition,
    angle: Angle,
    patternIndex: PatternIndex,
    profile: OccupationScarProfiles[WorldDefinition.visualKey]
      ?? { height: 0.85, width: 0.8, depth: 0.8 },
  }))
));
const OccupationScarCapacity = Math.max(1, OccupationScarInstances.length);
const OccupationScarMaterial = new THREE.MeshStandardMaterial({
  color: 0x321019,
  emissive: 0xff342f,
  emissiveIntensity: 0.82,
  roughness: 0.4,
  metalness: 0.82,
});
const OccupationSpikeMesh = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.14, 0.82, 4),
  OccupationScarMaterial,
  OccupationScarCapacity,
);
const OccupationClampMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.68, 0.1, 0.16),
  OccupationScarMaterial,
  OccupationScarCapacity,
);
OccupationSpikeMesh.count = OccupationScarInstances.length;
OccupationClampMesh.count = OccupationScarInstances.length;
OccupationSpikeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
OccupationClampMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
OccupationSpikeMesh.frustumCulled = false;
OccupationClampMesh.frustumCulled = false;
Scene.add(OccupationSpikeMesh, OccupationClampMesh);
const OccupationScarTransform = new THREE.Object3D();
let VisibleOccupationScarCount = -1;
GameCanvas.dataset.occupationScarCount = String(OccupationScarInstances.length);

function updateOccupationScarVisuals(ElapsedTimeSeconds) {
  let NextVisibleOccupationScarCount = 0;
  for (let ScarIndex = 0; ScarIndex < OccupationScarInstances.length; ScarIndex += 1) {
    const Scar = OccupationScarInstances[ScarIndex];
    const WorldRuntime = WorldRuntimeByIdentifier.get(Scar.worldDefinition.id);
    const RestorationProgress = WorldRuntime.restorationUniforms.restorationProgress.value;
    const ScarStrength = Scar.worldDefinition.restored
      ? 1 - THREE.MathUtils.smoothstep(RestorationProgress, 0, 0.68)
      : 1;
    if (ScarStrength > 0.01) NextVisibleOccupationScarCount += 1;
    const RadialX = Math.cos(Scar.angle);
    const RadialY = Math.sin(Scar.angle);
    const Height = Scar.profile.height * (1 + ((Scar.patternIndex % 2) * 0.12));
    OccupationScarTransform.position.set(
      Scar.worldDefinition.position.x
        + (RadialX * (Scar.worldDefinition.radius + (Height * 0.34))),
      Scar.worldDefinition.position.y
        + (RadialY * (Scar.worldDefinition.radius + (Height * 0.34))),
      0.34 + ((Scar.patternIndex % 2) * 0.05),
    );
    OccupationScarTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
    OccupationScarTransform.scale.set(
      Scar.profile.depth * ScarStrength,
      Height * ScarStrength,
      Scar.profile.depth * ScarStrength,
    );
    OccupationScarTransform.updateMatrix();
    OccupationSpikeMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);

    OccupationScarTransform.position.set(
      Scar.worldDefinition.position.x
        + (RadialX * (Scar.worldDefinition.radius + (Height * 0.62))),
      Scar.worldDefinition.position.y
        + (RadialY * (Scar.worldDefinition.radius + (Height * 0.62))),
      0.36 + ((Scar.patternIndex % 2) * 0.05),
    );
    OccupationScarTransform.rotation.set(0, 0, Scar.angle);
    OccupationScarTransform.scale.set(
      Scar.profile.width * ScarStrength,
      Scar.profile.depth * ScarStrength,
      Scar.profile.depth * ScarStrength,
    );
    OccupationScarTransform.updateMatrix();
    OccupationClampMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);
  }
  if (OccupationScarInstances.length > 0) {
    OccupationSpikeMesh.instanceMatrix.needsUpdate = true;
    OccupationClampMesh.instanceMatrix.needsUpdate = true;
  }
  OccupationScarMaterial.emissiveIntensity = 0.72
    + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.16);
  if (VisibleOccupationScarCount !== NextVisibleOccupationScarCount) {
    VisibleOccupationScarCount = NextVisibleOccupationScarCount;
    GameCanvas.dataset.visibleOccupationScarCount = String(VisibleOccupationScarCount);
  }
}

/** Tiny restored-world inhabitants share one draw call and culture-specific walking rhythms. */
const InhabitantProfiles = {
  meadow: { speed: 0.42, stride: 0.11 },
  ember: { speed: 0.72, stride: 0.075 },
  grove: { speed: 0.34, stride: 0.14 },
  tide: { speed: 0.88, stride: 0.095 },
  frost: { speed: 0.3, stride: 0.065 },
  vault: { speed: 0.24, stride: 0.055 },
};
const InhabitantInstances = WorldDefinitions.flatMap((WorldDefinition, WorldIndex) => (
  WorldDefinition.occupationScarAngles
    ? Array.from({ length: 3 }, (_, InhabitantIndex) => ({
      worldDefinition: WorldDefinition,
      baseAngle: (1.1 + (WorldIndex * 1.37) + (InhabitantIndex * 0.3)) % (Math.PI * 2),
      phase: (WorldIndex * 0.73) + (InhabitantIndex * 1.91),
      profile: InhabitantProfiles[WorldDefinition.visualKey]
        ?? { speed: 0.4, stride: 0.08 },
    }))
    : []
));
const InhabitantCapacity = Math.max(1, InhabitantInstances.length);
const InhabitantMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  toneMapped: false,
});
const InhabitantGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0.025, -0.22),
  new THREE.Vector2(0.085, -0.17),
  new THREE.Vector2(0.09, 0.1),
  new THREE.Vector2(0.05, 0.16),
  new THREE.Vector2(0.075, 0.2),
  new THREE.Vector2(0.105, 0.27),
  new THREE.Vector2(0.08, 0.34),
  new THREE.Vector2(0.02, 0.38),
], 6);
const InhabitantMesh = new THREE.InstancedMesh(
  InhabitantGeometry,
  InhabitantMaterial,
  InhabitantCapacity,
);
InhabitantMesh.count = InhabitantInstances.length;
InhabitantMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
InhabitantMesh.frustumCulled = false;
Scene.add(InhabitantMesh);
const InhabitantTransform = new THREE.Object3D();
let VisibleInhabitantCount = -1;
for (let InhabitantIndex = 0; InhabitantIndex < InhabitantInstances.length; InhabitantIndex += 1) {
  const Inhabitant = InhabitantInstances[InhabitantIndex];
  InhabitantMesh.setColorAt(
    InhabitantIndex,
    Inhabitant.worldDefinition.restoration.waveColor,
  );
}
if (InhabitantMesh.instanceColor) InhabitantMesh.instanceColor.needsUpdate = true;
GameCanvas.dataset.inhabitantCount = String(InhabitantInstances.length);

function updateInhabitantVisuals(ElapsedTimeSeconds) {
  let NextVisibleInhabitantCount = 0;
  const IsCollectiveResponseActive = FinaleRestorationStartedAtSeconds !== null
    && GamePhase === 'victoryPending';
  for (let InhabitantIndex = 0; InhabitantIndex < InhabitantInstances.length; InhabitantIndex += 1) {
    const Inhabitant = InhabitantInstances[InhabitantIndex];
    const WorldRuntime = WorldRuntimeByIdentifier.get(Inhabitant.worldDefinition.id);
    const RestorationProgress = WorldRuntime.restorationUniforms.restorationProgress.value;
    const EmergenceProgress = Inhabitant.worldDefinition.restored
      ? THREE.MathUtils.smoothstep(RestorationProgress, 0.54, 0.96)
      : 0;
    if (EmergenceProgress > 0.08) NextVisibleInhabitantCount += 1;
    const WalkingOffset = PrefersReducedMotion
      ? 0
      : Math.sin(
        (ElapsedTimeSeconds * Inhabitant.profile.speed) + Inhabitant.phase,
      ) * Inhabitant.profile.stride;
    const SurfaceAngle = Inhabitant.baseAngle + WalkingOffset;
    const RadialX = Math.cos(SurfaceAngle);
    const RadialY = Math.sin(SurfaceAngle);
    InhabitantTransform.position.set(
      Inhabitant.worldDefinition.position.x
        + (RadialX * (Inhabitant.worldDefinition.radius + 0.16)),
      Inhabitant.worldDefinition.position.y
        + (RadialY * (Inhabitant.worldDefinition.radius + 0.16)),
      0.5 + ((InhabitantIndex % 2) * 0.035),
    );
    InhabitantTransform.rotation.set(0, 0, SurfaceAngle - (Math.PI * 0.5));
    const BobScale = PrefersReducedMotion
      ? 1
      : 1 + (
        Math.sin(
          (ElapsedTimeSeconds * (IsCollectiveResponseActive ? 6.4 : 3.2))
            + Inhabitant.phase,
        ) * (IsCollectiveResponseActive ? 0.2 : 0.08)
      );
    InhabitantTransform.scale.set(
      EmergenceProgress,
      EmergenceProgress * BobScale,
      EmergenceProgress,
    );
    InhabitantTransform.updateMatrix();
    InhabitantMesh.setMatrixAt(InhabitantIndex, InhabitantTransform.matrix);
  }
  if (InhabitantInstances.length > 0) {
    InhabitantMesh.instanceMatrix.needsUpdate = true;
  }
  if (VisibleInhabitantCount !== NextVisibleInhabitantCount) {
    VisibleInhabitantCount = NextVisibleInhabitantCount;
    GameCanvas.dataset.visibleInhabitantCount = String(VisibleInhabitantCount);
  }
}

/** A pooled line network and tiny courier fleet make every new connection persist visibly. */
const MaximumRelayLinkCount = ActiveSystem.launchBudget;
const RelayLinkPositionValues = new Float32Array(MaximumRelayLinkCount * 6);
const RelayLinkGeometry = new THREE.BufferGeometry();
const RelayLinkPositionAttribute = new THREE.BufferAttribute(RelayLinkPositionValues, 3);
RelayLinkPositionAttribute.setUsage(THREE.DynamicDrawUsage);
RelayLinkGeometry.setAttribute('position', RelayLinkPositionAttribute);
RelayLinkGeometry.setDrawRange(0, 0);
const RelayLinkMaterial = new THREE.LineBasicMaterial({
  color: 0x72e8ff,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const RelayLinkMesh = new THREE.LineSegments(RelayLinkGeometry, RelayLinkMaterial);
RelayLinkMesh.frustumCulled = false;
Scene.add(RelayLinkMesh);

const TradeShipGeometry = new THREE.ConeGeometry(0.13, 0.38, 6);
const TradeShipMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a });
const TradeShipMesh = new THREE.InstancedMesh(
  TradeShipGeometry,
  TradeShipMaterial,
  MaximumRelayLinkCount,
);
const TradeShipTransform = new THREE.Object3D();
TradeShipMesh.count = 0;
TradeShipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
TradeShipMesh.frustumCulled = false;
Scene.add(TradeShipMesh);

function publishRelayNetworkState() {
  const Links = listRelayLinks(RelayNetworkState);
  const LiveLinks = listLiveRelayLinks(RelayNetworkState);
  const LiveCircuits = listLiveRelayCircuits(RelayNetworkState);
  GameCanvas.dataset.relayLinkCount = String(Links.length);
  GameCanvas.dataset.relayLinks = Links.map((Link) => Link.id).join(',');
  GameCanvas.dataset.relayLiveLinkCount = String(LiveLinks.length);
  GameCanvas.dataset.relayLiveLinks = LiveLinks.map((Link) => Link.id).join(',');
  GameCanvas.dataset.relaySuppressedWorlds = [
    ...RelayNetworkState.suppressedWorldIdentifiers,
  ].sort().join(',');
  GameCanvas.dataset.relayCircuitCount = String(RelayNetworkState.circuits.size);
  GameCanvas.dataset.relayLiveCircuitCount = String(LiveCircuits.length);
  GameCanvas.dataset.relayProtectedWorlds = listProtectedRelayWorlds(
    RelayNetworkState,
  ).join(',');
  GameCanvas.dataset.relayActiveWorlds = [...RelayNetworkState.activeWorldIdentifiers]
    .sort()
    .join(',');
}

function synchronizeRelayNetworkVisuals() {
  const Links = listLiveRelayLinks(RelayNetworkState);
  const HasLiveCircuit = listLiveRelayCircuits(RelayNetworkState).length > 0;
  RelayLinkMaterial.color.setHex(HasLiveCircuit ? 0xffd98a : 0x72e8ff);
  TradeShipMaterial.color.setHex(HasLiveCircuit ? 0xffffff : 0xffd98a);
  for (let LinkIndex = 0; LinkIndex < Links.length; LinkIndex += 1) {
    const Link = Links[LinkIndex];
    const Origin = getWorldDefinition(Link.originWorldIdentifier);
    const Destination = getWorldDefinition(Link.destinationWorldIdentifier);
    const ValueOffset = LinkIndex * 6;
    RelayLinkPositionValues[ValueOffset] = Origin.position.x;
    RelayLinkPositionValues[ValueOffset + 1] = Origin.position.y;
    RelayLinkPositionValues[ValueOffset + 2] = 0.16;
    RelayLinkPositionValues[ValueOffset + 3] = Destination.position.x;
    RelayLinkPositionValues[ValueOffset + 4] = Destination.position.y;
    RelayLinkPositionValues[ValueOffset + 5] = 0.16;
  }
  RelayLinkGeometry.setDrawRange(0, Links.length * 2);
  RelayLinkPositionAttribute.needsUpdate = true;
  TradeShipMesh.count = Links.length;
  publishRelayNetworkState();
}

function updateRelayNetworkVisuals(ElapsedTimeSeconds) {
  const Links = listLiveRelayLinks(RelayNetworkState);
  RelayLinkMaterial.opacity = 0.64 + (Math.sin(ElapsedTimeSeconds * 2.4) * 0.12);
  for (let LinkIndex = 0; LinkIndex < Links.length; LinkIndex += 1) {
    const Link = Links[LinkIndex];
    const Origin = getWorldDefinition(Link.originWorldIdentifier);
    const Destination = getWorldDefinition(Link.destinationWorldIdentifier);
    const TravelCycleProgress = (
      (ElapsedTimeSeconds * 0.11) + (Link.sequenceIndex * 0.37)
    ) % 2;
    const IsReturning = TravelCycleProgress > 1;
    const TravelProgress = IsReturning
      ? 2 - TravelCycleProgress
      : TravelCycleProgress;
    TradeShipTransform.position.set(
      THREE.MathUtils.lerp(Origin.position.x, Destination.position.x, TravelProgress),
      THREE.MathUtils.lerp(Origin.position.y, Destination.position.y, TravelProgress),
      0.3 + (Math.sin(TravelProgress * Math.PI) * 0.75),
    );
    TradeShipTransform.rotation.set(
      0,
      0,
      Math.atan2(
        Destination.position.y - Origin.position.y,
        Destination.position.x - Origin.position.x,
      ) - (Math.PI * 0.5) + (IsReturning ? Math.PI : 0),
    );
    TradeShipTransform.scale.setScalar(1);
    TradeShipTransform.updateMatrix();
    TradeShipMesh.setMatrixAt(LinkIndex, TradeShipTransform.matrix);
  }
  if (Links.length > 0) TradeShipMesh.instanceMatrix.needsUpdate = true;
}

/** One compact pylon barrier turns a hostile landing into a short circumference challenge. */
const HostilePylonGroup = new THREE.Group();
const HostilePylonMaterial = new THREE.MeshStandardMaterial({
  color: 0x5b1d29,
  emissive: 0xff493f,
  emissiveIntensity: 1.2,
  roughness: 0.48,
  metalness: 0.62,
});
for (const PylonOffset of [-0.16, 0, 0.16]) {
  const PylonMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.72, 0.18),
    HostilePylonMaterial,
  );
  PylonMesh.userData.angleOffset = PylonOffset;
  HostilePylonGroup.add(PylonMesh);
}
HostilePylonGroup.visible = false;
Scene.add(HostilePylonGroup);

function positionHostilePylons(WorldDefinition, SurfaceAngle) {
  for (const PylonMesh of HostilePylonGroup.children) {
    const PylonAngle = SurfaceAngle + PylonMesh.userData.angleOffset;
    const PylonDistance = WorldDefinition.radius + 0.3;
    PylonMesh.position.set(
      WorldDefinition.position.x + (Math.cos(PylonAngle) * PylonDistance),
      WorldDefinition.position.y + (Math.sin(PylonAngle) * PylonDistance),
      0.34,
    );
    PylonMesh.rotation.z = PylonAngle - (Math.PI * 0.5);
  }
  HostilePylonGroup.visible = true;
}

/** The pursuing command vessel is a corrupted miniature world, not a timer overlay. */
const WardenVisualGroup = new THREE.Group();
const WardenCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0x35191f,
  emissive: 0xff3b33,
  emissiveIntensity: 0.75,
  roughness: 0.7,
  metalness: 0.42,
});
const WardenCoreMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.05, 2),
  WardenCoreMaterial,
);
WardenVisualGroup.add(WardenCoreMesh);
const WardenArmorMaterial = new THREE.MeshStandardMaterial({
  color: 0x160f18,
  emissive: 0x6e1018,
  emissiveIntensity: 0.38,
  roughness: 0.38,
  metalness: 0.86,
});
const WardenArmorPanelCount = 8;
const WardenArmorMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.58, 0.16, 0.42),
  WardenArmorMaterial,
  WardenArmorPanelCount,
);
const WardenArmorTransform = new THREE.Object3D();
WardenArmorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
WardenVisualGroup.add(WardenArmorMesh);

const WardenCitadelGroup = new THREE.Group();
const WardenCitadelMaterial = new THREE.MeshStandardMaterial({
  color: 0x25131b,
  emissive: 0xb51f25,
  emissiveIntensity: 0.54,
  roughness: 0.42,
  metalness: 0.8,
});
const WardenCitadelMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.38, 0.78, 6),
  WardenCitadelMaterial,
);
WardenCitadelMesh.position.y = 1.06;
WardenCitadelGroup.add(WardenCitadelMesh);
const WardenBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff5148 });
const WardenBeaconMesh = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.16, 0),
  WardenBeaconMaterial,
);
WardenBeaconMesh.position.y = 1.53;
WardenCitadelGroup.add(WardenBeaconMesh);
WardenVisualGroup.add(WardenCitadelGroup);

const WardenShieldMoonMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a161d,
  emissive: 0xff4138,
  emissiveIntensity: 1.15,
  roughness: 0.5,
  metalness: 0.7,
});
const WardenShieldMoonMesh = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.24, 1),
  WardenShieldMoonMaterial,
  2,
);
const WardenShieldMoonTransform = new THREE.Object3D();
WardenShieldMoonMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
WardenVisualGroup.add(WardenShieldMoonMesh);

const WardenExposureLatticeGroup = new THREE.Group();
const WardenExposureLatticeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd678,
  transparent: true,
  opacity: 0.68,
  depthWrite: false,
});
for (const LatticeRotation of [0, Math.PI / 3, -Math.PI / 3]) {
  const LatticeArc = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.025, 6, 36),
    WardenExposureLatticeMaterial,
  );
  LatticeArc.rotation.y = LatticeRotation;
  WardenExposureLatticeGroup.add(LatticeArc);
}
WardenExposureLatticeGroup.visible = false;
WardenVisualGroup.add(WardenExposureLatticeGroup);

const WardenShieldRings = [];
const WardenShieldRingMaterials = [];
for (const RingRotation of [0, Math.PI * 0.5]) {
  const RingMaterial = new THREE.MeshBasicMaterial({
    color: 0xff675f,
    transparent: true,
    opacity: 0.82,
  });
  const Ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.06, 8, 40),
    RingMaterial,
  );
  Ring.rotation.x = RingRotation;
  WardenVisualGroup.add(Ring);
  WardenShieldRings.push(Ring);
  WardenShieldRingMaterials.push(RingMaterial);
}
WardenVisualGroup.visible = false;
Scene.add(WardenVisualGroup);

const WardenEventPulseMaterial = new THREE.MeshBasicMaterial({
  color: 0xff5148,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const WardenEventPulseMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.82, 0.9, 64),
  WardenEventPulseMaterial,
);
WardenEventPulseMesh.visible = false;
Scene.add(WardenEventPulseMesh);
let WardenEventPulseStartedAtSeconds = null;
let CommandDefeatStartedAtSeconds = null;

function startWardenEventPulse(Position, Color, Beat) {
  WardenEventPulseMesh.position.set(Position.x, Position.y, 0.42);
  WardenEventPulseMesh.scale.setScalar(1);
  WardenEventPulseMaterial.color.setHex(Color);
  WardenEventPulseMaterial.opacity = 0.88;
  WardenEventPulseMesh.visible = true;
  WardenEventPulseStartedAtSeconds = GameElapsedTimeSeconds;
  GameCanvas.dataset.wardenVisualBeat = Beat;
}

const WardenForecastPositions = new Float32Array(6);
const WardenForecastGeometry = new THREE.BufferGeometry();
const WardenForecastAttribute = new THREE.BufferAttribute(WardenForecastPositions, 3);
WardenForecastAttribute.setUsage(THREE.DynamicDrawUsage);
WardenForecastGeometry.setAttribute('position', WardenForecastAttribute);
const WardenForecastMaterial = new THREE.LineDashedMaterial({
  color: 0xff675f,
  transparent: true,
  opacity: 0.58,
  dashSize: 0.45,
  gapSize: 0.3,
  depthWrite: false,
});
const WardenForecastLine = new THREE.Line(WardenForecastGeometry, WardenForecastMaterial);
WardenForecastLine.visible = false;
WardenForecastLine.frustumCulled = false;
Scene.add(WardenForecastLine);
const WardenEntryPosition = new THREE.Vector3(
  WorldheartDefinition.position.x + 8,
  WorldheartDefinition.position.y + 6,
  0.35,
);
const WardenApproachStartPosition = WardenEntryPosition.clone();
WardenVisualGroup.position.copy(WardenEntryPosition);

/** Opens the command route only after both authored progress gates are satisfied. */
function updateCommandWorldAvailability() {
  const HasRestorationSignal = isWorldheartUnlocked(
    WorldDefinitions,
    WorldheartUnlockThreshold,
  );
  const HasBrokenCommandShields = !ActiveSystem.commandWorldRequiresShieldBreaks
    || WardenPursuitState.status === 'exposed';
  if (
    !WorldheartDefinition.routeAvailable
    && HasRestorationSignal
    && HasBrokenCommandShields
  ) {
    WorldheartDefinition.routeAvailable = true;
    WorldheartJustUnlocked = true;
    updateWorldheartObjective();
    return true;
  }
  return false;
}

function publishWardenState() {
  const IsVisible = WardenPursuitState.status !== 'hidden';
  const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  const IsCommandExposed = WardenPursuitState.status === 'exposed';
  WardenPanelElement.hidden = !IsVisible;
  if (IsVisible) {
    ScannerWardenElement.removeAttribute('hidden');
  } else {
    ScannerWardenElement.setAttribute('hidden', '');
  }
  WardenVisualGroup.visible = IsVisible;
  for (let RingIndex = 0; RingIndex < WardenShieldRings.length; RingIndex += 1) {
    WardenShieldRings[RingIndex].visible = RingIndex < WardenPursuitState.shieldLayers;
  }
  WardenShieldMoonMesh.count = WardenPursuitState.shieldLayers;
  WardenExposureLatticeGroup.visible = IsCommandExposed;
  WardenExposureLatticeMaterial.opacity = 0.68;
  WardenVisualGroup.scale.setScalar(1);
  WardenCoreMaterial.color.setHex(IsCommandExposed ? 0x55401b : 0x35191f);
  WardenCoreMaterial.emissive.setHex(IsCommandExposed ? 0xffb23f : 0xff3b33);
  WardenArmorMaterial.emissive.setHex(IsCommandExposed ? 0x9a5b16 : 0x6e1018);
  WardenCitadelMaterial.emissive.setHex(IsCommandExposed ? 0xffae32 : 0xb51f25);
  WardenBeaconMaterial.color.setHex(IsCommandExposed ? 0xffe79a : 0xff5148);
  WardenForecastLine.visible = IsVisible && Boolean(TargetWorld) && !IsCommandExposed;
  WardenDistanceElement.textContent = IsCommandExposed
    ? 'EXPOSED'
    : WardenPursuitState.distance === 0
    ? 'ARRIVING NOW'
    : `${WardenPursuitState.distance} FLIGHT${WardenPursuitState.distance === 1 ? '' : 'S'}`;
  WardenTargetElement.textContent = IsCommandExposed
    ? 'COMMAND WORLD'
    : TargetWorld
    ? `NEXT: ${TargetWorld.label}`
    : listLiveRelayCircuits(RelayNetworkState).length > 0
      ? 'NETWORK BLOCKED'
      : 'TARGET UNKNOWN';
  GameCanvas.dataset.wardenStatus = WardenPursuitState.status;
  GameCanvas.dataset.wardenDistance = String(WardenPursuitState.distance);
  GameCanvas.dataset.wardenTarget = WardenPursuitState.targetWorldIdentifier ?? '';
  GameCanvas.dataset.wardenEvent = WardenPursuitState.lastEvent;
  GameCanvas.dataset.wardenResolvedFlights = String(WardenPursuitState.resolvedFlightCount);
  GameCanvas.dataset.wardenShieldLayers = String(WardenPursuitState.shieldLayers);
  GameCanvas.dataset.wardenLandmark = IsCommandExposed
    ? 'command-world-exposed'
    : (IsVisible ? 'iron-crown-pursuit' : 'hidden');
}

function resolveWardenAfterResolvedFlight({ firstCircuitClosed = false, circuit = null } = {}) {
  const TargetWorldIdentifier = chooseWardenTarget(
    WorldDefinitions,
    listVulnerableRelayWorlds(RelayNetworkState),
  );
  WardenPursuitState = resolveWardenPursuit(WardenPursuitState, {
    activeRelayCount: Math.max(1, countLiveRelayWorlds(RelayNetworkState)),
    targetWorldIdentifier: TargetWorldIdentifier,
    firstCircuitClosed,
  });
  const CommandWorldJustExposed = updateCommandWorldAvailability();
  let SuppressedWorld = null;
  if (WardenPursuitState.lastEvent === WardenPursuitEvents.arrived) {
    SuppressedWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
    if (shouldWardenCatchRunner(
      WardenPursuitState,
      CurrentWorldIdentifier,
      listProtectedRelayWorlds(RelayNetworkState),
    )) {
      WardenVisualGroup.position.set(
        SuppressedWorld.position.x,
        SuppressedWorld.position.y,
        0.35,
      );
      GameCanvas.dataset.wardenCaughtWorld = SuppressedWorld.id;
      publishWardenState();
      RunState = failRunToWarden(RunState);
      scheduleRunFailure(`THE WARDEN REACHED ${SuppressedWorld.label}`);
      return null;
    }
    if (SuppressedWorld && suppressRelayWorld(RelayNetworkState, SuppressedWorld.id)) {
      WardenVisualGroup.position.set(
        SuppressedWorld.position.x,
        SuppressedWorld.position.y,
        0.35,
      );
      WardenApproachStartPosition.copy(WardenVisualGroup.position);
      suppressWorld(SuppressedWorld);
      if (CurrentWorldIdentifier === SuppressedWorld.id && GamePhase === 'restoring') {
        GamePhase = 'attached';
      }
      synchronizeRelayNetworkVisuals();
      const NextTargetWorldIdentifier = chooseWardenTarget(
        WorldDefinitions,
        listVulnerableRelayWorlds(RelayNetworkState),
      );
      WardenPursuitState = resetWardenAfterSuppression(
        WardenPursuitState,
        NextTargetWorldIdentifier,
      );
      GameCanvas.dataset.lastSuppressedWorld = SuppressedWorld.id;
    }
  }
  publishWardenState();
  const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  if (WardenPursuitState.lastEvent === WardenPursuitEvents.revealed) {
    startWardenEventPulse(WardenVisualGroup.position, 0xff5148, 'arrival');
    showInstruction(
      'Unauthorised network detected.',
      `The Warden is targeting ${TargetWorld?.label ?? 'the frontier'} · ${WardenPursuitState.distance} resolved flights away.`,
    );
  } else if (WardenPursuitState.lastEvent === WardenPursuitEvents.advanced) {
    showStatusToast(
      `WARDEN → ${TargetWorld?.label ?? 'FRONTIER'} · ${WardenPursuitState.distance} FLIGHTS`,
      1250,
    );
  } else if (WardenPursuitState.lastEvent === WardenPursuitEvents.retreated) {
    const CircuitWorldLabels = circuit?.worldIdentifiers
      .map((WorldIdentifier) => getWorldDefinition(WorldIdentifier)?.label)
      .filter(Boolean)
      .join(' · ');
    showInstruction(
      WardenPursuitState.status === 'exposed'
        ? 'Command World exposed.'
        : 'Resilient circuit online.',
      WardenPursuitState.status === 'exposed'
        ? `${CircuitWorldLabels || 'The second relay loop'} broke the final shield. Track the moving command and land.`
        : `${CircuitWorldLabels || 'The relay loop'} pushed the Warden back and broke one shield.`,
    );
    showStatusToast(
      WardenPursuitState.status === 'exposed'
        ? 'SECOND CIRCUIT CLOSED · COMMAND EXPOSED'
        : `CIRCUIT CLOSED · WARDEN SHIELD ${WardenPursuitState.shieldLayers}/2`,
      1600,
    );
    if (CommandWorldJustExposed) {
      startWardenEventPulse(WorldheartDefinition.position, 0xffd678, 'resistance');
      WorldheartJustUnlocked = false;
      WorldseedSound.worldheartOpen();
    }
  } else if (SuppressedWorld) {
    startWardenEventPulse(SuppressedWorld.position, 0xff5148, 'suppression');
    showInstruction(
      `Signal lost: ${SuppressedWorld.label}.`,
      'Its route and courier are dark. Land there again to reconnect it.',
    );
    showStatusToast(`WARDEN SUPPRESSED ${SuppressedWorld.label}`, 1500);
  }
  return SuppressedWorld;
}

function updateWardenEventPulse(ElapsedTimeSeconds) {
  if (WardenEventPulseStartedAtSeconds === null) return;
  const PulseDurationSeconds = PrefersReducedMotion ? 0.7 : 1.15;
  const PulseProgress = THREE.MathUtils.clamp(
    (ElapsedTimeSeconds - WardenEventPulseStartedAtSeconds) / PulseDurationSeconds,
    0,
    1,
  );
  const MaximumPulseScale = PrefersReducedMotion ? 1.7 : 3.6;
  WardenEventPulseMesh.scale.setScalar(
    THREE.MathUtils.lerp(1, MaximumPulseScale, PulseProgress),
  );
  WardenEventPulseMaterial.opacity = (1 - PulseProgress) * 0.88;
  if (PulseProgress >= 1) {
    WardenEventPulseMesh.visible = false;
    WardenEventPulseStartedAtSeconds = null;
    GameCanvas.dataset.wardenVisualBeat = '';
  }
}

function updateWardenVisuals(DeltaTimeSeconds, ElapsedTimeSeconds) {
  updateWardenEventPulse(ElapsedTimeSeconds);
  if (WardenPursuitState.status === 'hidden') return;
  const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  const IsCommandExposed = WardenPursuitState.status === 'exposed';
  if (!TargetWorld && !IsCommandExposed) return;
  const ApproachProgress = 1 - (
    WardenPursuitState.distance / WardenPursuitState.maximumDistance
  );
  if (IsCommandExposed) {
    TemporaryThreeVector.set(
      WorldheartDefinition.position.x,
      WorldheartDefinition.position.y,
      0.35,
    );
  } else {
    TemporaryThreeVector.set(
      THREE.MathUtils.lerp(
        WardenApproachStartPosition.x,
        TargetWorld.position.x,
        ApproachProgress,
      ),
      THREE.MathUtils.lerp(
        WardenApproachStartPosition.y,
        TargetWorld.position.y,
        ApproachProgress,
      ),
      0.35,
    );
  }
  if (IsCommandExposed) {
    WardenVisualGroup.position.copy(TemporaryThreeVector);
  } else {
    WardenVisualGroup.position.lerp(
      TemporaryThreeVector,
      1 - Math.exp(-DeltaTimeSeconds * 2.8),
    );
  }
  WardenVisualGroup.rotation.y += DeltaTimeSeconds * 0.32;
  WardenVisualGroup.rotation.z = Math.sin(ElapsedTimeSeconds * 0.7) * 0.08;
  const IsCommandDefeated = CommandDefeatStartedAtSeconds !== null;
  const DefeatProgress = IsCommandDefeated
    ? THREE.MathUtils.clamp((ElapsedTimeSeconds - CommandDefeatStartedAtSeconds) / 1.1, 0, 1)
    : 0;
  const ArmorRadius = IsCommandDefeated
    ? THREE.MathUtils.lerp(1.38, 1.82, DefeatProgress)
    : (IsCommandExposed ? 1.38 : 1.08);
  for (let PanelIndex = 0; PanelIndex < WardenArmorPanelCount; PanelIndex += 1) {
    const PanelAngle = (PanelIndex / WardenArmorPanelCount) * Math.PI * 2;
    WardenArmorTransform.position.set(
      Math.cos(PanelAngle) * ArmorRadius,
      Math.sin(PanelAngle) * ArmorRadius,
      (PanelIndex % 2 === 0 ? 0.22 : -0.22),
    );
    WardenArmorTransform.rotation.set(
      0,
      DefeatProgress * (PanelIndex % 2 === 0 ? 0.8 : -0.8),
      PanelAngle + (Math.PI * 0.5) + (DefeatProgress * 0.55),
    );
    WardenArmorTransform.scale.setScalar(
      IsCommandExposed ? THREE.MathUtils.lerp(0.88, 0.62, DefeatProgress) : 1,
    );
    WardenArmorTransform.updateMatrix();
    WardenArmorMesh.setMatrixAt(PanelIndex, WardenArmorTransform.matrix);
  }
  WardenArmorMesh.instanceMatrix.needsUpdate = true;

  for (let MoonIndex = 0; MoonIndex < WardenShieldMoonMesh.count; MoonIndex += 1) {
    const MoonDirection = MoonIndex === 0 ? 1 : -1;
    const MoonAngle = (ElapsedTimeSeconds * (0.82 + (MoonIndex * 0.18)) * MoonDirection)
      + (MoonIndex * Math.PI);
    WardenShieldMoonTransform.position.set(
      Math.cos(MoonAngle) * 1.82,
      Math.sin(MoonAngle) * 1.42,
      Math.sin(MoonAngle * 1.7) * 0.52,
    );
    WardenShieldMoonTransform.rotation.set(MoonAngle, MoonAngle * 0.7, 0);
    WardenShieldMoonTransform.scale.setScalar(0.92 + (Math.sin(MoonAngle * 2) * 0.08));
    WardenShieldMoonTransform.updateMatrix();
    WardenShieldMoonMesh.setMatrixAt(MoonIndex, WardenShieldMoonTransform.matrix);
  }
  if (WardenShieldMoonMesh.count > 0) {
    WardenShieldMoonMesh.instanceMatrix.needsUpdate = true;
  }
  for (let RingIndex = 0; RingIndex < WardenShieldRings.length; RingIndex += 1) {
    WardenShieldRings[RingIndex].rotation.z += DeltaTimeSeconds * (RingIndex === 0 ? 0.34 : -0.27);
    WardenShieldRingMaterials[RingIndex].opacity = 0.7
      + (Math.sin((ElapsedTimeSeconds * 3.2) + RingIndex) * 0.16);
  }
  WardenExposureLatticeGroup.rotation.y += DeltaTimeSeconds * 0.46;
  WardenExposureLatticeGroup.rotation.z -= DeltaTimeSeconds * 0.22;
  WardenBeaconMesh.scale.setScalar(0.86 + (Math.sin(ElapsedTimeSeconds * 5.2) * 0.16));
  WardenCoreMaterial.emissiveIntensity = IsCommandDefeated
    ? THREE.MathUtils.lerp(2.4, 0.28, DefeatProgress)
    : 0.72 + (Math.sin(ElapsedTimeSeconds * 4) * 0.16);
  if (IsCommandDefeated) {
    WardenCoreMaterial.color.setHex(0x17363a);
    WardenCoreMaterial.emissive.setHex(0x72d9ff);
    WardenArmorMaterial.emissive.setHex(0x17363a);
    WardenCitadelMaterial.emissive.setHex(0x72d9ff);
    WardenBeaconMaterial.color.setHex(0xc6f4ff);
    WardenExposureLatticeMaterial.opacity = (1 - DefeatProgress) * 0.68;
    WardenVisualGroup.scale.setScalar(THREE.MathUtils.lerp(1, 0.9, DefeatProgress));
    GameCanvas.dataset.wardenLandmark = 'command-world-disabled';
  }
  if (TargetWorld) {
    WardenForecastPositions.set([
      WardenVisualGroup.position.x, WardenVisualGroup.position.y, 0.18,
      TargetWorld.position.x, TargetWorld.position.y, 0.18,
    ]);
    WardenForecastAttribute.needsUpdate = true;
    WardenForecastLine.computeLineDistances();
  }
  if (ScannerProjection) {
    const Marker = projectScannerPosition(WardenVisualGroup.position);
    ScannerWardenElement.setAttribute('cx', String(Marker.x));
    ScannerWardenElement.setAttribute('cy', String(Marker.y));
  }
}

/** Two instanced beacons reveal suggested branches without turning choice into a menu. */
const TargetBeaconGeometry = new THREE.RingGeometry(1, 1.04, 72);
const TargetBeaconMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd98a,
  transparent: true,
  opacity: 0.18,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const TargetBeaconMesh = new THREE.InstancedMesh(
  TargetBeaconGeometry,
  TargetBeaconMaterial,
  Math.max(2, RestorableWorldCount),
);
const TargetBeaconTransform = new THREE.Object3D();
TargetBeaconMesh.count = 0;
TargetBeaconMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
TargetBeaconMesh.frustumCulled = false;
Scene.add(TargetBeaconMesh);

/** Seedstone and asteroid share one instanced draw call with distinct authored colours. */
const TacticalBodyGeometry = new THREE.IcosahedronGeometry(SeedstoneDefinition.radius, 2);
const TacticalBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.64,
  metalness: 0.12,
  emissive: 0x10151c,
  emissiveIntensity: 0.7,
});
const TacticalBodyMesh = new THREE.InstancedMesh(
  TacticalBodyGeometry,
  TacticalBodyMaterial,
  TacticalBodyDefinitions.length,
);
const TacticalBodyTransform = new THREE.Object3D();
TacticalBodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
TacticalBodyMesh.frustumCulled = false;
TacticalBodyMesh.setColorAt(0, new THREE.Color(0x72d9ff));
TacticalBodyMesh.setColorAt(1, new THREE.Color(0xc88761));
TacticalBodyMesh.setColorAt(2, new THREE.Color(0xffd678));
TacticalBodyMesh.instanceColor.needsUpdate = true;
Scene.add(TacticalBodyMesh);

/**
 * The campaign finale stays within four pooled draw calls: one heart, one route network,
 * one instanced pulse and one instanced spark field. It is dormant in every other chapter.
 */
const FinaleCoreGeometry = new THREE.IcosahedronGeometry(WorldheartDefinition.radius, 3);
const FinaleCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0xffe0a0,
  emissive: 0xffc968,
  emissiveIntensity: 2.4,
  roughness: 0.28,
  metalness: 0.08,
});
const FinaleCoreMesh = new THREE.Mesh(FinaleCoreGeometry, FinaleCoreMaterial);
FinaleCoreMesh.position.set(
  WorldheartDefinition.position.x,
  WorldheartDefinition.position.y,
  0.1,
);
FinaleCoreMesh.visible = false;
Scene.add(FinaleCoreMesh);

const FinaleLinkPositionValues = new Float32Array(WorldDefinitions.length * 6);
const FinaleLinkGeometry = new THREE.BufferGeometry();
const FinaleLinkPositionAttribute = new THREE.BufferAttribute(FinaleLinkPositionValues, 3);
FinaleLinkPositionAttribute.setUsage(THREE.DynamicDrawUsage);
FinaleLinkGeometry.setAttribute('position', FinaleLinkPositionAttribute);
const FinaleLinkMaterial = new THREE.LineBasicMaterial({
  color: ActiveSystem.finale?.pulseColor ?? 0xffe0a0,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const FinaleLinkMesh = new THREE.LineSegments(FinaleLinkGeometry, FinaleLinkMaterial);
FinaleLinkMesh.visible = false;
FinaleLinkMesh.frustumCulled = false;
Scene.add(FinaleLinkMesh);

const FinalePulseCount = 5;
const FinalePulseGeometry = new THREE.RingGeometry(0.82, 0.92, 64);
const FinalePulseMaterial = new THREE.MeshBasicMaterial({
  color: ActiveSystem.finale?.pulseColor ?? 0xffe0a0,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const FinalePulseMesh = new THREE.InstancedMesh(
  FinalePulseGeometry,
  FinalePulseMaterial,
  FinalePulseCount,
);
const FinalePulseTransform = new THREE.Object3D();
FinalePulseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
FinalePulseMesh.frustumCulled = false;
FinalePulseMesh.visible = false;
Scene.add(FinalePulseMesh);

const FinaleSparkCount = 56;
const FinaleSparkGeometry = new THREE.OctahedronGeometry(0.09, 0);
const FinaleSparkMaterial = new THREE.MeshBasicMaterial({
  color: ActiveSystem.finale?.pulseColor ?? 0xffe0a0,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const FinaleSparkMesh = new THREE.InstancedMesh(
  FinaleSparkGeometry,
  FinaleSparkMaterial,
  FinaleSparkCount,
);
const FinaleSparkTransform = new THREE.Object3D();
FinaleSparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
FinaleSparkMesh.frustumCulled = false;
FinaleSparkMesh.visible = false;
Scene.add(FinaleSparkMesh);

/** Builds a restrained orbit guide so deterministic moving bodies remain readable. */
function createOrbitGuidePoints(BodyDefinition, Height) {
  if (!BodyDefinition.orbit) {
    return [];
  }
  const OrbitPoints = [];
  for (let OrbitPointIndex = 0; OrbitPointIndex < 96; OrbitPointIndex += 1) {
    const OrbitAngle = (OrbitPointIndex / 96) * Math.PI * 2;
    OrbitPoints.push(new THREE.Vector3(
      BodyDefinition.orbit.centre.x + (Math.cos(OrbitAngle) * BodyDefinition.orbit.radius),
      BodyDefinition.orbit.centre.y + (Math.sin(OrbitAngle) * BodyDefinition.orbit.radius),
      Height,
    ));
  }
  return OrbitPoints;
}

const AsteroidOrbitPoints = createOrbitGuidePoints(AsteroidDefinition, 0.04);
const AsteroidOrbitGeometry = new THREE.BufferGeometry().setFromPoints(AsteroidOrbitPoints);
const AsteroidOrbitMaterial = new THREE.LineBasicMaterial({
  color: 0xb96c5c,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const AsteroidOrbitLine = new THREE.LineLoop(AsteroidOrbitGeometry, AsteroidOrbitMaterial);
Scene.add(AsteroidOrbitLine);

const SeedstoneOrbitGeometry = new THREE.BufferGeometry().setFromPoints(
  createOrbitGuidePoints(SeedstoneDefinition, 0.045),
);
const SeedstoneOrbitMaterial = new THREE.LineBasicMaterial({
  color: 0x72d9ff,
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
});
const SeedstoneOrbitLine = new THREE.LineLoop(SeedstoneOrbitGeometry, SeedstoneOrbitMaterial);
SeedstoneOrbitLine.visible = Boolean(SeedstoneDefinition.orbit);
Scene.add(SeedstoneOrbitLine);

/** Three optional motes trace one expressive Meadow-to-Frost mastery arc. */
const StardustGeometry = new THREE.OctahedronGeometry(StardustPickupRadius, 0);
const StardustMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const StardustBaseColor = new THREE.Color(0x82dfff);
const StardustPredictedColor = new THREE.Color(0xffef9b);
const WorldheartLockedColor = new THREE.Color(0x444d4b);
const WorldheartOpenColor = new THREE.Color(0xffd678);
const StardustMesh = new THREE.InstancedMesh(
  StardustGeometry,
  StardustMaterial,
  StardustDefinitions.length,
);
const StardustTransform = new THREE.Object3D();
StardustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
StardustMesh.frustumCulled = false;
for (let StardustIndex = 0; StardustIndex < StardustDefinitions.length; StardustIndex += 1) {
  StardustMesh.setColorAt(StardustIndex, StardustBaseColor);
}
StardustMesh.instanceColor.needsUpdate = true;
Scene.add(StardustMesh);

/** A compact procedural Runner preserves the original collision radius and mobile readability. */
const SeedGroup = new THREE.Group();
const RunnerVisualGroup = new THREE.Group();
RunnerVisualGroup.scale.setScalar(1.18);
const RunnerSuitMaterial = new THREE.MeshStandardMaterial({
  color: 0xe9f2f4,
  emissive: 0x4f8fa0,
  emissiveIntensity: 0.28,
  roughness: 0.38,
  metalness: 0.08,
});
const RunnerDarkMaterial = new THREE.MeshStandardMaterial({
  color: 0x193646,
  emissive: 0x0d2633,
  emissiveIntensity: 0.4,
  roughness: 0.32,
  metalness: 0.28,
});
const RunnerVisorMaterial = new THREE.MeshStandardMaterial({
  color: 0xffbf62,
  emissive: 0xff7a38,
  emissiveIntensity: 1.25,
  roughness: 0.2,
  metalness: 0.3,
});

const RunnerBackpackMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.34, 0.38, 0.2),
  RunnerDarkMaterial,
);
RunnerBackpackMesh.position.set(0, -0.11, -0.13);
RunnerVisualGroup.add(RunnerBackpackMesh);

const RunnerTorsoMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 16, 12),
  RunnerSuitMaterial,
);
RunnerTorsoMesh.position.y = -0.12;
RunnerTorsoMesh.scale.set(0.88, 1.08, 0.72);
RunnerTorsoMesh.castShadow = true;
RunnerVisualGroup.add(RunnerTorsoMesh);

const RunnerHelmetMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.27, 20, 14),
  RunnerSuitMaterial,
);
RunnerHelmetMesh.position.y = 0.17;
RunnerHelmetMesh.castShadow = true;
RunnerVisualGroup.add(RunnerHelmetMesh);

const RunnerVisorMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.19, 16, 10),
  RunnerVisorMaterial,
);
RunnerVisorMesh.position.set(0, 0.18, 0.2);
RunnerVisorMesh.scale.set(1, 0.7, 0.34);
RunnerVisualGroup.add(RunnerVisorMesh);

const RunnerLimbGeometry = new THREE.CylinderGeometry(0.052, 0.065, 0.24, 8);
const RunnerArmMeshes = [];
const RunnerLegMeshes = [];
for (const Side of [-1, 1]) {
  const ArmMesh = new THREE.Mesh(RunnerLimbGeometry, RunnerSuitMaterial);
  ArmMesh.position.set(Side * 0.245, -0.12, 0);
  ArmMesh.rotation.z = Side * -0.22;
  ArmMesh.userData.side = Side;
  RunnerArmMeshes.push(ArmMesh);
  RunnerVisualGroup.add(ArmMesh);

  const LegMesh = new THREE.Mesh(RunnerLimbGeometry, RunnerSuitMaterial);
  LegMesh.position.set(Side * 0.095, -0.34, 0);
  LegMesh.rotation.z = Side * -0.08;
  LegMesh.userData.side = Side;
  RunnerLegMeshes.push(LegMesh);
  RunnerVisualGroup.add(LegMesh);
}

const RunnerThrusterMaterial = new THREE.MeshBasicMaterial({
  color: 0x7deaff,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const RunnerThrusterGroup = new THREE.Group();
for (const Side of [-1, 1]) {
  const ThrusterFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.3, 8),
    RunnerThrusterMaterial,
  );
  ThrusterFlame.position.set(Side * 0.09, -0.5, -0.07);
  ThrusterFlame.rotation.z = Math.PI;
  RunnerThrusterGroup.add(ThrusterFlame);
}
RunnerThrusterGroup.visible = false;
RunnerVisualGroup.add(RunnerThrusterGroup);

const RunnerAntennaStem = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6),
  RunnerDarkMaterial,
);
RunnerAntennaStem.position.set(0.16, 0.42, 0);
RunnerAntennaStem.rotation.z = -0.22;
RunnerVisualGroup.add(RunnerAntennaStem);
const RunnerAntennaLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 10, 8),
  RunnerVisorMaterial,
);
RunnerAntennaLight.position.set(0.18, 0.5, 0);
RunnerVisualGroup.add(RunnerAntennaLight);
SeedGroup.add(RunnerVisualGroup);

/** The Orbitbreaker unfolds around the same physics body; only its silhouette changes. */
const ShipVisualGroup = new THREE.Group();
const ShipHullMaterial = new THREE.MeshStandardMaterial({
  color: 0xddecef,
  emissive: 0x2a7f99,
  emissiveIntensity: 0.42,
  roughness: 0.3,
  metalness: 0.46,
});
const ShipAccentMaterial = new THREE.MeshStandardMaterial({
  color: 0xffa85d,
  emissive: 0xff623b,
  emissiveIntensity: 1.1,
  roughness: 0.26,
  metalness: 0.34,
});
const ShipHullMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.22, 0.44, 6, 12),
  ShipHullMaterial,
);
ShipHullMesh.scale.set(0.9, 1, 0.72);
ShipHullMesh.castShadow = true;
ShipVisualGroup.add(ShipHullMesh);
const ShipNoseMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.22, 0.3, 12),
  ShipAccentMaterial,
);
ShipNoseMesh.position.y = 0.5;
ShipVisualGroup.add(ShipNoseMesh);
for (const Side of [-1, 1]) {
  const WingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.2, 0.055),
    ShipHullMaterial,
  );
  WingMesh.position.set(Side * 0.28, -0.15, 0);
  WingMesh.rotation.z = Side * -0.32;
  ShipVisualGroup.add(WingMesh);
}
const ShipWindowMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.13, 12, 8),
  RunnerVisorMaterial,
);
ShipWindowMesh.position.set(0, 0.16, 0.2);
ShipWindowMesh.scale.set(1, 1.18, 0.38);
ShipVisualGroup.add(ShipWindowMesh);
const ShipThrusterMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.12, 0.44, 10),
  RunnerThrusterMaterial,
);
ShipThrusterMesh.position.y = -0.56;
ShipThrusterMesh.rotation.z = Math.PI;
ShipVisualGroup.add(ShipThrusterMesh);
ShipVisualGroup.visible = false;
SeedGroup.add(ShipVisualGroup);

const SeedHaloGeometry = new THREE.SphereGeometry(SeedRadius * 1.65, 24, 16);
const SeedHaloMaterial = new THREE.MeshBasicMaterial({
  color: 0x6de8ff,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const SeedHaloMesh = new THREE.Mesh(SeedHaloGeometry, SeedHaloMaterial);
SeedGroup.add(SeedHaloMesh);

const SeedPointLight = new THREE.PointLight(0x72dcff, 2.1, 6, 2);
SeedGroup.add(SeedPointLight);
Scene.add(SeedGroup);

/**
 * An enlarged invisible sphere makes pointer acquisition forgiving on touchscreens.
 */
const SeedPointerHitGeometry = new THREE.SphereGeometry(SeedRadius * 2.3, 12, 8);
const SeedPointerHitMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const SeedPointerHitMesh = new THREE.Mesh(SeedPointerHitGeometry, SeedPointerHitMaterial);
SeedGroup.add(SeedPointerHitMesh);

/**
 * Launch preview uses a single line plus a terminal landing marker. The final art pass can
 * convert this to a dotted shader or particle trail without touching trajectory logic.
 */
const MaximumPreviewPointCount = Math.ceil(RankedPredictionVisibleSteps / 4) + 2;
const TrajectoryPositionValues = new Float32Array(MaximumPreviewPointCount * 3);
const TrajectoryGeometry = new THREE.BufferGeometry();
const TrajectoryPositionAttribute = new THREE.BufferAttribute(TrajectoryPositionValues, 3);
TrajectoryPositionAttribute.setUsage(THREE.DynamicDrawUsage);
TrajectoryGeometry.setAttribute('position', TrajectoryPositionAttribute);
TrajectoryGeometry.setDrawRange(0, 0);
const TrajectoryMaterial = new THREE.LineBasicMaterial({
  color: 0xd9f6cc,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});
const TrajectoryLine = new THREE.Line(TrajectoryGeometry, TrajectoryMaterial);
TrajectoryLine.visible = false;
TrajectoryLine.frustumCulled = false;
Scene.add(TrajectoryLine);

const LandingMarkerGeometry = new THREE.RingGeometry(0.42, 0.58, 32);
const LandingMarkerMaterial = new THREE.MeshBasicMaterial({
  color: 0xd9f6cc,
  transparent: true,
  opacity: 0.82,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const LandingMarkerMesh = new THREE.Mesh(LandingMarkerGeometry, LandingMarkerMaterial);
LandingMarkerMesh.visible = false;
LandingMarkerMesh.position.z = 0.18;
Scene.add(LandingMarkerMesh);

/** Reused rings provide launch snap and landing impact without allocating during play. */
const FeedbackPulseGeometry = new THREE.RingGeometry(0.42, 0.55, 36);
function createFeedbackPulse(Color) {
  const PulseMaterial = new THREE.MeshBasicMaterial({
    color: Color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const PulseMesh = new THREE.Mesh(FeedbackPulseGeometry, PulseMaterial);
  PulseMesh.visible = false;
  Scene.add(PulseMesh);
  return PulseMesh;
}

const LaunchPulseMesh = createFeedbackPulse(0xd9f6cc);
const ImpactPulseMesh = createFeedbackPulse(0xfff2bc);

/** A dotted pull guide points away from the first target before the first launch. */
const PullGuideGeometry = new THREE.BufferGeometry();
const PullGuideMaterial = new THREE.LineDashedMaterial({
  color: 0xd9f6cc,
  transparent: true,
  opacity: 0.42,
  dashSize: 0.22,
  gapSize: 0.14,
  depthWrite: false,
  depthTest: false,
});
const PullGuideLine = new THREE.Line(PullGuideGeometry, PullGuideMaterial);
PullGuideLine.visible = false;
PullGuideLine.renderOrder = 20;
Scene.add(PullGuideLine);

/**
 * Creates a small trail behind the flying seed as one instanced draw call. Pooling avoids
 * allocation spikes and protects the restoration draw-call budget during flight.
 */
const TrailParticlePool = [];
const TrailParticleCount = 22;
const TrailParticleGeometry = new THREE.SphereGeometry(0.10, 6, 4);
const TrailParticleMaterial = new THREE.MeshBasicMaterial({
  color: 0xc9efb8,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const TrailParticleMesh = new THREE.InstancedMesh(
  TrailParticleGeometry,
  TrailParticleMaterial,
  TrailParticleCount,
);
const TrailParticleTransform = new THREE.Object3D();
TrailParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
TrailParticleMesh.frustumCulled = false;
Scene.add(TrailParticleMesh);

for (let TrailParticleIndex = 0; TrailParticleIndex < TrailParticleCount; TrailParticleIndex += 1) {
  const TrailParticle = {
    index: TrailParticleIndex,
    position: new THREE.Vector3(),
    lifeRemainingSeconds: 0,
    maximumLifeSeconds: 0.42,
  };
  TrailParticlePool.push(TrailParticle);
  updateTrailParticleInstance(TrailParticle, 0);
}
TrailParticleMesh.instanceMatrix.needsUpdate = true;

let NextTrailParticleIndex = 0;
let TrailEmissionAccumulatorSeconds = 0;

/** Writes one pooled trail particle into the shared instanced mesh. */
function updateTrailParticleInstance(TrailParticle, Scale) {
  TrailParticleTransform.position.copy(TrailParticle.position);
  TrailParticleTransform.scale.setScalar(Scale);
  TrailParticleTransform.updateMatrix();
  TrailParticleMesh.setMatrixAt(TrailParticle.index, TrailParticleTransform.matrix);
}

/**
 * Converts pointer coordinates into the XY orbital plane.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {THREE.Vector3|null} Intersection position or null if the ray misses the plane.
 */
function getPointerWorldPosition(PointerEventData) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;

  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, Camera);
  const IntersectionResult = PointerRaycaster.ray.intersectPlane(OrbitalPlane, PointerWorldPosition);
  return IntersectionResult ? PointerWorldPosition : null;
}

/**
 * Returns true when the supplied pointer begins close enough to the visible seed.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {boolean} Whether the user acquired the seed.
 */
function isPointerOverSeed(PointerEventData) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;
  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, Camera);

  return PointerRaycaster.intersectObject(SeedPointerHitMesh, false).length > 0;
}

/**
 * Reads the current world definition by identifier.
 *
 * @param {string} WorldIdentifier - Stable world identifier.
 * @returns {object|undefined} Matching world definition.
 */
function getWorldDefinition(WorldIdentifier) {
  return WorldDefinitions.find((WorldDefinition) => WorldDefinition.id === WorldIdentifier);
}

/** Publishes low-frequency attached state for browser verification and route tuning. */
function publishAttachedSeedState(NodeIdentifier, Position) {
  GameCanvas.dataset.currentNode = NodeIdentifier;
  GameCanvas.dataset.seedWorldX = Position.x.toFixed(3);
  GameCanvas.dataset.seedWorldY = Position.y.toFixed(3);
}

/** Synchronises an authored moving launch node and any seed currently riding its surface. */
function synchronizeSeedstonePosition() {
  const SeedstonePosition = calculateBodyPositionAtTime(
    SeedstoneDefinition,
    PhysicsElapsedTimeSeconds,
  );
  SeedstoneDefinition.position.x = SeedstonePosition.x;
  SeedstoneDefinition.position.y = SeedstonePosition.y;
  SeedstoneDefinition.position.z = SeedstonePosition.z;

  if (
    CurrentWorldIdentifier === SeedstoneDefinition.id
    && GamePhase === 'attached'
    && AttachedSeedstoneSurfaceOffset
  ) {
    SeedPhysicsState.position.x = SeedstonePosition.x + AttachedSeedstoneSurfaceOffset.x;
    SeedPhysicsState.position.y = SeedstonePosition.y + AttachedSeedstoneSurfaceOffset.y;
    SeedPhysicsState.position.z = SeedstonePosition.z + AttachedSeedstoneSurfaceOffset.z;
    publishAttachedSeedState(CurrentWorldIdentifier, SeedPhysicsState.position);
  }

  return SeedstoneDefinition.position;
}

/** Keeps the exposed Command World, its landed Runner, and barrier on one fixed-step orbit. */
function synchronizeWorldheartPosition() {
  const WorldheartPosition = calculateBodyPositionAtTime(
    WorldheartDefinition,
    PhysicsElapsedTimeSeconds,
  );
  WorldheartDefinition.position.x = WorldheartPosition.x;
  WorldheartDefinition.position.y = WorldheartPosition.y;
  WorldheartDefinition.position.z = WorldheartPosition.z;

  if (
    CurrentWorldIdentifier === WorldheartDefinition.id
    && AttachedWorldheartSurfaceAngle !== null
    && GamePhase !== 'runFailed'
  ) {
    const SurfacePosition = getSurfacePosition(
      WorldheartDefinition.position,
      WorldheartDefinition.radius + SeedRadius + 0.03,
      AttachedWorldheartSurfaceAngle,
    );
    SeedPhysicsState.position.x = SurfacePosition.x;
    SeedPhysicsState.position.y = SurfacePosition.y;
    SeedPhysicsState.position.z = SurfacePosition.z;
    SeedGroup.position.set(SurfacePosition.x, SurfacePosition.y, SurfacePosition.z);
    publishAttachedSeedState(CurrentWorldIdentifier, SurfacePosition);
    if (ActiveHostileEncounterState) {
      positionHostilePylons(
        WorldheartDefinition,
        ActiveHostileEncounterState.pylonSurfaceAngle,
      );
    }
  }

  return WorldheartDefinition.position;
}

/** Returns the collision bodies that are active at the current campaign state. */
function getActiveTacticalBodyDefinitions() {
  return TacticalBodyDefinitions.filter((BodyDefinition) => (
    BodyDefinition.kind === 'hazard'
    || (BodyDefinition.kind === 'seedstone' && SeedstoneUsesRemaining > 0)
    || (BodyDefinition.kind === 'worldheart' && WorldheartDefinition.routeAvailable)
  ));
}

/** Applies authored route emphasis while leaving every physical destination valid. */
function getCurrentRouteChoices(MaximumChoiceCount = 2) {
  const ExpansionChoices = getRouteChoices(
    CampaignNodeDefinitions,
    CurrentWorldIdentifier,
    MaximumChoiceCount,
    ActiveSystem.routeSuggestions[CurrentWorldIdentifier] ?? [],
  );
  if (
    WorldheartDefinition.routeAvailable
    && !WorldheartDefinition.restored
    && CurrentWorldIdentifier !== WorldheartDefinition.id
  ) {
    return [
      WorldheartDefinition,
      ...ExpansionChoices.filter((Choice) => Choice.id !== WorldheartDefinition.id),
    ].slice(0, MaximumChoiceCount);
  }
  if (
    WardenPursuitState.status === 'hidden'
    || listLiveRelayCircuits(RelayNetworkState).length > 0
  ) {
    return ExpansionChoices;
  }
  const CircuitChoices = WorldDefinitions
    .filter((WorldDefinition) => (
      WorldDefinition.id !== CurrentWorldIdentifier
      && WorldDefinition.restored
      && wouldCloseRelayCircuit(
        RelayNetworkState,
        CurrentWorldIdentifier,
        WorldDefinition.id,
      )
    ))
    .sort((FirstWorld, SecondWorld) => {
      const CurrentWorld = getWorldDefinition(CurrentWorldIdentifier);
      const FirstDistance = Math.hypot(
        FirstWorld.position.x - CurrentWorld.position.x,
        FirstWorld.position.y - CurrentWorld.position.y,
      );
      const SecondDistance = Math.hypot(
        SecondWorld.position.x - CurrentWorld.position.x,
        SecondWorld.position.y - CurrentWorld.position.y,
      );
      return FirstDistance - SecondDistance || FirstWorld.id.localeCompare(SecondWorld.id);
    });
  return [...CircuitChoices, ...ExpansionChoices]
    .filter((Choice, ChoiceIndex, Choices) => (
      Choices.findIndex((Candidate) => Candidate.id === Choice.id) === ChoiceIndex
    ))
    .slice(0, MaximumChoiceCount);
}

/** Reveals the nearest useful routes while leaving every physical destination valid. */
function showRouteChoiceInstruction() {
  const RouteChoices = getCurrentRouteChoices(2);
  const CircuitChoice = RouteChoices.find((RouteChoice) => (
    wouldCloseRelayCircuit(
      RelayNetworkState,
      CurrentWorldIdentifier,
      RouteChoice.id,
    )
  ));
  if (CircuitChoice) {
    const ExpansionChoice = RouteChoices.find((RouteChoice) => RouteChoice !== CircuitChoice);
    showInstruction(
      ExpansionChoice
        ? `Reinforce ${CircuitChoice.label} or expand to ${ExpansionChoice.label}`
        : `Reinforce the route to ${CircuitChoice.label}`,
      'Close the gold relay loop to protect its worlds and push the Warden back.',
    );
    return;
  }
  const HasWorldheartChoice = RouteChoices.some(
    (RouteChoice) => RouteChoice.id === WorldheartDefinition.id,
  );
  if (HasWorldheartChoice) {
    showInstruction(
      'The COMMAND WORLD route is open',
      isSystemRestored(WorldDefinitions)
        ? 'Every world is free. Guide the Runner into the golden command core.'
        : 'Bank the run now, or liberate the final world first.',
    );
    return;
  }
  if (RouteChoices.length === 0) {
    showInstruction(
      `The ${ActiveSystem.label} network is awake`,
      'Find the golden Command World route.',
    );
    return;
  }

  if (RouteChoices.length === 1) {
    showInstruction(
      RouteChoices[0].label + ' remains',
      'Use the bright path to find your final landing.',
    );
    return;
  }

  showInstruction(
    'Choose ' + RouteChoices[0].label + ' or ' + RouteChoices[1].label,
    'Gold rings suggest routes — every landing becomes your next launch point.',
  );
}

/** Updates the two suggested destination rings as a single draw call. */
function updateTargetBeacons(ElapsedTimeSeconds) {
  const ShouldShowChoices = GamePhase === 'attached';
  const RouteChoices = ShouldShowChoices
    ? getCurrentRouteChoices(2)
    : [];
  const PulseScale = 1 + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.025);

  TargetBeaconMesh.count = RouteChoices.length;
  TargetBeaconMesh.visible = RouteChoices.length > 0;
  TargetBeaconMaterial.opacity = 0.13 + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.055);

  for (let ChoiceIndex = 0; ChoiceIndex < RouteChoices.length; ChoiceIndex += 1) {
    const WorldDefinition = RouteChoices[ChoiceIndex];
    const RingRadius = (WorldDefinition.radius + 0.55) * PulseScale;
    TargetBeaconTransform.position.set(
      WorldDefinition.position.x,
      WorldDefinition.position.y,
      0.08,
    );
    TargetBeaconTransform.rotation.set(0, 0, (
      (-ElapsedTimeSeconds * 0.35) + (ChoiceIndex * Math.PI * 0.18)
    ));
    TargetBeaconTransform.scale.setScalar(RingRadius);
    TargetBeaconTransform.updateMatrix();
    TargetBeaconMesh.setMatrixAt(ChoiceIndex, TargetBeaconTransform.matrix);
  }
  TargetBeaconMesh.instanceMatrix.needsUpdate = RouteChoices.length > 0;
}

/** Projects suggested world names into the HUD without spending WebGL draw calls. */
function updateRouteLabels() {
  const RouteChoices = GamePhase === 'attached'
    ? getCurrentRouteChoices(RouteLabelElements.length)
    : [];

  for (let LabelIndex = 0; LabelIndex < RouteLabelElements.length; LabelIndex += 1) {
    const RouteLabelElement = RouteLabelElements[LabelIndex];
    const WorldDefinition = RouteChoices[LabelIndex];
    if (!WorldDefinition) {
      RouteLabelElement.textContent = '';
      continue;
    }

    RouteLabelProjection.set(
      WorldDefinition.position.x,
      WorldDefinition.position.y + WorldDefinition.radius + 0.72,
      0,
    ).project(Camera);
    const IsOffscreen = Math.abs(RouteLabelProjection.x) > 0.92
      || Math.abs(RouteLabelProjection.y) > 0.86;
    let DirectionPrefix = '';
    if (IsOffscreen) {
      DirectionPrefix = Math.abs(RouteLabelProjection.x) > Math.abs(RouteLabelProjection.y)
        ? (RouteLabelProjection.x > 0 ? '→ ' : '← ')
        : (RouteLabelProjection.y > 0 ? '↑ ' : '↓ ');
    }
    RouteLabelElement.textContent = DirectionPrefix + WorldDefinition.label;
    const HorizontalMargin = window.innerWidth <= 640 ? 48 : 58;
    const TopMargin = window.innerWidth <= 640 ? 172 : 78;
    const BottomMargin = window.innerWidth <= 640 ? 112 : 82;
    RouteLabelElement.style.left = Math.round(
      THREE.MathUtils.clamp(
        (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth,
        HorizontalMargin,
        window.innerWidth - HorizontalMargin,
      ),
    ) + 'px';
    RouteLabelElement.style.top = Math.round(
      THREE.MathUtils.clamp(
        (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
        TopMargin,
        window.innerHeight - BottomMargin,
      ),
    ) + 'px';
  }
}

/** Updates deterministic tactical-body transforms and their world-space HUD labels. */
function updateTacticalBodies(ElapsedTimeSeconds) {
  const ShouldShowTacticalLayer = ![
    'restoring',
    'victoryPending',
    'victory',
  ].includes(GamePhase);
  const AsteroidPosition = calculateBodyPositionAtTime(
    AsteroidDefinition,
    PhysicsElapsedTimeSeconds,
  );
  const SeedstonePosition = synchronizeSeedstonePosition();
  const WorldheartPosition = synchronizeWorldheartPosition();
  const SeedstoneScale = SeedstoneUsesRemaining > 0
    ? 1 + (Math.sin(ElapsedTimeSeconds * 4.4) * 0.045)
    : Math.max(
      0,
      1 - ((ElapsedTimeSeconds - (SeedstoneCrumbleStartedAtSeconds ?? 0)) / 0.55),
    );

  TacticalBodyTransform.position.set(
    SeedstonePosition.x,
    SeedstonePosition.y,
    0.08,
  );
  TacticalBodyTransform.rotation.set(
    ElapsedTimeSeconds * 0.18,
    ElapsedTimeSeconds * 0.31,
    ElapsedTimeSeconds * 0.12,
  );
  TacticalBodyTransform.scale.setScalar(SeedstoneScale);
  TacticalBodyTransform.updateMatrix();
  TacticalBodyMesh.setMatrixAt(0, TacticalBodyTransform.matrix);

  TacticalBodyTransform.position.set(AsteroidPosition.x, AsteroidPosition.y, 0.1);
  TacticalBodyTransform.rotation.set(
    ElapsedTimeSeconds * 0.72,
    ElapsedTimeSeconds * 0.94,
    ElapsedTimeSeconds * 0.48,
  );
  TacticalBodyTransform.scale.setScalar(AsteroidDefinition.radius / SeedstoneDefinition.radius);
  TacticalBodyTransform.updateMatrix();
  TacticalBodyMesh.setMatrixAt(1, TacticalBodyTransform.matrix);

  const WorldheartPulseScale = WorldheartDefinition.routeAvailable
    ? 1 + (Math.sin(ElapsedTimeSeconds * 3.2) * 0.1)
    : 0.36 + (Math.sin(ElapsedTimeSeconds * 1.4) * 0.018);
  TacticalBodyTransform.position.set(
    WorldheartPosition.x,
    WorldheartPosition.y,
    0.1,
  );
  TacticalBodyTransform.rotation.set(
    ElapsedTimeSeconds * 0.42,
    ElapsedTimeSeconds * 0.58,
    ElapsedTimeSeconds * 0.35,
  );
  TacticalBodyTransform.scale.setScalar(
    (WorldheartDefinition.radius / SeedstoneDefinition.radius) * WorldheartPulseScale,
  );
  TacticalBodyTransform.updateMatrix();
  TacticalBodyMesh.setMatrixAt(2, TacticalBodyTransform.matrix);
  TacticalBodyMesh.setColorAt(
    2,
    WorldheartDefinition.routeAvailable ? WorldheartOpenColor : WorldheartLockedColor,
  );
  TacticalBodyMesh.instanceMatrix.needsUpdate = true;
  TacticalBodyMesh.instanceColor.needsUpdate = true;
  TacticalBodyMesh.visible = ShouldShowTacticalLayer;
  AsteroidOrbitLine.visible = ShouldShowTacticalLayer;
  AsteroidOrbitMaterial.opacity = 0.14 + (Math.sin(ElapsedTimeSeconds * 1.8) * 0.035);
  SeedstoneOrbitLine.visible = ShouldShowTacticalLayer && Boolean(SeedstoneDefinition.orbit);
  SeedstoneOrbitMaterial.opacity = 0.11 + (Math.sin(ElapsedTimeSeconds * 1.5) * 0.025);

  const TacticalLabelDefinitions = [
    SeedstoneUsesRemaining > 0
      ? {
        definition: SeedstoneDefinition,
        position: SeedstonePosition,
        text: SeedstoneDefinition.orbit
          ? window.innerWidth <= 520
            ? `${SeedstoneDefinition.label} · 1 USE`
            : `${SeedstoneDefinition.label} · MOVING · 1 USE`
          : `${SeedstoneDefinition.label} · 1 USE`,
      }
      : null,
    {
      definition: AsteroidDefinition,
      position: AsteroidPosition,
      text: `${AsteroidDefinition.label} · MOVING`,
    },
    WorldheartDefinition.routeAvailable
      ? {
        definition: WorldheartDefinition,
        position: WorldheartPosition,
        text: WorldheartDefinition.orbit
          ? `${WorldheartDefinition.label} · EXPOSED · MOVING`
          : `${WorldheartDefinition.label} · EXPOSED`,
      }
      : null,
  ];
  for (let LabelIndex = 0; LabelIndex < TacticalLabelElements.length; LabelIndex += 1) {
    const TacticalLabelElement = TacticalLabelElements[LabelIndex];
    const TacticalLabelDefinition = TacticalLabelDefinitions[LabelIndex];
    if (
      !ShouldShowTacticalLayer
      || !TacticalLabelDefinition
      || GamePhase !== 'attached'
      || StatusToastElement.classList.contains('is-visible')
    ) {
      TacticalLabelElement.textContent = '';
      continue;
    }

    RouteLabelProjection.set(
      TacticalLabelDefinition.position.x,
      TacticalLabelDefinition.position.y + TacticalLabelDefinition.definition.radius + 0.55,
      0,
    ).project(Camera);
    TacticalLabelElement.textContent = TacticalLabelDefinition.text;
    const ProjectedLabelX = (
      (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth
    );
    const HorizontalLabelMargin = LabelIndex === 1 ? 74 : 62;
    TacticalLabelElement.style.left = Math.round(
      THREE.MathUtils.clamp(
        ProjectedLabelX,
        HorizontalLabelMargin,
        window.innerWidth - HorizontalLabelMargin,
      ),
    ) + 'px';
    TacticalLabelElement.style.top = Math.round(
      (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
    ) + 'px';
  }
}

/** Updates the optional Arc mastery counter. */
function updateStardustCounter() {
  const CollectedStardustCount = StardustDefinitions.filter(
    (StardustDefinition) => StardustDefinition.collected,
  ).length;
  StardustCounterElement.textContent = `${CollectedStardustCount} / ${StardustDefinitions.length}`;
  StardustCounterElement.closest('.counter__mastery')?.classList.toggle(
    'is-complete',
    CollectedStardustCount === StardustDefinitions.length,
  );
}

/** Keeps the campaign objective visible without crowding the world/mastery counter. */
function updateWorldheartObjective() {
  const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
  const IsWorldheartOpen = WorldheartDefinition.routeAvailable;
  ObjectivePanelElement.classList.toggle('is-open', IsWorldheartOpen);
  ObjectiveStateElement.textContent = WorldheartDefinition.restored
    ? 'LIBERATED'
    : CurrentWorldIdentifier === WorldheartDefinition.id && ActiveHostileEncounterState
      ? 'CORE LOCKED'
    : IsWorldheartOpen
      ? 'COMMAND EXPOSED'
    : `${Math.min(RestoredWorldCount, WorldheartUnlockThreshold)} / ${WorldheartUnlockThreshold}`;
  for (let PipIndex = 0; PipIndex < ObjectivePipElements.length; PipIndex += 1) {
    ObjectivePipElements[PipIndex].classList.toggle(
      'is-filled',
      PipIndex < RestoredWorldCount,
    );
  }
}

function formatFlightTime(FlightTimeMilliseconds) {
  return `${(FlightTimeMilliseconds / 1000).toFixed(1)}s`;
}

function updateStoredPersonalBest(RunResult) {
  try {
    return savePersonalBest(window.localStorage, RunResult);
  } catch {
    return null;
  }
}

/** Finalizes the input-only replay and exposes its versioned compact payload. */
function publishFinishedReplay(Outcome) {
  ReplayState = finishReplay(ReplayState, Outcome);
  const SerializedReplay = serializeReplay(ReplayState);
  GameCanvas.dataset.replayOutcome = Outcome;
  GameCanvas.dataset.replayPayload = SerializedReplay;
  GameCanvas.dataset.replayBytes = String(SerializedReplay.length);
  if (Outcome === 'complete') {
    try {
      window.localStorage.setItem(
        getReplayStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
        SerializedReplay,
      );
    } catch {
      // Completion remains valid when private browsing or quota blocks local persistence.
    }
  }
}

function updatePersonalBestGhostVisibility() {
  const ShouldShowGhost = HasPersonalBestGhost
    && IsPersonalBestGhostEnabled
    && ReplayPlaybackState === null
    && (IsScoutMode || GamePhase === 'flying');
  if (
    PersonalBestGhostLine.visible === ShouldShowGhost
    && GameCanvas.dataset.ghostVisible === String(ShouldShowGhost)
  ) return;
  PersonalBestGhostLine.visible = ShouldShowGhost;
  GameCanvas.dataset.ghostVisible = String(ShouldShowGhost);
}

function configurePersonalBestGhost(SerializedReplay) {
  let Replay = null;
  try {
    Replay = SerializedReplay ? parseReplay(SerializedReplay) : null;
  } catch {
    Replay = null;
  }
  const MatchesActiveSystem = Replay?.systemIdentifier === ActiveSystem.id
    && Replay?.contentVersion === ActiveSystem.contentVersion;
  const Waypoints = MatchesActiveSystem ? getReplayGhostWaypoints(Replay) : [];
  HasPersonalBestGhost = Waypoints.length >= 2;

  if (HasPersonalBestGhost) {
    const Positions = new Float32Array(Waypoints.length * 3);
    Waypoints.forEach((Waypoint, WaypointIndex) => {
      Positions[WaypointIndex * 3] = Waypoint.x;
      Positions[(WaypointIndex * 3) + 1] = Waypoint.y;
      Positions[(WaypointIndex * 3) + 2] = 0.16;
    });
    PersonalBestGhostGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(Positions, 3),
    );
    PersonalBestGhostGeometry.computeBoundingSphere();
    PersonalBestGhostLine.computeLineDistances();
  } else {
    IsPersonalBestGhostEnabled = false;
  }

  GhostButtonElement.hidden = !HasPersonalBestGhost;
  GhostButtonElement.setAttribute('aria-pressed', String(IsPersonalBestGhostEnabled));
  GhostButtonElement.setAttribute(
    'aria-label',
    `Personal-best route ghost ${IsPersonalBestGhostEnabled ? 'on' : 'off'}`,
  );
  GameCanvas.dataset.ghostAvailable = String(HasPersonalBestGhost);
  GameCanvas.dataset.ghostEnabled = String(IsPersonalBestGhostEnabled);
  GameCanvas.dataset.ghostWaypointCount = String(HasPersonalBestGhost ? Waypoints.length : 0);
  updatePersonalBestGhostVisibility();
}

function replayMatchesStoredPersonalBest(SerializedReplay) {
  const Validation = validateSerializedReplay(SerializedReplay);
  const PersonalBest = loadPersonalBest(
    window.localStorage,
    ActiveSystem.id,
    ActiveSystem.contentVersion,
  );
  return Validation.valid
    && PersonalBest !== null
    && Validation.result.systemIdentifier === PersonalBest.systemIdentifier
    && Validation.result.contentVersion === PersonalBest.contentVersion
    && Validation.result.score === PersonalBest.score
    && Validation.result.launchesUsed === PersonalBest.launchesUsed
    && Validation.result.flightTimeMilliseconds === PersonalBest.flightTimeMilliseconds;
}

function loadPersonalBestGhost() {
  let SerializedGhost = null;
  try {
    const GhostStorageKey = getPersonalBestGhostStorageKey(
      ActiveSystem.id,
      ActiveSystem.contentVersion,
    );
    const StoredGhost = window.localStorage.getItem(GhostStorageKey);
    if (StoredGhost && replayMatchesStoredPersonalBest(StoredGhost)) {
      SerializedGhost = StoredGhost;
    } else {
      const LastReplay = window.localStorage.getItem(
        getReplayStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
      );
      if (LastReplay && replayMatchesStoredPersonalBest(LastReplay)) {
        SerializedGhost = LastReplay;
        window.localStorage.setItem(GhostStorageKey, LastReplay);
      }
    }
  } catch {
    // The game remains fully playable when private browsing blocks local persistence.
  }
  configurePersonalBestGhost(SerializedGhost);
}

function savePersonalBestGhost(SerializedReplay) {
  try {
    window.localStorage.setItem(
      getPersonalBestGhostStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
      SerializedReplay,
    );
  } catch {
    // A verified best still counts when local persistence is unavailable.
  }
  configurePersonalBestGhost(SerializedReplay);
}

function setPersonalBestGhostEnabled(Enabled, { announce = false } = {}) {
  IsPersonalBestGhostEnabled = Enabled && HasPersonalBestGhost;
  GhostButtonElement.setAttribute('aria-pressed', String(IsPersonalBestGhostEnabled));
  GhostButtonElement.setAttribute(
    'aria-label',
    `Personal-best route ghost ${IsPersonalBestGhostEnabled ? 'on' : 'off'}`,
  );
  GameCanvas.dataset.ghostEnabled = String(IsPersonalBestGhostEnabled);
  updatePersonalBestGhostVisibility();
  if (announce && HasPersonalBestGhost) {
    showStatusToast(`PERSONAL BEST GHOST ${IsPersonalBestGhostEnabled ? 'ON' : 'OFF'}`, 900);
  }
}

/** Populates the non-blocking completion summary from the actual run state. */
function updateVictorySummary() {
  publishFinishedReplay('complete');
  const CollectedStardustCount = StardustDefinitions.filter(
    (StardustDefinition) => StardustDefinition.collected,
  ).length;
  const Emblems = getSystemEmblems(
    WorldDefinitions,
    CollectedStardustCount,
    StardustDefinitions.length,
    true,
  );
  const EarnedEmblemCount = Object.values(Emblems).filter(Boolean).length;

  VictoryTitleElement.textContent = EarnedEmblemCount === 3
    ? ActiveSystem.completion.perfectTitle
    : ActiveSystem.completion.title;
  const CompletionBody = EarnedEmblemCount === 3
    ? ActiveSystem.completion.perfectBody
    : ActiveSystem.completion.body;
  const RunResult = createRunResult({
    systemIdentifier: ActiveSystem.id,
    contentVersion: ActiveSystem.contentVersion,
    score: ScoreState.bankedScore,
    launchesUsed: RunState.launchesUsed,
    flightTimeMilliseconds: Math.round(RunFlightTimeSeconds * 1000),
  });
  const ReplayValidation = validateSerializedReplay(GameCanvas.dataset.replayPayload);
  const IsReplayVerified = ReplayValidation.valid
    && ReplayValidation.result.score === RunResult.score
    && ReplayValidation.result.launchesUsed === RunResult.launchesUsed
    && ReplayValidation.result.flightTimeMilliseconds === RunResult.flightTimeMilliseconds
    && ReplayValidation.result.slingshotScore === ScoreState.bankedSlingshotScore
    && ReplayValidation.result.networkScore === ScoreState.networkScore
    && ReplayValidation.result.circuitScore === ScoreState.circuitScore
    && ReplayValidation.result.victoryScore === ScoreState.victoryScore;
  WatchReplayButtonElement.hidden = !IsReplayVerified;
  if (ReplayPlaybackState) {
    ReplayPlaybackState = { ...ReplayPlaybackState, status: 'complete' };
    ReplayIndicatorElement.hidden = true;
    GameCanvas.dataset.replayMode = 'complete';
  }
  GameCanvas.dataset.replayValidation = IsReplayVerified ? 'verified' : 'rejected';
  GameCanvas.dataset.replayValidatedScore = ReplayValidation.valid
    ? String(ReplayValidation.result.score)
    : '';
  const PersonalBestUpdate = IsReplayVerified ? updateStoredPersonalBest(RunResult) : null;
  if (PersonalBestUpdate?.isNewPersonalBest) {
    savePersonalBestGhost(GameCanvas.dataset.replayPayload);
  }
  const PersonalBestScore = PersonalBestUpdate?.personalBest.score ?? RunResult.score;
  PersonalBestLabelElement.textContent = !IsReplayVerified
    ? 'UNVERIFIED REPLAY · LOCAL BEST NOT UPDATED'
    : PersonalBestUpdate === null
    ? 'RANKED · LOCAL BEST UNAVAILABLE'
    : PersonalBestUpdate.isNewPersonalBest
      ? `VERIFIED · NEW PERSONAL BEST · ${RunResult.score.toLocaleString('en-GB')}`
      : `VERIFIED · PERSONAL BEST · ${PersonalBestScore.toLocaleString('en-GB')}`;
  ResultSlingshotScoreElement.textContent = ScoreState.bankedSlingshotScore.toLocaleString('en-GB');
  ResultLiberationScoreElement.textContent = ScoreState.networkScore.toLocaleString('en-GB');
  ResultCompletionBonusElement.textContent = ScoreState.victoryScore.toLocaleString('en-GB');
  ResultFlightTimeElement.textContent = formatFlightTime(RunResult.flightTimeMilliseconds);
  VictoryBodyElement.textContent = `${CompletionBody} ${RunState.launchesUsed} / ${RunState.maximumLaunches} launches · ${formatFlightTime(RunResult.flightTimeMilliseconds)} flight time.`;
  GameCanvas.dataset.personalBest = String(PersonalBestScore);
  GameCanvas.dataset.isNewPersonalBest = String(PersonalBestUpdate?.isNewPersonalBest === true);
  GameCanvas.dataset.flightTimeMilliseconds = String(RunResult.flightTimeMilliseconds);
  GameCanvas.dataset.contentVersion = ActiveSystem.contentVersion;
  GameCanvas.dataset.assistState = IsReplayVerified ? RunResult.assistState : 'unverified';

  for (const EmblemElement of EmblemElements) {
    const IsEarned = Emblems[EmblemElement.dataset.emblem] === true;
    EmblemElement.classList.toggle('is-earned', IsEarned);
    EmblemElement.setAttribute('aria-label', `${EmblemElement.dataset.emblem} ${IsEarned ? 'earned' : 'not earned'}`);
  }

  for (const ConstellationNodeElement of ConstellationNodeElements) {
    const WorldIdentifier = ConstellationNodeElement.dataset.worldId;
    const IsAwake = WorldIdentifier === WorldheartDefinition.id
      || getWorldDefinition(WorldIdentifier)?.restored === true;
    ConstellationNodeElement.classList.toggle('is-awake', IsAwake);
  }
}

/** Collects any optional stardust touched by the live fixed-step seed position. */
function collectStardustAtPosition(SeedPosition) {
  let NewlyCollectedCount = 0;
  for (const StardustDefinition of StardustDefinitions) {
    if (
      StardustDefinition.collected
      || calculateDistanceSquared(SeedPosition, StardustDefinition.position)
        > (StardustCollectionRadius * StardustCollectionRadius)
    ) {
      continue;
    }

    StardustDefinition.collected = true;
    FlightCollectedStardustIdentifiers.add(StardustDefinition.id);
    NewlyCollectedCount += 1;
  }

  if (NewlyCollectedCount === 0) {
    return;
  }

  const CollectedStardustCount = StardustDefinitions.filter(
    (StardustDefinition) => StardustDefinition.collected,
  ).length;
  updateStardustCounter();
  WorldseedSound.stardust(
    CollectedStardustCount,
    StardustDefinitions.length,
  );
  if (CollectedStardustCount === StardustDefinitions.length) {
    showStatusToast('ARC +3 · LAND TO BANK', 1200);
  } else {
    showStatusToast(
      `STARDUST ${CollectedStardustCount} / ${StardustDefinitions.length}`,
      620,
    );
  }
}

/** Commits pickups only when the current shot reaches a valid landing. */
function commitFlightStardust() {
  FlightCollectedStardustIdentifiers.clear();
}

/** Restores pickups touched during a failed flight so Arc mastery requires survival. */
function rollbackFlightStardust() {
  if (FlightCollectedStardustIdentifiers.size === 0) {
    return;
  }
  rollbackFlightPickups(StardustDefinitions, FlightCollectedStardustIdentifiers);
  FlightCollectedStardustIdentifiers.clear();
  updateStardustCounter();
}

/** Animates uncollected motes and brightens those intersected by the current prediction. */
function updateStardustVisuals(ElapsedTimeSeconds) {
  const ShouldShowStardust = ![
    'restoring',
    'victoryPending',
    'victory',
  ].includes(GamePhase);
  let HasVisibleStardust = false;

  for (let StardustIndex = 0; StardustIndex < StardustDefinitions.length; StardustIndex += 1) {
    const StardustDefinition = StardustDefinitions[StardustIndex];
    const IsPredictedPickup = PredictedStardustIdentifiers.has(StardustDefinition.id);
    const PulseScale = 0.9 + (Math.sin(
      (ElapsedTimeSeconds * 5.2) + (StardustIndex * 1.7),
    ) * 0.14);
    const StardustScale = StardustDefinition.collected
      ? 0
      : PulseScale * (IsPredictedPickup ? 1.55 : 1);
    HasVisibleStardust ||= !StardustDefinition.collected;

    StardustTransform.position.set(
      StardustDefinition.position.x,
      StardustDefinition.position.y,
      0.24,
    );
    StardustTransform.rotation.set(
      ElapsedTimeSeconds * (0.8 + (StardustIndex * 0.12)),
      ElapsedTimeSeconds * (1.1 + (StardustIndex * 0.09)),
      ElapsedTimeSeconds * 0.7,
    );
    StardustTransform.scale.setScalar(StardustScale);
    StardustTransform.updateMatrix();
    StardustMesh.setMatrixAt(StardustIndex, StardustTransform.matrix);
    StardustMesh.setColorAt(
      StardustIndex,
      IsPredictedPickup ? StardustPredictedColor : StardustBaseColor,
    );
  }

  StardustMesh.instanceMatrix.needsUpdate = true;
  StardustMesh.instanceColor.needsUpdate = true;
  StardustMesh.visible = ShouldShowStardust && HasVisibleStardust;
}

/**
 * Computes a stable resting point on a world's surface.
 *
 * @param {object} WorldDefinition - World being landed on.
 * @param {{x:number,y:number,z:number}} ImpactPosition - Approximate collision position.
 * @returns {{x:number,y:number,z:number}} Snapped seed position on the surface.
 */
function calculateSurfaceRestPosition(WorldDefinition, ImpactPosition) {
  TemporaryThreeVector.set(
    ImpactPosition.x - WorldDefinition.position.x,
    ImpactPosition.y - WorldDefinition.position.y,
    0,
  );

  if (TemporaryThreeVector.lengthSq() < 0.0001) {
    TemporaryThreeVector.set(1, 0, 0);
  }

  TemporaryThreeVector.normalize().multiplyScalar(WorldDefinition.radius + SeedRadius + 0.03);

  return createVector(
    WorldDefinition.position.x + TemporaryThreeVector.x,
    WorldDefinition.position.y + TemporaryThreeVector.y,
    0,
  );
}

function getCurrentAttachedWorld() {
  if (GamePhase !== 'attached') return null;
  return CurrentWorldIdentifier === WorldheartDefinition.id
    ? WorldheartDefinition
    : getWorldDefinition(CurrentWorldIdentifier);
}

function getRunnerSurfaceAngle(WorldDefinition) {
  return Math.atan2(
    SeedPhysicsState.position.y - WorldDefinition.position.y,
    SeedPhysicsState.position.x - WorldDefinition.position.x,
  );
}

function publishHostileEncounterState() {
  const AttachedWorld = getCurrentAttachedWorld();
  const RunnerSurfaceAngle = AttachedWorld
    ? getRunnerSurfaceAngle(AttachedWorld)
    : 0;
  const PulseReady = Boolean(
    ActiveHostileEncounterState
    && isHostilePulseReady(ActiveHostileEncounterState, RunnerSurfaceAngle)
  );
  GameCanvas.dataset.hostileEncounter = ActiveHostileEncounterState?.worldIdentifier ?? '';
  GameCanvas.dataset.hostilePulseReady = String(PulseReady);
  GameCanvas.dataset.hostilePylonAngle = ActiveHostileEncounterState
    ? ActiveHostileEncounterState.pylonSurfaceAngle.toFixed(4)
    : '';
  return PulseReady;
}

function showHostileEncounterInstruction() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState) return false;
  const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
  if (isHostilePulseReady(ActiveHostileEncounterState, RunnerSurfaceAngle)) {
    showInstruction(
      AttachedWorld.kind === 'worldheart' ? 'Command core in range.' : 'Pylon in range.',
      'Press Space or tap BREAKER PULSE to disable the barrier without spending a launch.',
    );
  } else {
    const DistanceDegrees = Math.round(THREE.MathUtils.radToDeg(
      getHostileEncounterAngularDistance(ActiveHostileEncounterState, RunnerSurfaceAngle),
    ));
    showInstruction(
      AttachedWorld.kind === 'worldheart'
        ? 'Circle the moving Command World.'
        : `${AttachedWorld.label} blocks the relay.`,
      `Walk the rim with Q/E or trace toward the red pylons · ${DistanceDegrees}° away.`,
    );
  }
  return true;
}

function beginHostileEncounter(WorldDefinition) {
  if (
    !WorldDefinition.hostileEncounter
    || CompletedHostileEncounterWorldIdentifiers.has(WorldDefinition.id)
  ) {
    return false;
  }
  ActiveHostileEncounterState = createHostileEncounterState({
    worldIdentifier: WorldDefinition.id,
    runnerSurfaceAngle: getRunnerSurfaceAngle(WorldDefinition),
    ...WorldDefinition.hostileEncounter,
  });
  IsKeyboardAiming = false;
  IsPointerAiming = false;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  clearTrajectoryPreview();
  positionHostilePylons(
    WorldDefinition,
    ActiveHostileEncounterState.pylonSurfaceAngle,
  );
  publishHostileEncounterState();
  updateBreakerBurnInterface();
  showHostileEncounterInstruction();
  return true;
}

/** Repositions the Runner around a world's playable great-circle without spending a launch. */
function setRunnerSurfaceAngle(AngleRadians, InputKind = 'pointer') {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || ReplayPlaybackState !== null) return false;
  const SurfacePosition = getSurfacePosition(
    AttachedWorld.position,
    AttachedWorld.radius + SeedRadius + 0.03,
    AngleRadians,
  );
  SeedPhysicsState.position = createVector(
    SurfacePosition.x,
    SurfacePosition.y,
    SurfacePosition.z,
  );
  SeedPhysicsState.velocity = createVector();
  SeedGroup.position.set(SurfacePosition.x, SurfacePosition.y, SurfacePosition.z);
  LastSafeWorldIdentifier = CurrentWorldIdentifier;
  LastSafeSeedPosition = createVector(SurfacePosition.x, SurfacePosition.y, SurfacePosition.z);
  if (CurrentWorldIdentifier === WorldheartDefinition.id) {
    AttachedWorldheartSurfaceAngle = AngleRadians;
  }
  publishAttachedSeedState(CurrentWorldIdentifier, SurfacePosition);
  GameCanvas.dataset.surfaceAngle = AngleRadians.toFixed(4);
  GameCanvas.dataset.surfaceInput = InputKind;
  if (ActiveHostileEncounterState) {
    publishHostileEncounterState();
    updateBreakerBurnInterface();
    showHostileEncounterInstruction();
  }
  return true;
}

function moveRunnerAroundSurface(Direction, Fine = false) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld) return false;
  const CurrentAngle = Math.atan2(
    SeedPhysicsState.position.y - AttachedWorld.position.y,
    SeedPhysicsState.position.x - AttachedWorld.position.x,
  );
  return setRunnerSurfaceAngle(
    adjustSurfaceAngle(CurrentAngle, Direction, { fine: Fine }),
    'keyboard',
  );
}

/**
 * Updates the HUD counter using only restorable worlds. The starting world is already alive
 * so it acts as the player's launch platform rather than as an objective.
 */
function updateWorldCounter() {
  const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
  WorldCounterElement.textContent = `${RestoredWorldCount} / ${RestorableWorldCount}`;
}

/** Keeps the optional remaining-launch victory bonus visible and machine-readable. */
function updateLaunchCounter() {
  LaunchCounterElement.textContent = `${RunState.remainingLaunches} / ${RunState.maximumLaunches}`;
  CounterElement.classList.toggle(
    'is-low',
    RunState.remainingLaunches > 0 && RunState.remainingLaunches <= 2,
  );
  CounterElement.classList.toggle('is-empty', RunState.remainingLaunches === 0);
  GameCanvas.dataset.launchesRemaining = String(RunState.remainingLaunches);
  GameCanvas.dataset.launchesUsed = String(RunState.launchesUsed);
  GameCanvas.dataset.runStatus = RunState.status;
}

/** Keeps banked points and the current at-risk chain visible throughout a run. */
function updateScoreInterface() {
  ScoreCounterElement.textContent = ScoreState.bankedScore.toLocaleString('en-GB');
  FlightScoreValueElement.textContent = `+${ScoreState.flightScore.toLocaleString('en-GB')}`;
  ChainValueElement.textContent = `CHAIN ×${Math.max(1, Math.min(ScoreState.chainCount, 4))}`;
  FlightScoreElement.hidden = ScoreState.flightScore === 0;
  GameCanvas.dataset.score = String(ScoreState.bankedScore);
  GameCanvas.dataset.flightScore = String(ScoreState.flightScore);
  GameCanvas.dataset.chainCount = String(ScoreState.chainCount);
  GameCanvas.dataset.networkScore = String(ScoreState.networkScore);
  GameCanvas.dataset.victoryScore = String(ScoreState.victoryScore);
}

/**
 * Displays a short centre-screen status message without queueing old messages.
 *
 * @param {string} Message - Text shown to the player.
 * @param {number} VisibleDurationMilliseconds - Duration before the toast fades.
 */
function showStatusToast(Message, VisibleDurationMilliseconds = 900, Tone = 'status') {
  if (StatusToastTimeoutIdentifier !== null) {
    window.clearTimeout(StatusToastTimeoutIdentifier);
  }

  StatusToastElement.textContent = Message;
  StatusToastElement.classList.toggle('is-memory', Tone === 'memory');
  StatusToastElement.classList.add('is-visible');

  StatusToastTimeoutIdentifier = window.setTimeout(() => {
    StatusToastElement.classList.remove('is-visible');
    StatusToastTimeoutIdentifier = null;
  }, VisibleDurationMilliseconds);
}

/**
 * Sets instruction copy and reveals the helper panel.
 *
 * @param {string} Title - Strong instruction line.
 * @param {string} Body - Supporting instruction line.
 */
function showInstruction(Title, Body) {
  InstructionTitleElement.textContent = Title;
  InstructionBodyElement.textContent = Body;
  InstructionPanelElement.classList.remove('is-hidden');
  InstructionPanelElement.setAttribute('aria-hidden', 'false');
}

/** Ends a caught attempt after a brief, readable failure beat. */
function scheduleRunFailure(Reason = 'THE WARDEN REACHED THE RUNNER') {
  if (GamePhase === 'runFailed' || RunState.status !== 'failed') {
    return;
  }

  publishFinishedReplay('failed');
  GamePhase = 'runFailed';
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  GameCanvas.dataset.runStatus = 'failed';
  SeedPhysicsState.velocity = createVector();
  WorldseedSound.failure();
  showStatusToast('RUN LOST · WARDEN ARRIVED', 1200);
  showInstruction('The Stillness closes in', `${Reason}. The system will reset.`);

  if (RunFailureTimeoutIdentifier !== null) {
    window.clearTimeout(RunFailureTimeoutIdentifier);
  }
  RunFailureTimeoutIdentifier = window.setTimeout(() => {
    RunFailureTimeoutIdentifier = null;
    resetGame();
  }, 1350);
}

/** Settles a non-command landing before applying its one deterministic pursuit beat. */
function settleNonCommandFlight({ firstCircuitClosed = false, circuit = null } = {}) {
  RunState = settleRunFlight(RunState);
  updateLaunchCounter();
  resolveWardenAfterResolvedFlight({ firstCircuitClosed, circuit });
}

/** Clears per-shot telemetry after a landing, failure or reset. */
function resetFlightFeedback() {
  FlightOriginWorldIdentifier = null;
  FlightHadAsteroidClosePass = false;
  FlightClosePassWorldIdentifiers.clear();
}

function bankCurrentFlight(LandingBonus = 0) {
  const BankResult = bankFlightScore(ScoreState, { landingBonus: LandingBonus });
  GameCanvas.dataset.lastBank = String(BankResult.bankedPoints);
  updateScoreInterface();
  return BankResult;
}

function loseCurrentFlightScore() {
  const LostPoints = rollbackFlightScore(ScoreState);
  GameCanvas.dataset.lastScoreLost = String(LostPoints);
  updateScoreInterface();
  return LostPoints;
}

/** Returns the best accolade earned during the current successful flight. */
function getCurrentLandingAccolade(LandingWorldIdentifier, IsNewWorldLanding) {
  return getLandingAccolade({
    hadAsteroidClosePass: FlightHadAsteroidClosePass,
    closePassWorldIdentifiers: FlightClosePassWorldIdentifiers,
    landingWorldIdentifier: LandingWorldIdentifier,
    isNewWorldLanding: IsNewWorldLanding,
  });
}

/** Samples Wayfarer clearance directly from its authored orbit without allocating vectors. */
function getAsteroidSurfaceClearance() {
  const OrbitAngle = AsteroidDefinition.orbit.phaseRadians
    + (PhysicsElapsedTimeSeconds * AsteroidDefinition.orbit.angularSpeedRadiansPerSecond);
  const AsteroidPositionX = AsteroidDefinition.orbit.centre.x
    + (Math.cos(OrbitAngle) * AsteroidDefinition.orbit.radius);
  const AsteroidPositionY = AsteroidDefinition.orbit.centre.y
    + (Math.sin(OrbitAngle) * AsteroidDefinition.orbit.radius);
  return Math.hypot(
    SeedPhysicsState.position.x - AsteroidPositionX,
    SeedPhysicsState.position.y - AsteroidPositionY,
  ) - AsteroidDefinition.radius - SeedRadius;
}

/** Records deterministic world and asteroid flybys from the live fixed-step position. */
function updateFlightFeedback() {
  for (const WorldDefinition of WorldDefinitions) {
    if (WorldDefinition.id === FlightOriginWorldIdentifier) {
      continue;
    }
    const CentreDistance = Math.sqrt(calculateDistanceSquared(
      SeedPhysicsState.position,
      WorldDefinition.position,
    ));
    const SurfaceClearance = CentreDistance - WorldDefinition.radius - SeedRadius;
    if (SurfaceClearance > 0 && SurfaceClearance <= WorldClosePassClearance) {
      FlightClosePassWorldIdentifiers.add(WorldDefinition.id);
    }
  }

  const AsteroidSurfaceClearance = getAsteroidSurfaceClearance();
  if (
    AsteroidSurfaceClearance > 0
    && AsteroidSurfaceClearance <= AsteroidClosePassClearance
  ) {
    FlightHadAsteroidClosePass = true;
  }
}

/** Hides the helper once a launch is in progress. */
function hideInstruction() {
  InstructionPanelElement.classList.add('is-hidden');
  InstructionPanelElement.setAttribute('aria-hidden', 'true');
}

/**
 * Starts the lightweight greybox restoration animation and marks objective state.
 *
 * @param {object} WorldDefinition - World that has just been awakened.
 * @param {{x:number,y:number,z:number}} ImpactPosition - World-space landing point.
 */
function restoreWorld(WorldDefinition, ImpactPosition) {
  if (WorldDefinition.restored) {
    return;
  }

  WorldDefinition.restored = true;
  const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
  GamePhase = 'restoring';
  WorldRuntime.group.updateWorldMatrix(true, false);
  WorldRuntime.restorationOriginLocal.copy(
    WorldRuntime.group.worldToLocal(new THREE.Vector3(
      ImpactPosition.x,
      ImpactPosition.y,
      ImpactPosition.z,
    )),
  ).normalize();
  WorldRuntime.restorationUniforms.restorationOrigin.value.copy(
    WorldRuntime.restorationOriginLocal,
  );
  WorldRuntime.restorationUniforms.restorationProgress.value = -0.025;
  WorldRuntime.restorationStartedAtSeconds = GameElapsedTimeSeconds;
  WorldRuntime.restorationWaveMesh.visible = true;
  WorldRuntime.contourRingGroup.visible = true;
  RouteLabelProjection.set(ImpactPosition.x, ImpactPosition.y, ImpactPosition.z).project(Camera);
  LiberationFlashElement.style.setProperty(
    '--liberation-x',
    `${THREE.MathUtils.clamp((RouteLabelProjection.x * 0.5 + 0.5) * 100, 0, 100)}%`,
  );
  LiberationFlashElement.style.setProperty(
    '--liberation-y',
    `${THREE.MathUtils.clamp((-RouteLabelProjection.y * 0.5 + 0.5) * 100, 0, 100)}%`,
  );
  LiberationFlashLifeSeconds = 0.72;
  CameraImpactLifeSeconds = Math.max(CameraImpactLifeSeconds, 0.34);

  for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
    SurfacePropObject.userData.restorationDistance = calculateNormalizedSphericalDistance(
      WorldRuntime.restorationOriginLocal,
      SurfacePropObject.userData.surfaceDirection,
    );
    SurfacePropObject.scale.setScalar(SurfacePropObject.userData.baseScale * 0.05);
    setSurfacePropRestorationProgress(SurfacePropObject, 0);
  }

  updateWorldCounter();
  const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
  updateCommandWorldAvailability();
  updateWorldheartObjective();
  WorldseedSound.restore(WorldDefinition.id, RestoredWorldCount);
  showStatusToast(`CONTROL SIGNAL BREAKING · ${WorldDefinition.label}`, 1450);
}

/** Returns an exposed relay world to its occupied presentation without erasing its route history. */
function suppressWorld(WorldDefinition) {
  if (!WorldDefinition.restored) {
    return false;
  }

  WorldDefinition.restored = false;
  const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
  WorldRuntime.restorationStartedAtSeconds = null;
  WorldRuntime.restorationCompleted = false;
  WorldRuntime.restorationUniforms.restorationProgress.value = -0.1;
  WorldRuntime.restorationWaveMesh.visible = false;
  WorldRuntime.atmosphereMaterial.opacity = 0.025;
  WorldRuntime.atmosphereMesh.scale.setScalar(0.96);
  WorldRuntime.contourRingGroup.visible = false;
  const StillnessPresentation = getStillnessPresentation(false);
  WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
  WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
  WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
  WorldRuntime.group.scale.setScalar(1);
  if (WorldRuntime.ambientMoteGroup) {
    WorldRuntime.ambientMoteGroup.material.opacity = 0;
  }
  for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
    setSurfacePropRestorationProgress(SurfacePropObject, 0);
    SurfacePropObject.scale.setScalar(SurfacePropObject.userData.baseScale * 0.05);
  }
  updateWorldCounter();
  updateWorldheartObjective();
  updateScannerInterface();
  return true;
}

/**
 * Places the seed on a world and returns control to the player.
 *
 * @param {object} WorldDefinition - World that received the seed.
 * @param {{x:number,y:number,z:number}} ImpactPosition - Approximate impact position.
 */
function attachSeedToWorld(WorldDefinition, ImpactPosition) {
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  const LandingOriginWorldIdentifier = FlightOriginWorldIdentifier;
  const SurfaceRestPosition = calculateSurfaceRestPosition(WorldDefinition, ImpactPosition);

  ImpactPulseMesh.material.color.set(0xfff2bc);
  ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.22);
  ImpactPulseMesh.scale.setScalar(1);
  ImpactPulseMesh.visible = true;
  ImpactPulseLifeSeconds = 0.58;
  CameraImpactLifeSeconds = 0.24;
  WorldseedSound.impact(WorldDefinition.id);

  SeedPhysicsState = {
    position: SurfaceRestPosition,
    velocity: createVector(),
  };
  SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);

  CurrentWorldIdentifier = WorldDefinition.id;
  publishAttachedSeedState(CurrentWorldIdentifier, SurfaceRestPosition);
  LastSafeWorldIdentifier = WorldDefinition.id;
  LastSafeSeedPosition = createVector(
    SurfaceRestPosition.x,
    SurfaceRestPosition.y,
    SurfaceRestPosition.z,
  );
  LaunchIgnoredWorldIdentifier = null;

  const WasAlreadyRestored = WorldDefinition.restored;
  const WasSuppressed = RelayNetworkState.suppressedWorldIdentifiers.has(WorldDefinition.id);
  const LandingAccolade = getCurrentLandingAccolade(
    WorldDefinition.id,
    !WasAlreadyRestored && !WasSuppressed,
  );
  const BankResult = bankCurrentFlight(
    WasAlreadyRestored || WasSuppressed ? 0 : (WorldDefinition.liberationValue ?? 1000),
  );
  const RelayConnection = LandingOriginWorldIdentifier
    && LandingOriginWorldIdentifier !== WorldDefinition.id
    ? connectRelayWorlds(
      RelayNetworkState,
      LandingOriginWorldIdentifier,
      WorldDefinition.id,
    )
    : null;
  const CircuitBonus = RelayConnection?.circuitClosed
    ? addCircuitBonus(ScoreState, ActiveSystem.circuitBonusValue)
    : 0;
  const TotalBankedPoints = BankResult.bankedPoints + CircuitBonus;
  if (CircuitBonus > 0) {
    GameCanvas.dataset.lastCircuitBonus = String(CircuitBonus);
    updateScoreInterface();
  }
  if (RelayConnection?.created || RelayConnection?.destinationReactivated) {
    synchronizeRelayNetworkVisuals();
  }
  GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
  commitFlightStardust();
  resetFlightFeedback();
  restoreWorld(WorldDefinition, ImpactPosition);

  if (GamePhase === 'restoring') {
    const AnswerLine = RelayNetworkState.links.size === 1
      ? '“Is someone there?”'
      : (RelayNetworkState.links.size === 2
        ? '“We thought we were alone.”'
        : WorldDefinition.memory);
    showInstruction(
      RelayConnection?.destinationReactivated
        ? `Signal restored: ${WorldDefinition.label}`
        : RelayConnection?.created
        ? `Relay linked: ${getWorldDefinition(LandingOriginWorldIdentifier).label} ↔ ${WorldDefinition.label}`
        : `Life is racing around ${WorldDefinition.label}`,
      RelayConnection?.destinationReactivated
        ? 'The original route and courier are live again.'
        : RelayConnection?.created ? AnswerLine : WorldDefinition.memory,
    );
    if (LandingAccolade) {
      showStatusToast(
        `${LandingAccolade} · +${TotalBankedPoints.toLocaleString('en-GB')} BANKED`,
        1450,
      );
    }
  } else if (WasAlreadyRestored && GamePhase !== 'victory' && GamePhase !== 'victoryPending') {
    GamePhase = 'attached';
    showStatusToast(
      TotalBankedPoints > 0
        ? `+${TotalBankedPoints.toLocaleString('en-GB')} BANKED`
        : (LandingAccolade ?? 'CLEAN LANDING'),
      850,
    );
    showRouteChoiceInstruction();
  }
  settleNonCommandFlight({
    firstCircuitClosed: RelayConnection?.circuitClosed === true,
    circuit: RelayConnection?.circuit ?? null,
  });
  updateBreakerBurnInterface();
}

/** Lands on the one-use launch node without counting it as an awakened world. */
function attachSeedToSeedstone(ImpactPosition, BodyPosition) {
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  SeedstoneDefinition.position.x = BodyPosition.x;
  SeedstoneDefinition.position.y = BodyPosition.y;
  SeedstoneDefinition.position.z = BodyPosition.z;
  const LandingAccolade = getCurrentLandingAccolade(SeedstoneDefinition.id, true);
  const SurfaceRestPosition = calculateSurfaceRestPosition(SeedstoneDefinition, ImpactPosition);
  AttachedSeedstoneSurfaceOffset = createVector(
    SurfaceRestPosition.x - BodyPosition.x,
    SurfaceRestPosition.y - BodyPosition.y,
    SurfaceRestPosition.z - BodyPosition.z,
  );

  ImpactPulseMesh.material.color.set(0x72d9ff);
  ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.22);
  ImpactPulseMesh.scale.setScalar(1);
  ImpactPulseMesh.visible = true;
  ImpactPulseLifeSeconds = 0.58;
  CameraImpactLifeSeconds = 0.18;
  WorldseedSound.impact('seedstone');

  SeedPhysicsState = {
    position: SurfaceRestPosition,
    velocity: createVector(),
  };
  SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);
  CurrentWorldIdentifier = SeedstoneDefinition.id;
  publishAttachedSeedState(CurrentWorldIdentifier, SurfaceRestPosition);
  LaunchIgnoredWorldIdentifier = null;
  LaunchIgnoredBodyIdentifier = null;
  GamePhase = 'attached';
  GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
  const BankResult = bankCurrentFlight();
  commitFlightStardust();
  resetFlightFeedback();
  showStatusToast(BankResult.bankedPoints > 0
    ? `+${BankResult.bankedPoints.toLocaleString('en-GB')} BANKED · ${SeedstoneDefinition.label}`
    : (LandingAccolade
      ? `${LandingAccolade} · ${SeedstoneDefinition.label} READY`
      : `${SeedstoneDefinition.label} READY · 1 LAUNCH`), 1100);
  showInstruction(
    SeedstoneDefinition.orbit ? 'Moving launch window' : 'Temporary launchpad',
    SeedstoneDefinition.orbit
      ? `Ride ${SeedstoneDefinition.label} into position, then launch before it crumbles.`
      : `Choose the next world carefully — ${SeedstoneDefinition.label} crumbles after launch.`,
  );
  settleNonCommandFlight();
  updateBreakerBurnInterface();
}

/** Reveals the modal completion summary and moves keyboard focus into it. */
function revealVictoryPanel() {
  VictoryPanelElement.hidden = false;
  ReplayButtonElement.focus({ preventScroll: true });
}

/** Completes the command landing only after its surface lattice receives a Breaker Pulse. */
function completeWorldheartLiberation() {
  if (WorldheartDefinition.restored) return false;
  CompletedHostileEncounterWorldIdentifiers.add(WorldheartDefinition.id);
  ActiveHostileEncounterState = null;
  HostilePylonGroup.visible = false;
  publishHostileEncounterState();
  WorldheartDefinition.restored = true;
  const CompletionBonus = addVictoryBonus(
    ScoreState,
    WardenPursuitState.distance,
    ActiveSystem.wardenVictoryValuePerStep,
  );
  updateScoreInterface();
  GameCanvas.dataset.completionBonus = String(CompletionBonus);
  GameCanvas.dataset.commandPulse = 'fired';
  CommandDefeatStartedAtSeconds = GameElapsedTimeSeconds;
  startWardenEventPulse(WorldheartDefinition.position, 0x72d9ff, 'defeat');
  GamePhase = 'victoryPending';
  updateWorldheartObjective();
  updateVictorySummary();
  hideInstruction();
  beginFinaleRestoration();
  if (IsCampaignFinale) {
    showStatusToast('THE WORLDHEART IS AWAKENING', 2200, 'memory');
  } else {
    showStatusToast(
      `COMMAND BROKEN · +${(PendingWorldheartBankedPoints + CompletionBonus).toLocaleString('en-GB')} BANKED`,
      1600,
    );
  }

  const VictoryDelaySeconds = PrefersReducedMotion
    ? 0.85
    : ActiveSystem.finale?.victoryDelaySeconds ?? 1.35;
  WorldheartCompletionTimeoutIdentifier = window.setTimeout(() => {
    revealVictoryPanel();
    GamePhase = 'victory';
    WorldseedSound.victory();
    WorldheartCompletionTimeoutIdentifier = null;
  }, VictoryDelaySeconds * 1000);
  updateBreakerBurnInterface();
  return true;
}

/** Lands on the exposed mobile command body and starts its final surface approach. */
function attachSeedToWorldheart(ImpactPosition, BodyPosition) {
  if (!WorldheartDefinition.routeAvailable || WorldheartDefinition.restored) {
    return;
  }
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  WorldheartDefinition.position.x = BodyPosition.x;
  WorldheartDefinition.position.y = BodyPosition.y;
  WorldheartDefinition.position.z = BodyPosition.z;

  const SurfaceRestPosition = calculateSurfaceRestPosition(WorldheartDefinition, ImpactPosition);
  const LandingAccolade = getCurrentLandingAccolade(WorldheartDefinition.id, true);
  ImpactPulseMesh.material.color.set(0xffd678);
  ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.24);
  ImpactPulseMesh.scale.setScalar(1.2);
  ImpactPulseMesh.visible = true;
  ImpactPulseLifeSeconds = 0.58;
  CameraImpactLifeSeconds = 0.24;
  WorldseedSound.impact('worldheart');

  SeedPhysicsState = { position: SurfaceRestPosition, velocity: createVector() };
  SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);
  CurrentWorldIdentifier = WorldheartDefinition.id;
  publishAttachedSeedState(CurrentWorldIdentifier, SurfaceRestPosition);
  AttachedWorldheartSurfaceAngle = getRunnerSurfaceAngle(WorldheartDefinition);
  RunState = settleRunFlight(RunState, { reachedCommandWorld: true });
  updateLaunchCounter();
  const BankResult = bankCurrentFlight();
  PendingWorldheartBankedPoints = BankResult.bankedPoints;
  GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
  GameCanvas.dataset.commandPulse = 'required';
  commitFlightStardust();
  resetFlightFeedback();
  GamePhase = 'attached';
  updateWorldheartObjective();
  const HasSurfaceApproach = beginHostileEncounter(WorldheartDefinition);
  if (ReplayPlaybackState !== null || !HasSurfaceApproach) {
    completeWorldheartLiberation();
  } else {
    showStatusToast('COMMAND LANDED · CORE LATTICE ACTIVE', 1500);
  }
  updateBreakerBurnInterface();
}

/** Starts the final system-scale pulse only after the seed physically lands in the core. */
function beginFinaleRestoration() {
  FinaleRestorationStartedAtSeconds = GameElapsedTimeSeconds;
  FinaleCoreMesh.position.set(
    WorldheartDefinition.position.x,
    WorldheartDefinition.position.y,
    0.1,
  );
  FinaleCoreMesh.visible = true;
  FinaleLinkMesh.visible = true;
  FinalePulseMesh.visible = true;
  FinaleSparkMesh.visible = true;
  FinaleLinkMaterial.opacity = 0;
  FinalePulseMaterial.opacity = 0;
  FinaleSparkMaterial.opacity = 0;
  GameCanvas.dataset.finaleRestoration = 'active';
}

/**
 * Sends the living pulse back through every restored route before revealing the final summary.
 * This is presentation-only; physics and campaign state are already settled at impact.
 */
function updateFinaleRestorationVisuals(ElapsedTimeSeconds) {
  if (FinaleRestorationStartedAtSeconds === null) {
    return;
  }

  const FinaleDurationSeconds = ActiveSystem.finale?.victoryDelaySeconds ?? 1.35;
  const FinaleElapsedSeconds = PrefersReducedMotion
    ? FinaleDurationSeconds
    : Math.min(
      FinaleDurationSeconds,
      Math.max(0, ElapsedTimeSeconds - FinaleRestorationStartedAtSeconds),
    );
  const FinaleProgress = THREE.MathUtils.smoothstep(
    FinaleElapsedSeconds / FinaleDurationSeconds,
    0,
    1,
  );
  const PulseArrivalProgress = THREE.MathUtils.smoothstep(
    FinaleElapsedSeconds,
    IsCampaignFinale ? 0.18 : 0.08,
    IsCampaignFinale ? 2.25 : 0.82,
  );

  FinaleCoreMesh.position.set(
    WorldheartDefinition.position.x,
    WorldheartDefinition.position.y,
    0.1,
  );
  FinaleCoreMesh.rotation.x = FinaleElapsedSeconds * 0.38;
  FinaleCoreMesh.rotation.y = FinaleElapsedSeconds * 0.62;
  FinaleCoreMesh.scale.setScalar(
    1 + (Math.sin(FinaleElapsedSeconds * 4.2) * 0.08) + (FinaleProgress * 0.18),
  );
  FinaleCoreMaterial.emissiveIntensity = 2.4 + (PulseArrivalProgress * 2.2);

  let LinkValueOffset = 0;
  WorldDefinitions.forEach((WorldDefinition, WorldIndex) => {
    const WorldPulseProgress = WorldDefinition.restored
      ? THREE.MathUtils.smoothstep(
        FinaleElapsedSeconds,
        IsCampaignFinale ? 0.2 + (WorldIndex * 0.12) : 0.08 + (WorldIndex * 0.045),
        IsCampaignFinale ? 1.35 + (WorldIndex * 0.12) : 0.62 + (WorldIndex * 0.1),
      )
      : 0;
    FinaleLinkPositionValues[LinkValueOffset] = WorldheartDefinition.position.x;
    FinaleLinkPositionValues[LinkValueOffset + 1] = WorldheartDefinition.position.y;
    FinaleLinkPositionValues[LinkValueOffset + 2] = 0.04;
    FinaleLinkPositionValues[LinkValueOffset + 3] = THREE.MathUtils.lerp(
      WorldheartDefinition.position.x,
      WorldDefinition.position.x,
      WorldPulseProgress,
    );
    FinaleLinkPositionValues[LinkValueOffset + 4] = THREE.MathUtils.lerp(
      WorldheartDefinition.position.y,
      WorldDefinition.position.y,
      WorldPulseProgress,
    );
    FinaleLinkPositionValues[LinkValueOffset + 5] = 0.04;
    LinkValueOffset += 6;
  });
  FinaleLinkPositionAttribute.needsUpdate = true;
  FinaleLinkMaterial.opacity = 0.12 + (PulseArrivalProgress * 0.54);

  for (let PulseIndex = 0; PulseIndex < FinalePulseCount; PulseIndex += 1) {
    const PulseElapsedSeconds = FinaleElapsedSeconds - (PulseIndex * 0.34);
    const IsPulseActive = PulseElapsedSeconds >= 0;
    const PulseScale = IsPulseActive
      ? WorldheartDefinition.radius * (1.2 + (PulseElapsedSeconds * 2.8))
      : 0.001;
    FinalePulseTransform.position.set(
      WorldheartDefinition.position.x,
      WorldheartDefinition.position.y,
      0.02 + (PulseIndex * 0.004),
    );
    FinalePulseTransform.rotation.set(0, 0, PulseIndex * 0.3);
    FinalePulseTransform.scale.setScalar(PulseScale);
    FinalePulseTransform.updateMatrix();
    FinalePulseMesh.setMatrixAt(PulseIndex, FinalePulseTransform.matrix);
  }
  FinalePulseMesh.instanceMatrix.needsUpdate = true;
  FinalePulseMaterial.opacity = 0.46 * (1 - (FinaleProgress * 0.45));

  for (let SparkIndex = 0; SparkIndex < FinaleSparkCount; SparkIndex += 1) {
    const SparkFraction = SparkIndex / FinaleSparkCount;
    const SparkAngle = (SparkIndex * 2.399963) + (FinaleElapsedSeconds * 0.18);
    const SparkRadius = WorldheartDefinition.radius
      + (PulseArrivalProgress * (1.4 + (SparkFraction * 8.6)));
    FinaleSparkTransform.position.set(
      WorldheartDefinition.position.x + (Math.cos(SparkAngle) * SparkRadius),
      WorldheartDefinition.position.y + (Math.sin(SparkAngle) * SparkRadius),
      -0.3 + ((SparkIndex % 9) * 0.08),
    );
    FinaleSparkTransform.rotation.set(
      SparkAngle * 0.5,
      SparkAngle * 0.32,
      SparkAngle,
    );
    FinaleSparkTransform.scale.setScalar(
      (0.42 + ((SparkIndex % 5) * 0.09)) * PulseArrivalProgress,
    );
    FinaleSparkTransform.updateMatrix();
    FinaleSparkMesh.setMatrixAt(SparkIndex, FinaleSparkTransform.matrix);
  }
  FinaleSparkMesh.instanceMatrix.needsUpdate = true;
  FinaleSparkMaterial.opacity = 0.28 + (PulseArrivalProgress * 0.62);

  Scene.background.copy(InitialSceneBackgroundColor).lerp(
    ActiveSystem.finale?.awakenedBackgroundColor ?? InitialSceneBackgroundColor,
    FinaleProgress,
  );
  Renderer.toneMappingExposure = ActiveSystem.environment.toneMappingExposure
    + (Math.sin(FinaleProgress * Math.PI) * 0.22)
    + (FinaleProgress * 0.08);
  if (FinaleProgress >= 1) {
    GameCanvas.dataset.finaleRestoration = 'complete';
  }
}

/**
 * Emits one pooled trail particle at the current seed position.
 */
function emitTrailParticle() {
  const TrailParticle = TrailParticlePool[NextTrailParticleIndex];
  NextTrailParticleIndex = (NextTrailParticleIndex + 1) % TrailParticlePool.length;

  TrailParticle.position.copy(SeedGroup.position);
  TrailParticle.lifeRemainingSeconds = TrailParticle.maximumLifeSeconds;
  updateTrailParticleInstance(TrailParticle, 0.78);
  TrailParticleMesh.instanceMatrix.needsUpdate = true;
}

/**
 * Advances trail fade and scale animation.
 *
 * @param {number} DeltaTimeSeconds - Real frame delta.
 */
function updateTrailParticles(DeltaTimeSeconds) {
  for (const TrailParticle of TrailParticlePool) {
    if (TrailParticle.lifeRemainingSeconds <= 0) {
      continue;
    }

    TrailParticle.lifeRemainingSeconds -= DeltaTimeSeconds;

    if (TrailParticle.lifeRemainingSeconds <= 0) {
      updateTrailParticleInstance(TrailParticle, 0);
      continue;
    }

    const LifeRatio = TrailParticle.lifeRemainingSeconds / TrailParticle.maximumLifeSeconds;
    updateTrailParticleInstance(TrailParticle, 0.18 + (LifeRatio * 0.69));
  }
  TrailParticleMesh.instanceMatrix.needsUpdate = true;
}

/**
 * Clears trajectory presentation after aiming ends.
 */
function clearTrajectoryPreview() {
  TrajectoryLine.visible = false;
  LandingMarkerMesh.visible = false;
  TrajectoryGeometry.setDrawRange(0, 0);
  PredictedStardustIdentifiers.clear();
}

/**
 * Updates launch strength and trajectory from the current pointer position.
 *
 * @param {THREE.Vector3} CurrentPointerWorldPosition - Current pointer position in orbital space.
 */
function updateAimPreview(CurrentPointerWorldPosition) {
  AimDragVector.set(
    SeedPhysicsState.position.x - CurrentPointerWorldPosition.x,
    SeedPhysicsState.position.y - CurrentPointerWorldPosition.y,
    0,
  );

  if (AimDragVector.length() > MaximumDragDistance) {
    AimDragVector.setLength(MaximumDragDistance);
  }

  const PowerRatio = THREE.MathUtils.clamp(AimDragVector.length() / MaximumDragDistance, 0, 1);
  AimLaunchVelocity.copy(AimDragVector).multiplyScalar(LaunchVelocityPerDragUnit);

  if (AimDragVector.length() < MinimumLaunchDragDistance) {
    clearTrajectoryPreview();
    WorldseedSound.updateAim(PowerRatio, false);
    return;
  }

  const TrajectoryPrediction = predictTrajectory(
    SeedPhysicsState.position,
    createVector(AimLaunchVelocity.x, AimLaunchVelocity.y, 0),
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedPhysicsStepSeconds,
      maximumSteps: MaximumTrajectoryPredictionSteps,
      ignoredWorldIdentifier: getWorldDefinition(CurrentWorldIdentifier)
        ? CurrentWorldIdentifier
        : null,
      collisionBodyDefinitions: getActiveTacticalBodyDefinitions(),
      ignoredCollisionBodyIdentifier: CurrentWorldIdentifier === SeedstoneDefinition.id
        ? SeedstoneDefinition.id
        : null,
      startTimeSeconds: PhysicsElapsedTimeSeconds,
    },
  );
  const VisiblePredictionPoints = TrajectoryPrediction.points.slice(
    0,
    RankedPredictionVisibleSteps + 1,
  );
  const IsOutcomeVisible = TrajectoryPrediction.points.length <= RankedPredictionVisibleSteps + 1;
  GameCanvas.dataset.lastPredictionVisiblePoints = String(VisiblePredictionPoints.length);
  GameCanvas.dataset.lastPredictionTotalPoints = String(TrajectoryPrediction.points.length);
  GameCanvas.dataset.lastPredictionOutcomeVisible = String(IsOutcomeVisible);
  const PredictedSlingshotEvents = predictSlingshotEvents(
    VisiblePredictionPoints,
    WorldDefinitions,
    {
      runnerRadius: SeedRadius,
      ignoredBodyIdentifier: getWorldDefinition(CurrentWorldIdentifier)
        ? CurrentWorldIdentifier
        : null,
    },
  );
  PredictedStardustIdentifiers.clear();
  for (const StardustIdentifier of getTrajectoryPickupIdentifiers(
    VisiblePredictionPoints,
    StardustDefinitions,
    StardustCollectionRadius,
  )) {
    PredictedStardustIdentifiers.add(StardustIdentifier);
  }

  /** Downsample the fixed-step prediction so a small line buffer remains cheap on mobile. */
  const PreviewSampleStride = 4;
  let PreviewPointCount = 0;
  for (
    let PredictionPointIndex = 0;
    PredictionPointIndex < VisiblePredictionPoints.length;
    PredictionPointIndex += PreviewSampleStride
  ) {
    const PredictionPoint = VisiblePredictionPoints[PredictionPointIndex];
    TrajectoryPositionAttribute.setXYZ(
      PreviewPointCount,
      PredictionPoint.x,
      PredictionPoint.y,
      0.12,
    );
    PreviewPointCount += 1;
  }

  const FinalPredictionPoint = TrajectoryPrediction.points[TrajectoryPrediction.points.length - 1];
  const FinalVisiblePredictionPoint = VisiblePredictionPoints[VisiblePredictionPoints.length - 1];
  const LastPreviewOffset = Math.max(0, (PreviewPointCount - 1) * 3);
  const FinalPointDifferenceX = TrajectoryPositionValues[LastPreviewOffset] - FinalVisiblePredictionPoint.x;
  const FinalPointDifferenceY = TrajectoryPositionValues[LastPreviewOffset + 1] - FinalVisiblePredictionPoint.y;
  if (
    PreviewPointCount === 0
    || ((FinalPointDifferenceX * FinalPointDifferenceX) + (FinalPointDifferenceY * FinalPointDifferenceY)) > 0.01
  ) {
    TrajectoryPositionAttribute.setXYZ(
      PreviewPointCount,
      FinalVisiblePredictionPoint.x,
      FinalVisiblePredictionPoint.y,
      0.12,
    );
    PreviewPointCount += 1;
  }

  TrajectoryPositionAttribute.needsUpdate = true;
  TrajectoryGeometry.setDrawRange(0, PreviewPointCount);
  TrajectoryGeometry.computeBoundingSphere();
  TrajectoryLine.visible = PreviewPointCount > 1;

  const PowerPercentage = Math.round(PowerRatio * 100);
  AimPowerFillElement.style.width = `${PowerPercentage}%`;
  AimPowerValueElement.textContent = `${PowerPercentage}%`;

  if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'hazard') {
    TrajectoryMaterial.color.set(0xff766d);
    TrajectoryMaterial.opacity = 0.88;
    LandingMarkerMaterial.color.set(0xff766d);
    AimPanelElement.classList.remove('is-locked');
    AimLabelElement.textContent = `${AsteroidDefinition.label} COLLISION`;
    showInstruction(
      'Red means impact',
      'Wait for the asteroid to move or change the launch angle.',
    );
    LandingMarkerMesh.position.set(FinalPredictionPoint.x, FinalPredictionPoint.y, 0.2);
    LandingMarkerMesh.visible = true;
  } else if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'seedstone') {
    const SeedstonePosition = calculateBodyPositionAtTime(
      SeedstoneDefinition,
      TrajectoryPrediction.collisionTimeSeconds,
    );
    TrajectoryMaterial.color.set(0x72d9ff);
    TrajectoryMaterial.opacity = 0.86;
    LandingMarkerMaterial.color.set(0x72d9ff);
    AimPanelElement.classList.add('is-locked');
    AimLabelElement.textContent = `${SeedstoneDefinition.label} LOCKED`;
    showInstruction(
      'Release to land on the Seedstone',
      'Blue means a one-use tactical launchpad. It does not awaken a world.',
    );
    const LandingDirection = TemporaryThreeVector.set(
      FinalPredictionPoint.x - SeedstonePosition.x,
      FinalPredictionPoint.y - SeedstonePosition.y,
      0,
    ).normalize();
    LandingMarkerMesh.position.set(
      SeedstonePosition.x + (LandingDirection.x * (SeedstoneDefinition.radius + 0.08)),
      SeedstonePosition.y + (LandingDirection.y * (SeedstoneDefinition.radius + 0.08)),
      0.2,
    );
    LandingMarkerMesh.visible = true;
  } else if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'worldheart') {
    TrajectoryMaterial.color.set(0xffd678);
    TrajectoryMaterial.opacity = 0.9;
    LandingMarkerMaterial.color.set(0xffd678);
    AimPanelElement.classList.add('is-locked');
    AimLabelElement.textContent = `${WorldheartDefinition.label} LOCKED`;
    showInstruction(
      'Release to reconnect the Worldheart',
      isSystemRestored(WorldDefinitions)
        ? 'Heart, Bloom and Arc will record the journey you completed.'
        : 'You can leave now, or awaken every world first to earn Bloom.',
    );
    const LandingDirection = TemporaryThreeVector.set(
      FinalPredictionPoint.x - WorldheartDefinition.position.x,
      FinalPredictionPoint.y - WorldheartDefinition.position.y,
      0,
    ).normalize();
    LandingMarkerMesh.position.set(
      WorldheartDefinition.position.x
        + (LandingDirection.x * (WorldheartDefinition.radius + 0.08)),
      WorldheartDefinition.position.y
        + (LandingDirection.y * (WorldheartDefinition.radius + 0.08)),
      0.2,
    );
    LandingMarkerMesh.visible = true;
  } else if (IsOutcomeVisible && TrajectoryPrediction.collisionWorldIdentifier) {
    const LandingWorldDefinition = getWorldDefinition(TrajectoryPrediction.collisionWorldIdentifier);
    const IsNewWorldLanding = !LandingWorldDefinition.restored;
    TrajectoryMaterial.color.set(IsNewWorldLanding ? 0xffd98a : 0xbceca8);
    TrajectoryMaterial.opacity = 0.82;
    LandingMarkerMaterial.color.set(IsNewWorldLanding ? 0xffd98a : 0xbceca8);
    AimPanelElement.classList.add('is-locked');
    AimLabelElement.textContent = IsNewWorldLanding ? 'NEW WORLD LOCKED' : 'SAFE LANDING';
    showInstruction(
      (IsNewWorldLanding ? 'Release to awaken ' : 'Release to land on ')
        + LandingWorldDefinition.label,
      IsNewWorldLanding
        ? 'Gold means a new world. This landing becomes your next launch point.'
        : 'Green means a restored safe landing.',
    );
    const LandingDirection = TemporaryThreeVector.set(
      FinalPredictionPoint.x - LandingWorldDefinition.position.x,
      FinalPredictionPoint.y - LandingWorldDefinition.position.y,
      0,
    ).normalize();
    LandingMarkerMesh.position.set(
      LandingWorldDefinition.position.x + (LandingDirection.x * (LandingWorldDefinition.radius + 0.08)),
      LandingWorldDefinition.position.y + (LandingDirection.y * (LandingWorldDefinition.radius + 0.08)),
      0.2,
    );
    LandingMarkerMesh.visible = true;
  } else if (!IsOutcomeVisible) {
    TrajectoryMaterial.color.set(
      TrajectoryPrediction.collisionKind === 'hazard' ? 0xff9b77 : 0x9db8c6,
    );
    TrajectoryMaterial.opacity = 0.58;
    LandingMarkerMesh.visible = false;
    AimPanelElement.classList.remove('is-locked');
    AimLabelElement.textContent = TrajectoryPrediction.collisionKind === 'hazard'
      ? 'DANGER AHEAD'
      : 'LONG ARC';
    showInstruction(
      TrajectoryPrediction.collisionKind === 'hazard'
        ? 'Something crosses the hidden path'
        : 'The ranked preview ends here',
      TrajectoryPrediction.collisionKind === 'hazard'
        ? 'Change the angle or timing—the warning is exact, but the impact point stays hidden.'
        : 'Judge the remaining gravity curve, or use nearby worlds to build a scoring chain.',
    );
  } else {
    TrajectoryMaterial.color.set(0x9db8c6);
    TrajectoryMaterial.opacity = 0.48;
    LandingMarkerMesh.visible = false;
    AimPanelElement.classList.remove('is-locked');
    AimLabelElement.textContent = 'PULL';
    showInstruction(
      'No landing yet',
      'Pull farther or change the angle until the path turns gold, green or blue.',
    );
  }
  if (PredictedStardustIdentifiers.size > 0) {
    AimLabelElement.textContent += ` · ARC +${PredictedStardustIdentifiers.size}`;
  }
  if (PredictedSlingshotEvents.length > 0) {
    const PredictedPoints = PredictedSlingshotEvents.reduce(
      (Total, Event) => Total + Event.points,
      0,
    );
    AimLabelElement.textContent += ` · ASSIST +${PredictedPoints.toLocaleString('en-GB')}`;
  }
  WorldseedSound.updateAim(
    PowerRatio,
    IsOutcomeVisible
      && TrajectoryPrediction.collisionKind !== null
      && TrajectoryPrediction.collisionKind !== 'hazard',
  );
}

/** Rebuilds the virtual pull point used by keyboard aiming through the pointer preview path. */
function updateKeyboardAimPreview() {
  const DragVector = getKeyboardAimDragVector(KeyboardAimState, MaximumDragDistance);
  LastAimPointerWorldPosition.set(
    SeedPhysicsState.position.x - DragVector.x,
    SeedPhysicsState.position.y - DragVector.y,
    0,
  );
  updateAimPreview(LastAimPointerWorldPosition);
  GameCanvas.dataset.keyboardAimAngle = String(Math.round(
    THREE.MathUtils.radToDeg(KeyboardAimState.angleRadians) * 10,
  ) / 10);
  GameCanvas.dataset.keyboardAimPower = String(Math.round(KeyboardAimState.powerRatio * 100));
}

/** Opens keyboard aim toward the first authored route while retaining free steering. */
function beginKeyboardAim() {
  if (
    GamePhase !== 'attached'
    || ActiveHostileEncounterState !== null
    || RunState.status !== 'active'
    || ReplayPlaybackState !== null
    || IsPointerAiming
    || IsKeyboardAiming
  ) {
    return false;
  }

  const SuggestedTarget = getCurrentRouteChoices(1)[0];
  const SuggestedTargetPosition = SuggestedTarget?.position ?? {
    x: SeedPhysicsState.position.x + 1,
    y: SeedPhysicsState.position.y,
  };
  KeyboardAimState = createKeyboardAimState({
    directionX: SuggestedTargetPosition.x - SeedPhysicsState.position.x,
    directionY: SuggestedTargetPosition.y - SeedPhysicsState.position.y,
    powerRatio: 1,
  });
  IsKeyboardAiming = true;
  WorldseedSound.beginAim();
  GameCanvas.classList.add('is-aiming');
  PullGuideLine.visible = false;
  AimPanelElement.hidden = false;
  updateKeyboardAimPreview();
  showInstruction(
    'Keyboard aim ready',
    'Left/right steer · up/down set power · Shift makes fine adjustments · Enter launches.',
  );
  return true;
}

/** Cancels keyboard aiming without spending a launch. */
function cancelKeyboardAim() {
  if (!IsKeyboardAiming) {
    return;
  }
  IsKeyboardAiming = false;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  clearTrajectoryPreview();
  WorldseedSound.endAim();
  showRouteChoiceInstruction();
}

/** Routes focused canvas keys into the same aim and launch state as a pointer gesture. */
function handleKeyboardAimKey(KeyboardEventData) {
  if (document.activeElement !== GameCanvas) {
    return false;
  }

  const PressedKey = KeyboardEventData.key.toLowerCase();
  if (
    !IsKeyboardAiming
    && (PressedKey === 'q' || PressedKey === 'e')
    && GamePhase === 'attached'
    && ReplayPlaybackState === null
  ) {
    KeyboardEventData.preventDefault();
    setScoutMode(false);
    const DidMove = moveRunnerAroundSurface(
      PressedKey === 'q' ? 1 : -1,
      KeyboardEventData.shiftKey,
    );
    if (DidMove && !ActiveHostileEncounterState) {
      showInstruction(
        'Launch point moved',
        'Q/E walk · Shift makes fine steps · arrows aim · Enter launches.',
      );
    }
    return DidMove;
  }
  const IsLaunchKey = PressedKey === 'enter' || PressedKey === ' ';
  const RotationDirection = PressedKey === 'arrowleft' || PressedKey === 'a'
    ? 1
    : (PressedKey === 'arrowright' || PressedKey === 'd' ? -1 : 0);
  const PowerDirection = PressedKey === 'arrowup' || PressedKey === 'w'
    ? 1
    : (PressedKey === 'arrowdown' || PressedKey === 's' ? -1 : 0);

  if (PressedKey === 'escape' && IsKeyboardAiming) {
    KeyboardEventData.preventDefault();
    cancelKeyboardAim();
    return true;
  }
  if (!IsLaunchKey && RotationDirection === 0 && PowerDirection === 0) {
    return false;
  }
  if (IsLaunchKey && KeyboardEventData.repeat) {
    KeyboardEventData.preventDefault();
    return true;
  }
  if (!IsKeyboardAiming && !beginKeyboardAim()) {
    return false;
  }

  KeyboardEventData.preventDefault();
  if (IsLaunchKey) {
    if (IsKeyboardAiming) {
      releaseAimedLaunch();
    }
    return true;
  }

  KeyboardAimState = adjustKeyboardAimState(KeyboardAimState, {
    rotationDirection: RotationDirection,
    powerDirection: PowerDirection,
    fine: KeyboardEventData.shiftKey,
  });
  updateKeyboardAimPreview();
  return true;
}

/**
 * Begins a slingshot drag when the seed is attached and the pointer acquired it.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerDown(PointerEventData) {
  if (
    GamePhase !== 'attached'
    || RunState.status !== 'active'
    || ReplayPlaybackState !== null
    || ActivePointerIdentifier !== null
  ) {
    return;
  }

  cancelKeyboardAim();
  const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
  if (!CurrentPointerWorldPosition) {
    return;
  }

  GameCanvas.focus({ preventScroll: true });
  ActivePointerIdentifier = PointerEventData.pointerId;
  GameCanvas.setPointerCapture(PointerEventData.pointerId);
  if (!isPointerOverSeed(PointerEventData)) {
    IsPointerScouting = true;
    setScoutMode(true, { snapToRunner: false });
    ScoutPointerStartWorldPosition.copy(CurrentPointerWorldPosition);
    ScoutCameraStartTarget.copy(ScoutCameraTarget);
    GameCanvas.classList.add('is-scouting');
    PointerEventData.preventDefault();
    return;
  }

  setScoutMode(false);
  PointerGestureMode = SurfaceGestureModes.pending;
  PointerGestureStartWorldPosition.copy(CurrentPointerWorldPosition);
  LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
  PullGuideLine.visible = false;
  PointerEventData.preventDefault();
}

/**
 * Updates a slingshot drag.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerMove(PointerEventData) {
  if (PointerEventData.pointerId !== ActivePointerIdentifier) {
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
  if (!CurrentPointerWorldPosition) {
    return;
  }

  if (IsPointerScouting) {
    const NextScoutX = ScoutCameraStartTarget.x
      + (ScoutPointerStartWorldPosition.x - CurrentPointerWorldPosition.x);
    const NextScoutY = ScoutCameraStartTarget.y
      + (ScoutPointerStartWorldPosition.y - CurrentPointerWorldPosition.y);
    ScoutCameraTarget.set(
      ScannerProjection
        ? THREE.MathUtils.clamp(
          NextScoutX,
          ScannerProjection.minimumX,
          ScannerProjection.minimumX + ScannerProjection.width,
        )
        : NextScoutX,
      ScannerProjection
        ? THREE.MathUtils.clamp(
          NextScoutY,
          ScannerProjection.minimumY,
          ScannerProjection.minimumY + ScannerProjection.height,
        )
        : NextScoutY,
      0,
    );
    GameCanvas.dataset.scoutX = ScoutCameraTarget.x.toFixed(2);
    GameCanvas.dataset.scoutY = ScoutCameraTarget.y.toFixed(2);
    PointerEventData.preventDefault();
    return;
  }

  if (PointerGestureMode === SurfaceGestureModes.pending) {
    const AttachedWorld = getCurrentAttachedWorld();
    PointerGestureMode = AttachedWorld
      ? classifySurfaceGesture({
        startPosition: PointerGestureStartWorldPosition,
        currentPosition: CurrentPointerWorldPosition,
        bodyPosition: AttachedWorld.position,
      })
      : SurfaceGestureModes.aim;
    if (
      ActiveHostileEncounterState
      && PointerGestureMode !== SurfaceGestureModes.pending
    ) {
      PointerGestureMode = SurfaceGestureModes.walk;
    }
    if (PointerGestureMode === SurfaceGestureModes.walk) {
      IsPointerWalking = true;
      GameCanvas.classList.add('is-walking');
      showInstruction(
        `Walking around ${AttachedWorld.label}`,
        'Trace the rim to choose a launch point. Release to stop; pull away to aim.',
      );
    } else if (PointerGestureMode === SurfaceGestureModes.aim) {
      IsPointerAiming = true;
      WorldseedSound.beginAim();
      GameCanvas.classList.add('is-aiming');
      AimPanelElement.hidden = false;
    }
  }

  if (IsPointerWalking) {
    const AttachedWorld = getCurrentAttachedWorld();
    const SurfaceAngle = Math.atan2(
      CurrentPointerWorldPosition.y - AttachedWorld.position.y,
      CurrentPointerWorldPosition.x - AttachedWorld.position.x,
    );
    setRunnerSurfaceAngle(SurfaceAngle);
    PointerEventData.preventDefault();
    return;
  }

  if (IsPointerAiming) {
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    updateAimPreview(CurrentPointerWorldPosition);
  }
  PointerEventData.preventDefault();
}

/** Launches the current pointer or keyboard aim through the shared deterministic path. */
function releaseAimedLaunch() {
  IsPointerAiming = false;
  IsPointerWalking = false;
  IsPointerScouting = false;
  PointerGestureMode = SurfaceGestureModes.pending;
  IsKeyboardAiming = false;
  setScoutMode(false);
  FlightElapsedSeconds = 0;
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  clearTrajectoryPreview();

  if (AimDragVector.length() < MinimumLaunchDragDistance) {
    WorldseedSound.endAim();
    showInstruction('Aim the Runner', 'Drag, or use the arrow keys and press Enter to launch.');
    return false;
  }

  RunState = releaseRunLaunch(RunState);
  updateLaunchCounter();

  SeedPhysicsState.velocity = createVector(
    AimLaunchVelocity.x,
    AimLaunchVelocity.y,
    0,
  );
  ReplayState = recordReplayLaunch(ReplayState, {
    stepIndex: Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
    originIdentifier: CurrentWorldIdentifier,
    originX: SeedPhysicsState.position.x,
    originY: SeedPhysicsState.position.y,
    velocityX: AimLaunchVelocity.x,
    velocityY: AimLaunchVelocity.y,
  });
  GameCanvas.dataset.replayLaunchCount = String(ReplayState.launches.length);
  GameCanvas.dataset.lastLaunchVelocityX = AimLaunchVelocity.x.toFixed(3);
  GameCanvas.dataset.lastLaunchVelocityY = AimLaunchVelocity.y.toFixed(3);
  GameCanvas.dataset.lastLaunchTime = PhysicsElapsedTimeSeconds.toFixed(3);
  const IsLaunchingFromSeedstone = CurrentWorldIdentifier === SeedstoneDefinition.id;
  FlightOriginWorldIdentifier = IsLaunchingFromSeedstone ? null : CurrentWorldIdentifier;
  FlightCollectedStardustIdentifiers.clear();
  FlightHadAsteroidClosePass = false;
  FlightClosePassWorldIdentifiers.clear();
  LaunchIgnoredWorldIdentifier = IsLaunchingFromSeedstone ? null : CurrentWorldIdentifier;
  LaunchIgnoredBodyIdentifier = IsLaunchingFromSeedstone ? SeedstoneDefinition.id : null;
  if (IsLaunchingFromSeedstone) {
    AttachedSeedstoneSurfaceOffset = null;
    SeedstoneUsesRemaining = 0;
    SeedstoneCrumbleStartedAtSeconds = GameElapsedTimeSeconds;
    showStatusToast(`${SeedstoneDefinition.label} SPENT`, 650);
  }
  GamePhase = 'flying';
  FlightElapsedSeconds = 0;
  IsBreakerBurnAvailable = true;
  IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  HasLaunchedOnce = true;
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1);
  LaunchPulseMesh.visible = true;
  LaunchPulseLifeSeconds = 0.42;
  TrailEmissionAccumulatorSeconds = 0;
  WorldseedSound.launch(THREE.MathUtils.clamp(
    AimDragVector.length() / MaximumDragDistance,
    0,
    1,
  ));
  hideInstruction();
  return true;
}

function updateBreakerBurnInterface() {
  const IsHostilePulse = Boolean(ActiveHostileEncounterState);
  const IsPulseReady = IsHostilePulse && publishHostileEncounterState();
  BurnButtonElement.hidden = GamePhase !== 'flying' && !IsHostilePulse;
  BurnButtonElement.classList.toggle(
    'is-spent',
    IsHostilePulse ? !IsPulseReady : !IsBreakerBurnAvailable,
  );
  BurnButtonElement.disabled = IsHostilePulse ? !IsPulseReady : !IsBreakerBurnAvailable;
  BurnButtonElement.querySelector('span').textContent = IsHostilePulse
    ? 'BREAKER PULSE'
    : 'BREAKER BURN';
  BurnButtonElement.querySelector('strong').textContent = IsHostilePulse
    ? (IsPulseReady ? 'IN RANGE' : 'MOVE Q / E')
    : IsBreakerBurnAvailable
      ? (IsBreakerBurnPending ? 'ARMED' : 'READY')
      : 'SPENT';
  BurnButtonElement.setAttribute(
    'aria-label',
    IsHostilePulse
      ? `Breaker Pulse ${IsPulseReady ? 'ready' : 'out of range'}`
      : `Breaker Burn ${IsBreakerBurnAvailable ? 'ready' : 'spent'}`,
  );
  GameCanvas.dataset.breakerBurn = GamePhase !== 'flying'
    ? 'stowed'
    : (IsBreakerBurnAvailable ? (IsBreakerBurnPending ? 'armed' : 'ready') : 'spent');
}

function requestBreakerPulse() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState || ReplayPlaybackState !== null) {
    return false;
  }
  const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
  const ResolvedEncounterState = resolveHostilePulse(
    ActiveHostileEncounterState,
    RunnerSurfaceAngle,
  );
  if (ResolvedEncounterState === ActiveHostileEncounterState) return false;

  CompletedHostileEncounterWorldIdentifiers.add(AttachedWorld.id);
  ActiveHostileEncounterState = null;
  HostilePylonGroup.visible = false;
  GameCanvas.dataset.lastHostileWorld = AttachedWorld.id;
  publishHostileEncounterState();
  ImpactPulseMesh.material.color.set(0xff675f);
  ImpactPulseMesh.position.copy(SeedGroup.position);
  ImpactPulseMesh.scale.setScalar(1.2);
  ImpactPulseMesh.visible = true;
  ImpactPulseLifeSeconds = 0.58;
  WorldseedSound.impact(AttachedWorld.id);
  if (AttachedWorld.kind === 'worldheart') {
    return completeWorldheartLiberation();
  }
  updateBreakerBurnInterface();
  showStatusToast('BREAKER PULSE · BARRIER DISABLED', 1350);
  showInstruction(
    `${AttachedWorld.label} relay secured.`,
    'The hostile surface beat is over. Choose the next orbital route.',
  );
  return true;
}

function requestBreakerAction() {
  return ActiveHostileEncounterState
    ? requestBreakerPulse()
    : requestBreakerBurn();
}

/** Queues input for the next authoritative fixed step rather than mutating between frames. */
function requestBreakerBurn() {
  if (
    GamePhase !== 'flying'
    || !IsBreakerBurnAvailable
    || IsBreakerBurnPending
    || ReplayPlaybackState !== null
  ) {
    return false;
  }
  IsBreakerBurnPending = true;
  updateBreakerBurnInterface();
  return true;
}

function applyBreakerBurnAtCurrentStep({ record = false } = {}) {
  if (!IsBreakerBurnAvailable) return false;
  SeedPhysicsState = applyBreakerBurn(SeedPhysicsState);
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  if (record) {
    ReplayState = recordReplayBurn(ReplayState, {
      stepIndex: Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
    });
  }
  GameCanvas.dataset.breakerBurnStep = String(
    Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
  );
  GameCanvas.dataset.breakerBurnSpeed = Math.hypot(
    SeedPhysicsState.velocity.x,
    SeedPhysicsState.velocity.y,
  ).toFixed(3);
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1.3);
  LaunchPulseMesh.visible = true;
  LaunchPulseLifeSeconds = 0.5;
  showStatusToast('BREAKER BURN', 650);
  updateBreakerBurnInterface();
  return true;
}

/**
 * Converts the final drag vector into launch velocity, or cancels if the gesture was tiny.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerUp(PointerEventData) {
  if (PointerEventData.pointerId !== ActivePointerIdentifier) {
    return;
  }

  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }

  if (IsPointerScouting) {
    IsPointerScouting = false;
    ActivePointerIdentifier = null;
    GameCanvas.classList.remove('is-scouting');
    PointerEventData.preventDefault();
    return;
  }

  if (IsPointerWalking) {
    IsPointerWalking = false;
    ActivePointerIdentifier = null;
    PointerGestureMode = SurfaceGestureModes.pending;
    GameCanvas.classList.remove('is-walking');
    if (!showHostileEncounterInstruction()) showRouteChoiceInstruction();
    PointerEventData.preventDefault();
    return;
  }

  if (!IsPointerAiming) {
    ActivePointerIdentifier = null;
    PointerGestureMode = SurfaceGestureModes.pending;
    showInstruction('Choose a gesture', 'Trace around the world to walk, or pull away to launch.');
    PointerEventData.preventDefault();
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
  if (CurrentPointerWorldPosition) {
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    updateAimPreview(CurrentPointerWorldPosition);
  }

  releaseAimedLaunch();
  PointerGestureMode = SurfaceGestureModes.pending;
  PointerEventData.preventDefault();
}

function handlePointerCancel(PointerEventData) {
  if (PointerEventData.pointerId !== ActivePointerIdentifier) return;
  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }
  const WasAiming = IsPointerAiming;
  IsPointerAiming = false;
  IsPointerWalking = false;
  IsPointerScouting = false;
  ActivePointerIdentifier = null;
  PointerGestureMode = SurfaceGestureModes.pending;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
}

/**
 * Returns the seed to its last safe world after a miss. Recovery is intentionally fast so
 * experimentation never becomes frustrating.
 */
function recoverSeedFromVoid(StatusMessage = 'LOST TO THE VOID') {
  if (GamePhase === 'recovering' || GamePhase === 'victory') {
    return;
  }

  RunState = settleRunFlight(RunState);
  const SuppressedWorld = resolveWardenAfterResolvedFlight();
  updateLaunchCounter();
  const LostPoints = loseCurrentFlightScore();
  rollbackFlightStardust();
  resetFlightFeedback();
  SeedPhysicsState.velocity = createVector();
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  if (RunState.status === 'failed') {
    scheduleRunFailure(StatusMessage);
    return;
  }

  GamePhase = 'recovering';
  WorldseedSound.failure();
  showStatusToast(
    LostPoints > 0
      ? `${StatusMessage} · ${LostPoints.toLocaleString('en-GB')} LOST`
      : StatusMessage,
    850,
  );

  if (RecoveryTimeoutIdentifier !== null) {
    window.clearTimeout(RecoveryTimeoutIdentifier);
  }

  RecoveryTimeoutIdentifier = window.setTimeout(() => {
    SeedPhysicsState = {
      position: createVector(
        LastSafeSeedPosition.x,
        LastSafeSeedPosition.y,
        LastSafeSeedPosition.z,
      ),
      velocity: createVector(),
    };
    SeedGroup.position.set(
      LastSafeSeedPosition.x,
      LastSafeSeedPosition.y,
      LastSafeSeedPosition.z,
    );
    CurrentWorldIdentifier = LastSafeWorldIdentifier;
    AttachedSeedstoneSurfaceOffset = null;
    publishAttachedSeedState(CurrentWorldIdentifier, LastSafeSeedPosition);
    LaunchIgnoredWorldIdentifier = null;
    LaunchIgnoredBodyIdentifier = null;
    GamePhase = 'attached';
    updateBreakerBurnInterface();
    if (SuppressedWorld) {
      showInstruction(
        `Signal lost: ${SuppressedWorld.label}.`,
        'Its route and courier are dark. Land there again to reconnect it.',
      );
    } else {
      showInstruction('Try another angle', 'Use the gold route rings and wait for a landing lock.');
    }
    RecoveryTimeoutIdentifier = null;
  }, 420);
}

/** Releases one recorded input through the same live flight state as a player shot. */
function beginReplayLaunch(Launch) {
  if (ActiveHostileEncounterState) {
    CompletedHostileEncounterWorldIdentifiers.add(
      ActiveHostileEncounterState.worldIdentifier,
    );
    ActiveHostileEncounterState = null;
    HostilePylonGroup.visible = false;
    publishHostileEncounterState();
  }
  RunState = releaseRunLaunch(RunState);
  updateLaunchCounter();
  if (Number.isFinite(Launch.originX) && Number.isFinite(Launch.originY)) {
    SeedPhysicsState.position = createVector(Launch.originX, Launch.originY, 0);
    SeedGroup.position.set(Launch.originX, Launch.originY, 0);
    if (getWorldDefinition(CurrentWorldIdentifier)) {
      LastSafeSeedPosition = createVector(Launch.originX, Launch.originY, 0);
    }
  }
  SeedPhysicsState.velocity = createVector(Launch.velocityX, Launch.velocityY, 0);
  GameCanvas.dataset.lastLaunchVelocityX = Launch.velocityX.toFixed(3);
  GameCanvas.dataset.lastLaunchVelocityY = Launch.velocityY.toFixed(3);
  GameCanvas.dataset.lastLaunchTime = PhysicsElapsedTimeSeconds.toFixed(3);
  const IsLaunchingFromSeedstone = CurrentWorldIdentifier === SeedstoneDefinition.id;
  FlightOriginWorldIdentifier = IsLaunchingFromSeedstone ? null : CurrentWorldIdentifier;
  FlightCollectedStardustIdentifiers.clear();
  FlightHadAsteroidClosePass = false;
  FlightClosePassWorldIdentifiers.clear();
  LaunchIgnoredWorldIdentifier = IsLaunchingFromSeedstone ? null : CurrentWorldIdentifier;
  LaunchIgnoredBodyIdentifier = IsLaunchingFromSeedstone ? SeedstoneDefinition.id : null;
  if (IsLaunchingFromSeedstone) {
    AttachedSeedstoneSurfaceOffset = null;
    SeedstoneUsesRemaining = 0;
    SeedstoneCrumbleStartedAtSeconds = GameElapsedTimeSeconds;
  }
  GamePhase = 'flying';
  FlightElapsedSeconds = 0;
  IsBreakerBurnAvailable = true;
  IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  HasLaunchedOnce = true;
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1);
  LaunchPulseMesh.visible = true;
  LaunchPulseLifeSeconds = 0.42;
  TrailEmissionAccumulatorSeconds = 0;
  const LaunchSpeed = Math.hypot(Launch.velocityX, Launch.velocityY);
  WorldseedSound.launch(THREE.MathUtils.clamp(
    LaunchSpeed / (MaximumDragDistance * LaunchVelocityPerDragUnit),
    0,
    1,
  ));
  hideInstruction();
}

function advanceReplayBurn() {
  if (!ReplayPlaybackState || GamePhase !== 'flying') return;
  const BurnUpdate = consumeDueReplayBurn(
    ReplayPlaybackState,
    Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
  );
  ReplayPlaybackState = BurnUpdate.playbackState;
  if (BurnUpdate.burn) applyBreakerBurnAtCurrentStep();
}

/** Injects a replay input immediately before its recorded fixed simulation step. */
function advanceReplayPlayback() {
  if (!ReplayPlaybackState || GamePhase !== 'attached') {
    return;
  }
  const CurrentStepIndex = Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz);
  try {
    const PlaybackUpdate = consumeDueReplayLaunch(
      ReplayPlaybackState,
      CurrentStepIndex,
      CurrentWorldIdentifier,
    );
    ReplayPlaybackState = PlaybackUpdate.playbackState;
    if (!PlaybackUpdate.launch) {
      return;
    }
    GameCanvas.dataset.replayPlayedLaunchCount = String(
      ReplayPlaybackState.nextLaunchIndex,
    );
    ReplayIndicatorElement.textContent = (
      `WATCHING VERIFIED REPLAY · ${ReplayPlaybackState.nextLaunchIndex}`
      + ` / ${ReplayPlaybackState.replay.launches.length}`
    );
    beginReplayLaunch(PlaybackUpdate.launch);
  } catch (Error) {
    ReplayPlaybackState = null;
    ReplayIndicatorElement.hidden = true;
    GameCanvas.dataset.replayMode = 'rejected';
    showStatusToast('REPLAY COULD NOT CONTINUE', 1400);
  }
}

/**
 * Advances live seed physics by one fixed step.
 */
function simulateSeedFixedStep() {
  advanceReplayPlayback();
  PhysicsElapsedTimeSeconds += FixedPhysicsStepSeconds;
  synchronizeSeedstonePosition();
  synchronizeWorldheartPosition();
  if (IsPointerAiming && GamePhase === 'attached') {
    updateAimPreview(LastAimPointerWorldPosition);
  } else if (IsKeyboardAiming && GamePhase === 'attached') {
    updateKeyboardAimPreview();
  }
  if (GamePhase !== 'flying') {
    return;
  }
  advanceReplayBurn();
  if (IsBreakerBurnPending) applyBreakerBurnAtCurrentStep({ record: true });
  RunFlightTimeSeconds += FixedPhysicsStepSeconds;
  FlightElapsedSeconds += FixedPhysicsStepSeconds;

  SeedPhysicsState = simulatePhysicsStep(
    SeedPhysicsState,
    WorldDefinitions,
    FixedPhysicsStepSeconds,
  );
  collectStardustAtPosition(SeedPhysicsState.position);

  if (LaunchIgnoredWorldIdentifier) {
    const StartingWorldDefinition = getWorldDefinition(LaunchIgnoredWorldIdentifier);
    const ClearDistance = StartingWorldDefinition.radius + SeedRadius + 0.35;
    if (
      calculateDistanceSquared(SeedPhysicsState.position, StartingWorldDefinition.position)
      > (ClearDistance * ClearDistance)
    ) {
      LaunchIgnoredWorldIdentifier = null;
    }
  }

  if (LaunchIgnoredBodyIdentifier) {
    const StartingBodyDefinition = TacticalBodyDefinitions.find(
      (BodyDefinition) => BodyDefinition.id === LaunchIgnoredBodyIdentifier,
    );
    if (!StartingBodyDefinition) {
      LaunchIgnoredBodyIdentifier = null;
    } else {
      const StartingBodyPosition = calculateBodyPositionAtTime(
        StartingBodyDefinition,
        PhysicsElapsedTimeSeconds,
      );
      const ClearDistance = StartingBodyDefinition.radius + SeedRadius + 0.35;
      if (
        calculateDistanceSquared(SeedPhysicsState.position, StartingBodyPosition)
        > (ClearDistance * ClearDistance)
      ) {
        LaunchIgnoredBodyIdentifier = null;
      }
    }
  }

  updateFlightFeedback();

  const SlingshotEvents = sampleSlingshotBodies(
    ScoreState,
    SeedPhysicsState.position,
    WorldDefinitions,
    {
      runnerRadius: SeedRadius,
      ignoredBodyIdentifier: FlightOriginWorldIdentifier,
    },
  );
  if (SlingshotEvents.length > 0) {
    const SlingshotEvent = SlingshotEvents[SlingshotEvents.length - 1];
    updateScoreInterface();
    WorldseedSound.slingshot(
      SlingshotEvent.tierLabel,
      SlingshotEvent.chainMultiplier,
    );
    showStatusToast(
      `${SlingshotEvent.tierLabel} · ${SlingshotEvent.bodyLabel} +${SlingshotEvent.points.toLocaleString('en-GB')} · CHAIN ×${SlingshotEvent.chainMultiplier}`,
      1050,
    );
  }

  const CollisionWorldDefinition = findCollidingWorld(
    SeedPhysicsState.position,
    SeedRadius,
    WorldDefinitions,
    LaunchIgnoredWorldIdentifier,
  );

  const CollisionBody = findCollidingBody(
    SeedPhysicsState.position,
    SeedRadius,
    getActiveTacticalBodyDefinitions(),
    PhysicsElapsedTimeSeconds,
    LaunchIgnoredBodyIdentifier,
  );

  if (CollisionBody?.definition.kind === 'hazard') {
    ImpactPulseMesh.material.color.set(0xff766d);
    ImpactPulseMesh.position.set(
      SeedPhysicsState.position.x,
      SeedPhysicsState.position.y,
      0.22,
    );
    ImpactPulseMesh.scale.setScalar(1);
    ImpactPulseMesh.visible = true;
    ImpactPulseLifeSeconds = 0.42;
    CameraImpactLifeSeconds = 0.24;
    recoverSeedFromVoid(`${AsteroidDefinition.label} IMPACT`);
    return;
  }

  if (CollisionBody?.definition.kind === 'seedstone') {
    attachSeedToSeedstone(SeedPhysicsState.position, CollisionBody.position);
    return;
  }

  if (CollisionBody?.definition.kind === 'worldheart') {
    attachSeedToWorldheart(SeedPhysicsState.position, CollisionBody.position);
    return;
  }

  if (CollisionWorldDefinition) {
    attachSeedToWorld(CollisionWorldDefinition, SeedPhysicsState.position);
    return;
  }

  if (
    (SeedPhysicsState.position.x * SeedPhysicsState.position.x)
    + (SeedPhysicsState.position.y * SeedPhysicsState.position.y)
    > (OutOfBoundsDistance * OutOfBoundsDistance)
  ) {
    recoverSeedFromVoid();
  }
}

/**
 * Advances the signature spherical restoration wave, staged surface growth and atmosphere.
 *
 * @param {number} ElapsedTimeSeconds - Total elapsed game time.
 */
function updateWorldRestorationVisuals(ElapsedTimeSeconds) {
  for (const WorldDefinition of WorldDefinitions) {
    const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);

    if (!WorldDefinition.restored) {
      WorldRuntime.group.rotation.y += 0.0005;
      WorldRuntime.stillnessCageGroup.rotation.y += 0.0015;
      continue;
    }

    const IsFullyRestoredAtStart = WorldRuntime.restorationStartedAtSeconds === -Infinity;
    const RestorationElapsedSeconds = IsFullyRestoredAtStart
      ? WorldDefinition.restoration.durationSeconds
      : Math.max(0, ElapsedTimeSeconds - WorldRuntime.restorationStartedAtSeconds);
    const LinearRestorationProgress = THREE.MathUtils.clamp(
      RestorationElapsedSeconds / WorldDefinition.restoration.durationSeconds,
      0,
      1,
    );
    const WaveProgress = calculateRestorationWaveProgress(LinearRestorationProgress);
    const ShaderWaveProgress = LinearRestorationProgress >= 1 ? 1.2 : WaveProgress;
    WorldRuntime.restorationUniforms.restorationProgress.value = ShaderWaveProgress;
    WorldRuntime.restorationWaveMesh.visible = LinearRestorationProgress < 1;
    const StillnessPresentation = getStillnessPresentation(
      true,
      LinearRestorationProgress,
    );
    WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
    WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
    WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
    WorldRuntime.stillnessCageGroup.rotation.x += 0.0018 * (1 + LinearRestorationProgress);
    WorldRuntime.stillnessCageGroup.rotation.y += 0.0025 * (1 + LinearRestorationProgress);

    const AtmosphereLinearProgress = THREE.MathUtils.clamp(
      (LinearRestorationProgress - 0.12) / 0.76,
      0,
      1,
    );
    const AtmosphereProgress = 1 - Math.pow(1 - AtmosphereLinearProgress, 3);
    WorldRuntime.atmosphereMaterial.opacity = THREE.MathUtils.lerp(
      0.025,
      WorldDefinition.restoration.atmosphereOpacity,
      AtmosphereProgress,
    );
    WorldRuntime.atmosphereMesh.scale.setScalar(
      THREE.MathUtils.lerp(0.96, 1, AtmosphereProgress),
    );

    for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
      const GrowthProgress = IsFullyRestoredAtStart
        ? 1
        : calculateStagedGrowthProgress(
          WaveProgress,
          SurfacePropObject.userData.restorationDistance,
          WorldDefinition.restoration.growthTrailWidth,
        );
      const GrowthScale = SurfacePropObject.userData.baseScale * Math.max(0.05, GrowthProgress);
      SurfacePropObject.scale.setScalar(GrowthScale);
      setSurfacePropRestorationProgress(SurfacePropObject, GrowthProgress);
    }

    if (LinearRestorationProgress < 1) {
      const PulseScale = 1 + (Math.sin(LinearRestorationProgress * Math.PI) * 0.045);
      WorldRuntime.group.scale.setScalar(PulseScale);
    } else {
      WorldRuntime.group.scale.setScalar(1);
      if (!WorldRuntime.restorationCompleted) {
        WorldRuntime.restorationCompleted = true;
        WorldseedSound.restorationComplete(WorldDefinition.id);
        if (CurrentWorldIdentifier === WorldDefinition.id) {
          GameCanvas.dataset.lastMemory = WorldDefinition.memory;
          showStatusToast(WorldDefinition.memory, 2100, 'memory');
          if (WorldheartJustUnlocked) {
            WorldheartJustUnlocked = false;
            WorldseedSound.worldheartOpen();
          }
          if (GamePhase === 'victoryPending') {
            revealVictoryPanel();
            GamePhase = 'victory';
            WorldseedSound.victory();
            hideInstruction();
          } else if (GamePhase === 'restoring') {
            GamePhase = 'attached';
            if (!beginHostileEncounter(WorldDefinition)) showRouteChoiceInstruction();
          }
        }
      }
    }

    const MotionProgress = THREE.MathUtils.smoothstep(LinearRestorationProgress, 0.28, 0.92);
    WorldRuntime.group.rotation.y += THREE.MathUtils.lerp(
      0.0005,
      WorldDefinition.restoration.rotationSpeed,
      MotionProgress,
    );
    WorldRuntime.contourRingGroup.rotation.z += 0.0007 * MotionProgress;
    WorldRuntime.contourRingGroup.scale.setScalar(
      THREE.MathUtils.lerp(0.88, 1, AtmosphereProgress),
    );
    if (WorldRuntime.ambientMoteGroup) {
      WorldRuntime.ambientMoteGroup.material.opacity = (
        WorldRuntime.ambientMoteGroup.userData.baseOpacity * AtmosphereProgress
      );
    }
  }
}

/** Maps live fixed-step flight state into a continuous procedural wind voice. */
function updateFlightAudio() {
  if (GamePhase !== 'flying') {
    return;
  }
  const Speed = Math.hypot(SeedPhysicsState.velocity.x, SeedPhysicsState.velocity.y);
  let NearestSurfaceDistance = Infinity;
  for (const WorldDefinition of WorldDefinitions) {
    if (WorldDefinition.id === FlightOriginWorldIdentifier) {
      continue;
    }
    const OffsetX = SeedPhysicsState.position.x - WorldDefinition.position.x;
    const OffsetY = SeedPhysicsState.position.y - WorldDefinition.position.y;
    const CentreDistance = Math.sqrt((OffsetX * OffsetX) + (OffsetY * OffsetY));
    NearestSurfaceDistance = Math.min(
      NearestSurfaceDistance,
      Math.max(0, CentreDistance - WorldDefinition.radius - SeedRadius),
    );
  }
  NearestSurfaceDistance = Math.min(
    NearestSurfaceDistance,
    Math.max(0, getAsteroidSurfaceClearance()),
  );
  WorldseedSound.updateFlight(Speed, NearestSurfaceDistance);
}

/** Adds distinct, restrained biome motion without distracting from aiming. */
function updateWorldBiomeMotion(DeltaTimeSeconds, ElapsedTimeSeconds) {
  for (const VisualKey of ShaderMotionVisualKeys) {
    for (const WorldRuntime of (
      WorldRuntimesByVisualKey.get(VisualKey) ?? EmptyWorldRuntimeList
    )) {
      WorldRuntime.restorationUniforms.biomeTime.value = ElapsedTimeSeconds;
    }
  }

  for (const MeadowRuntime of (
    WorldRuntimesByVisualKey.get('meadow') ?? EmptyWorldRuntimeList
  )) {
    for (const SurfacePropObject of MeadowRuntime.surfaceMarkerGroup.children) {
      if (SurfacePropObject.userData.swayAmount) {
        const SwayAngle = Math.sin(
          (ElapsedTimeSeconds * 1.55) + SurfacePropObject.userData.swayPhase,
        ) * SurfacePropObject.userData.swayAmount;
        SurfaceSwayQuaternion.setFromAxisAngle(LocalSwayAxis, SwayAngle);
        SurfacePropObject.quaternion.copy(SurfacePropObject.userData.baseQuaternion).multiply(
          SurfaceSwayQuaternion,
        );
      }

      if (SurfacePropObject.userData.kind === 'pond') {
        SurfacePropObject.userData.waterMaterial.emissiveIntensity = 0.4
          + (Math.sin(ElapsedTimeSeconds * 1.8) * 0.08);
      }

      if (SurfacePropObject.userData.kind === 'cottage') {
        SurfacePropObject.userData.windowMaterial.emissiveIntensity = 0.7
          + (Math.sin((ElapsedTimeSeconds * 2.1) + 0.6) * 0.08);
      }
    }

    if (MeadowRuntime.ambientMoteGroup) {
      MeadowRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.09;
      MeadowRuntime.ambientMoteGroup.rotation.z += DeltaTimeSeconds * 0.025;
      MeadowRuntime.ambientMoteGroup.material.opacity = (
        MeadowRuntime.ambientMoteGroup.userData.baseOpacity
        + (Math.sin(ElapsedTimeSeconds * 2.4) * 0.1)
      );
    }
  }

  for (const EmberRuntime of (
    WorldRuntimesByVisualKey.get('ember') ?? EmptyWorldRuntimeList
  )) {
    for (const SurfacePropObject of EmberRuntime.surfaceMarkerGroup.children) {
      const LavaMaterial = SurfacePropObject.userData.lavaMaterial
        ?? SurfacePropObject.userData.heatMaterial;
      if (LavaMaterial && EmberRuntime.definition.restored) {
        const Phase = SurfacePropObject.userData.motionPhase ?? 0;
        const BaseIntensity = SurfacePropObject.userData.kind === 'volcano' ? 2.2 : 1.8;
        LavaMaterial.emissiveIntensity = BaseIntensity
          + (Math.sin((ElapsedTimeSeconds * 4.2) + Phase) * 0.24);
      }
    }
    if (EmberRuntime.ambientMoteGroup) {
      EmberRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.34;
      EmberRuntime.ambientMoteGroup.rotation.z -= DeltaTimeSeconds * 0.09;
    }
  }

  for (const FrostRuntime of (
    WorldRuntimesByVisualKey.get('frost') ?? EmptyWorldRuntimeList
  )) {
    for (const SurfacePropObject of FrostRuntime.surfaceMarkerGroup.children) {
      const CrystalMaterial = SurfacePropObject.userData.crystalMaterial;
      if (CrystalMaterial && FrostRuntime.definition.restored) {
        const Phase = SurfacePropObject.userData.motionPhase ?? 0;
        const BaseIntensity = SurfacePropObject.userData.kind === 'iceArch' ? 0.62 : 0.58;
        CrystalMaterial.emissiveIntensity = BaseIntensity
          + (Math.sin((ElapsedTimeSeconds * 1.25) + Phase) * 0.1);
      }
    }
    if (FrostRuntime.ambientMoteGroup) {
      FrostRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.045;
      FrostRuntime.ambientMoteGroup.rotation.x += DeltaTimeSeconds * 0.018;
    }
  }
}

/**
 * Updates seed animation and trail independent of fixed-step physics.
 *
 * @param {number} DeltaTimeSeconds - Real frame delta.
 * @param {number} ElapsedTimeSeconds - Total elapsed game time.
 */
function updateSeedVisuals(DeltaTimeSeconds, ElapsedTimeSeconds) {
  SeedGroup.position.set(
    SeedPhysicsState.position.x,
    SeedPhysicsState.position.y,
    SeedPhysicsState.position.z,
  );
  RouteLabelProjection.copy(SeedGroup.position).project(Camera);
  GameCanvas.dataset.seedScreenX = String(Math.round(
    (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth,
  ));
  GameCanvas.dataset.seedScreenY = String(Math.round(
    (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
  ));
  GameCanvas.dataset.runnerScreenX = GameCanvas.dataset.seedScreenX;
  GameCanvas.dataset.runnerScreenY = GameCanvas.dataset.seedScreenY;

  const RunnerAnimationState = getRunnerAnimationState(
    GamePhase,
    IsPointerAiming || IsKeyboardAiming,
  );
  const RunnerPose = getRunnerPose(RunnerAnimationState);
  const RunnerForm = getRunnerForm(GamePhase, FlightElapsedSeconds);
  const PoseBlend = PrefersReducedMotion
    ? 1
    : 1 - Math.exp(-DeltaTimeSeconds * 13);
  GameCanvas.dataset.runnerAnimation = RunnerAnimationState;
  GameCanvas.dataset.runnerForm = RunnerForm;
  RunnerVisualGroup.visible = RunnerForm === 'astronaut';
  ShipVisualGroup.visible = RunnerForm !== 'astronaut';
  if (RunnerForm === 'launch-craft') {
    const UnfoldProgress = THREE.MathUtils.clamp(FlightElapsedSeconds / 0.28, 0, 1);
    ShipVisualGroup.scale.set(
      THREE.MathUtils.lerp(0.62, 1.08, UnfoldProgress),
      THREE.MathUtils.lerp(0.82, 1, UnfoldProgress),
      1,
    );
  } else {
    ShipVisualGroup.scale.set(1.08, 1, 1);
  }
  for (const ArmMesh of RunnerArmMeshes) {
    ArmMesh.rotation.z = THREE.MathUtils.lerp(
      ArmMesh.rotation.z,
      ArmMesh.userData.side * -RunnerPose.armAngle,
      PoseBlend,
    );
  }
  for (const LegMesh of RunnerLegMeshes) {
    LegMesh.rotation.z = THREE.MathUtils.lerp(
      LegMesh.rotation.z,
      LegMesh.userData.side * -RunnerPose.legAngle,
      PoseBlend,
    );
  }
  RunnerThrusterGroup.visible = RunnerPose.thrusterVisible;
  if (RunnerPose.thrusterVisible) {
    const Speed = Math.hypot(SeedPhysicsState.velocity.x, SeedPhysicsState.velocity.y);
    const ThrusterScale = 0.76 + Math.min(0.55, Speed * 0.024)
      + (PrefersReducedMotion ? 0 : Math.sin(ElapsedTimeSeconds * 32) * 0.08);
    RunnerThrusterGroup.scale.set(1, ThrusterScale, 1);
  }

  if (GamePhase === 'flying') {
    const FlightAngle = Math.atan2(SeedPhysicsState.velocity.y, SeedPhysicsState.velocity.x);
    RunnerVisualGroup.rotation.z = FlightAngle - (Math.PI * 0.5);
    ShipVisualGroup.rotation.z = FlightAngle - (Math.PI * 0.5);
    ShipVisualGroup.rotation.y = PrefersReducedMotion
      ? 0
      : Math.sin(ElapsedTimeSeconds * 3.2) * 0.08;
    RunnerVisualGroup.rotation.y += DeltaTimeSeconds * 1.8;
    RunnerVisualGroup.rotation.x = THREE.MathUtils.lerp(
      RunnerVisualGroup.rotation.x,
      0,
      PoseBlend,
    );
  } else {
    ShipVisualGroup.rotation.set(0, 0, 0);
    const AttachedBody = getWorldDefinition(CurrentWorldIdentifier)
      ?? TacticalBodyDefinitions.find(
        (BodyDefinition) => BodyDefinition.id === CurrentWorldIdentifier,
      );
    if (AttachedBody?.position) {
      const SurfaceAngle = Math.atan2(
        SeedPhysicsState.position.y - AttachedBody.position.y,
        SeedPhysicsState.position.x - AttachedBody.position.x,
      );
      RunnerVisualGroup.rotation.z = SurfaceAngle - (Math.PI * 0.5);
    }
    RunnerVisualGroup.rotation.y = Math.sin(ElapsedTimeSeconds * 1.7) * 0.08;
    const RecoveryRoll = RunnerAnimationState === 'recovering'
      ? Math.sin(ElapsedTimeSeconds * 18) * 0.5
      : 0;
    RunnerVisualGroup.rotation.x = THREE.MathUtils.lerp(
      RunnerVisualGroup.rotation.x,
      RecoveryRoll,
      PoseBlend,
    );
  }
  SeedHaloMesh.scale.setScalar(1 + (Math.sin(ElapsedTimeSeconds * 4.2) * 0.08));
  SeedHaloMaterial.color.setHex(
    RunnerAnimationState === 'recovering' ? 0xff766d : 0x6de8ff,
  );
  SeedHaloMaterial.opacity = (
    RunnerAnimationState === 'liberating' ? 0.2 : 0.105
  ) + (Math.sin(ElapsedTimeSeconds * 4.2) * 0.025);

  if (LiberationFlashLifeSeconds > 0) {
    LiberationFlashLifeSeconds = Math.max(
      0,
      LiberationFlashLifeSeconds - DeltaTimeSeconds,
    );
    LiberationFlashElement.style.opacity = String(getLiberationFlashOpacity(
      LiberationFlashLifeSeconds,
    ));
  } else {
    LiberationFlashElement.style.opacity = '0';
  }

  if (GamePhase === 'flying') {
    TrailEmissionAccumulatorSeconds += DeltaTimeSeconds;
    while (TrailEmissionAccumulatorSeconds >= 0.036) {
      emitTrailParticle();
      TrailEmissionAccumulatorSeconds -= 0.036;
    }
  }

  updateTrailParticles(DeltaTimeSeconds);

  if (LandingMarkerMesh.visible) {
    LandingMarkerMesh.rotation.z += DeltaTimeSeconds * 1.7;
    const LandingPulseScale = 1 + (Math.sin(ElapsedTimeSeconds * 6) * 0.11);
    LandingMarkerMesh.scale.setScalar(LandingPulseScale);
  }

  if (LaunchPulseLifeSeconds > 0) {
    LaunchPulseLifeSeconds = Math.max(0, LaunchPulseLifeSeconds - DeltaTimeSeconds);
    const LaunchProgress = 1 - (LaunchPulseLifeSeconds / 0.42);
    LaunchPulseMesh.scale.setScalar(1 + (LaunchProgress * 3.4));
    LaunchPulseMesh.material.opacity = (1 - LaunchProgress) * 0.68;
    LaunchPulseMesh.visible = LaunchPulseLifeSeconds > 0;
  }

  if (ImpactPulseLifeSeconds > 0) {
    ImpactPulseLifeSeconds = Math.max(0, ImpactPulseLifeSeconds - DeltaTimeSeconds);
    const ImpactProgress = 1 - (ImpactPulseLifeSeconds / 0.58);
    ImpactPulseMesh.scale.setScalar(1 + (ImpactProgress * 6.2));
    ImpactPulseMesh.material.opacity = (1 - ImpactProgress) * 0.9;
    ImpactPulseMesh.visible = ImpactPulseLifeSeconds > 0;
    SeedGroup.scale.setScalar(1 + (Math.sin(ImpactProgress * Math.PI) * 0.16));
  } else {
    SeedGroup.scale.setScalar(1);
  }

  const IsOpeningCoachVisible = GamePhase === 'attached'
    && CurrentWorldIdentifier === StartingWorldIdentifier
    && !HasLaunchedOnce;
  PullGuideLine.visible = IsOpeningCoachVisible;
  updateTargetBeacons(ElapsedTimeSeconds);
  if (IsOpeningCoachVisible) {
    PullGuideMaterial.dashOffset -= DeltaTimeSeconds * 0.9;
  }
}

/**
 * Adds gentle camera follow while the seed is flying without losing the level overview.
 * This is intentionally restrained for motion comfort on phones.
 *
 * @param {number} DeltaTimeSeconds - Real frame delta.
 */
function setScoutMode(Enabled, { snapToRunner = true } = {}) {
  const CanScout = ActiveSystem.camera?.followPlayer === true
    && GamePhase === 'attached'
    && ReplayPlaybackState === null;
  IsScoutMode = Enabled && CanScout;
  if (IsScoutMode) {
    ScoutCameraTarget.copy(CameraLookTarget);
  } else if (snapToRunner) {
    ScoutCameraTarget.set(SeedPhysicsState.position.x, SeedPhysicsState.position.y, 0);
    ScoutZoomScale = 1;
  }
  ScoutButtonElement.textContent = IsScoutMode ? 'Runner [C]' : 'Scout [C]';
  ScoutButtonElement.setAttribute('aria-pressed', String(IsScoutMode));
  ScoutZoomOutButtonElement.hidden = !IsScoutMode;
  ScoutZoomInButtonElement.hidden = !IsScoutMode;
  GameCanvas.dataset.scoutMode = String(IsScoutMode);
  GameCanvas.classList.toggle('is-scouting', IsScoutMode && IsPointerScouting);
  updatePersonalBestGhostVisibility();
  resizeRenderer();
}

function adjustScoutZoom(Direction) {
  if (!IsScoutMode) setScoutMode(true, { snapToRunner: false });
  if (!IsScoutMode) return false;
  ScoutZoomScale = THREE.MathUtils.clamp(
    ScoutZoomScale + (Math.sign(Direction) * 0.1),
    0.72,
    1.55,
  );
  GameCanvas.dataset.scoutZoom = ScoutZoomScale.toFixed(2);
  resizeRenderer();
  return true;
}

function handleScoutWheel(WheelEventData) {
  if (GamePhase !== 'attached' || ReplayPlaybackState !== null) return;
  if (adjustScoutZoom(WheelEventData.deltaY > 0 ? 1 : -1)) {
    WheelEventData.preventDefault();
  }
}

function updateCamera(DeltaTimeSeconds) {
  const UsesExplorationCamera = ActiveSystem.camera?.followPlayer === true;
  if (UsesExplorationCamera && IsScoutMode) {
    DesiredCameraLookTarget.copy(ScoutCameraTarget);
  } else if (UsesExplorationCamera) {
    DesiredCameraLookTarget.set(
      SeedPhysicsState.position.x,
      SeedPhysicsState.position.y,
      0,
    );
  } else if (GamePhase === 'flying' && !PrefersReducedMotion) {
    DesiredCameraLookTarget.set(
      THREE.MathUtils.clamp(SeedPhysicsState.position.x * 0.12, -1.8, 1.8),
      THREE.MathUtils.clamp(SeedPhysicsState.position.y * 0.12, -1.5, 1.5),
      0,
    );
  } else {
    DesiredCameraLookTarget.set(0, 0, 0);
  }

  const CameraFollowAlpha = PrefersReducedMotion
    ? 1
    : 1 - Math.exp(-DeltaTimeSeconds * (UsesExplorationCamera ? 3.8 : 2.6));
  CameraLookTarget.lerp(DesiredCameraLookTarget, CameraFollowAlpha);

  let CameraShakeX = 0;
  let CameraShakeY = 0;
  if (CameraImpactLifeSeconds > 0 && !PrefersReducedMotion) {
    CameraImpactLifeSeconds = Math.max(0, CameraImpactLifeSeconds - DeltaTimeSeconds);
    const ShakeStrength = (CameraImpactLifeSeconds / 0.24) * 0.13;
    CameraShakeX = Math.sin(GameElapsedTimeSeconds * 93) * ShakeStrength;
    CameraShakeY = Math.cos(GameElapsedTimeSeconds * 77) * ShakeStrength;
  } else {
    CameraImpactLifeSeconds = 0;
  }
  Camera.position.x = (UsesExplorationCamera ? CameraLookTarget.x : 0) + CameraShakeX;
  Camera.position.y = (UsesExplorationCamera ? CameraLookTarget.y : 0) + CameraShakeY;
  Camera.lookAt(CameraLookTarget);
  updateScannerInterface();
}

/**
 * Recalculates camera distance so the full tiny-world system remains visible on portrait
 * phones as well as desktop monitors.
 */
function resizeRenderer() {
  const ViewportWidth = window.innerWidth;
  const ViewportHeight = window.innerHeight;
  const ViewportAspectRatio = ViewportWidth / Math.max(ViewportHeight, 1);

  const DevicePixelRatioCap = getViewportPixelRatioCap(ViewportWidth, ViewportHeight);
  AdaptivePixelRatioCap = Math.min(AdaptivePixelRatioCap, DevicePixelRatioCap);
  applyAdaptivePixelRatio();
  Renderer.setSize(ViewportWidth, ViewportHeight, false);
  GameCanvas.dataset.viewport = `${ViewportWidth}x${ViewportHeight}`;
  GameCanvas.dataset.orientation = ViewportWidth >= ViewportHeight ? 'landscape' : 'portrait';
  Camera.aspect = ViewportAspectRatio;

  const RequiredWorldHeight = ActiveSystem.camera?.viewportWorldHeight ?? 29;
  const RequiredWorldWidth = ActiveSystem.camera?.viewportWorldWidth ?? 25;
  const HalfVerticalFieldOfViewRadians = THREE.MathUtils.degToRad(Camera.fov * 0.5);
  const DistanceForHeight = RequiredWorldHeight / (2 * Math.tan(HalfVerticalFieldOfViewRadians));
  const DistanceForWidth = RequiredWorldWidth / (
    2 * Math.tan(HalfVerticalFieldOfViewRadians) * Math.max(ViewportAspectRatio, 0.2)
  );
  BaseCameraDistance = Math.max(DistanceForHeight, DistanceForWidth, 34);
  Camera.position.z = BaseCameraDistance * (IsScoutMode ? ScoutZoomScale : 1);
  Camera.updateProjectionMatrix();
}

/** Applies presentation-only render quality and publishes it for release diagnostics. */
function applyAdaptivePixelRatio() {
  const RenderedPixelRatio = Math.min(window.devicePixelRatio, AdaptivePixelRatioCap);
  Renderer.setPixelRatio(RenderedPixelRatio);
  GameCanvas.dataset.pixelRatioCap = AdaptivePixelRatioCap.toFixed(2);
  GameCanvas.dataset.pixelRatio = RenderedPixelRatio.toFixed(2);
}

/** Commits one pure adaptive-quality transition without touching game simulation. */
function applyAdaptiveQualityState(QualityState) {
  const DidCapChange = QualityState.cap !== AdaptivePixelRatioCap;
  AdaptivePixelRatioCap = QualityState.cap;
  SmoothPerformanceSampleCount = QualityState.smoothSamples;
  GameCanvas.dataset.adaptiveQuality = QualityState.action;
  GameCanvas.dataset.smoothPerformanceSamples = String(SmoothPerformanceSampleCount);
  if (!DidCapChange) return;
  applyAdaptivePixelRatio();
  Renderer.setSize(window.innerWidth, window.innerHeight, false);
}

/**
 * Publishes a low-frequency render budget snapshot and lowers fill rate on persistently
 * slow devices without changing the deterministic physics or authored scene.
 */
function updatePerformanceBudget(DeltaTimeSeconds) {
  PerformanceSampleElapsedSeconds += DeltaTimeSeconds;
  PerformanceSampleDeltaSeconds += DeltaTimeSeconds;
  PerformanceSampleFrameCount += 1;
  const PreviousMaximumDrawCalls = MaximumObservedDrawCalls;
  MaximumObservedDrawCalls = Math.max(PreviousMaximumDrawCalls, Renderer.info.render.calls);

  if (PerformanceSampleFrameCount === 1 || MaximumObservedDrawCalls > PreviousMaximumDrawCalls) {
    GameCanvas.dataset.drawCalls = String(Renderer.info.render.calls);
    GameCanvas.dataset.maxDrawCalls = String(MaximumObservedDrawCalls);
    GameCanvas.dataset.triangles = String(Renderer.info.render.triangles);
    GameCanvas.dataset.withinDrawCallBudget = String(
      MaximumObservedDrawCalls <= MaximumDrawCallBudget,
    );
  }

  if (PerformanceSampleElapsedSeconds < 2) {
    return;
  }

  const AverageFrameSeconds = PerformanceSampleDeltaSeconds / PerformanceSampleFrameCount;
  GameCanvas.dataset.drawCalls = String(Renderer.info.render.calls);
  GameCanvas.dataset.maxDrawCalls = String(MaximumObservedDrawCalls);
  GameCanvas.dataset.triangles = String(Renderer.info.render.triangles);
  GameCanvas.dataset.frameRate = String(Math.round(1 / Math.max(AverageFrameSeconds, 0.001)));
  GameCanvas.dataset.physicsTime = PhysicsElapsedTimeSeconds.toFixed(3);
  GameCanvas.dataset.withinDrawCallBudget = String(
    MaximumObservedDrawCalls <= MaximumDrawCallBudget,
  );

  applyAdaptiveQualityState(advanceAdaptivePixelRatio(
    {
      cap: AdaptivePixelRatioCap,
      smoothSamples: SmoothPerformanceSampleCount,
    },
    {
      averageFrameSeconds: AverageFrameSeconds,
      deviceCap: getViewportPixelRatioCap(window.innerWidth, window.innerHeight),
      isVisible: document.visibilityState === 'visible',
    },
  ));

  PerformanceSampleElapsedSeconds = 0;
  PerformanceSampleDeltaSeconds = 0;
  PerformanceSampleFrameCount = 0;
}

/**
 * Resets objective state, animations and player position to a deterministic opening shot.
 */
function resetGame() {
  const ShouldRestoreCanvasFocus = !VictoryPanelElement.hidden
    && VictoryPanelElement.contains(document.activeElement);

  if (RecoveryTimeoutIdentifier !== null) {
    window.clearTimeout(RecoveryTimeoutIdentifier);
    RecoveryTimeoutIdentifier = null;
  }
  if (RunFailureTimeoutIdentifier !== null) {
    window.clearTimeout(RunFailureTimeoutIdentifier);
    RunFailureTimeoutIdentifier = null;
  }
  if (StatusToastTimeoutIdentifier !== null) {
    window.clearTimeout(StatusToastTimeoutIdentifier);
    StatusToastTimeoutIdentifier = null;
  }
  if (WorldheartCompletionTimeoutIdentifier !== null) {
    window.clearTimeout(WorldheartCompletionTimeoutIdentifier);
    WorldheartCompletionTimeoutIdentifier = null;
  }

  IsPointerAiming = false;
  IsPointerWalking = false;
  IsPointerScouting = false;
  PointerGestureMode = SurfaceGestureModes.pending;
  IsKeyboardAiming = false;
  IsScoutMode = false;
  ScoutZoomScale = 1;
  FlightElapsedSeconds = 0;
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  ReplayPlaybackState = null;
  ReplayIndicatorElement.hidden = true;
  WatchReplayButtonElement.hidden = true;
  LeaderboardLoadSequence += 1;
  LeaderboardPanelElement.hidden = true;
  VictoryPanelElement.inert = false;
  VictoryPanelElement.removeAttribute('inert');
  VictoryPanelElement.removeAttribute('aria-hidden');
  LeaderboardFormElement.hidden = true;
  SubmitScoreButtonElement.disabled = false;
  ActivePointerIdentifier = null;
  KeyboardAimState = createKeyboardAimState();
  HasLaunchedOnce = false;
  LaunchPulseLifeSeconds = 0;
  ImpactPulseLifeSeconds = 0;
  CameraImpactLifeSeconds = 0;
  LiberationFlashLifeSeconds = 0;
  LaunchPulseMesh.visible = false;
  ImpactPulseMesh.visible = false;
  LiberationFlashElement.style.opacity = '0';
  SeedGroup.scale.setScalar(1);
  RunnerThrusterGroup.visible = false;
  RunnerVisualGroup.visible = true;
  ShipVisualGroup.visible = false;
  RunnerVisualGroup.rotation.set(0, 0, 0);
  Camera.position.x = 0;
  Camera.position.y = 0;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  ScoutButtonElement.textContent = 'Scout [C]';
  ScoutButtonElement.setAttribute('aria-pressed', 'false');
  ScoutZoomOutButtonElement.hidden = true;
  ScoutZoomInButtonElement.hidden = true;
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-locked');
  clearTrajectoryPreview();
  VictoryPanelElement.hidden = true;
  StatusToastElement.classList.remove('is-visible');
  StatusToastElement.classList.remove('is-memory');
  StatusToastElement.textContent = '';
  WorldseedSound.reset();
  resetFlightFeedback();
  GameCanvas.dataset.lastFlightAccolade = '';
  GameCanvas.dataset.lastMemory = '';
  GameCanvas.dataset.lastLaunchVelocityX = '';
  GameCanvas.dataset.lastLaunchVelocityY = '';
  GameCanvas.dataset.lastLaunchTime = '';
  GameCanvas.dataset.lastPredictionVisiblePoints = '';
  GameCanvas.dataset.lastPredictionTotalPoints = '';
  GameCanvas.dataset.lastPredictionOutcomeVisible = '';
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  GameCanvas.dataset.runnerAnimation = 'ready';
  GameCanvas.dataset.runnerForm = 'astronaut';
  GameCanvas.dataset.surfaceAngle = '';
  GameCanvas.dataset.surfaceInput = '';
  GameCanvas.dataset.scoutMode = 'false';
  GameCanvas.dataset.scoutZoom = '1.00';
  GameCanvas.dataset.breakerBurnStep = '';
  GameCanvas.dataset.breakerBurnSpeed = '';
  GameCanvas.dataset.hostileEncounter = '';
  GameCanvas.dataset.hostilePulseReady = 'false';
  GameCanvas.dataset.hostilePylonAngle = '';
  GameCanvas.dataset.lastHostileWorld = '';
  GameCanvas.dataset.commandPulse = '';
  GameCanvas.dataset.lastCircuitBonus = '';
  GameCanvas.dataset.lastBank = '';
  GameCanvas.dataset.lastScoreLost = '';
  GameCanvas.dataset.completionBonus = '';
  GameCanvas.dataset.flightTimeMilliseconds = '0';
  GameCanvas.dataset.isNewPersonalBest = 'false';
  GameCanvas.dataset.contentVersion = ActiveSystem.contentVersion;
  GameCanvas.dataset.assistState = 'ranked';
  GameCanvas.dataset.replayPhysicsVersion = PhysicsModelVersion;
  loadPersonalBestGhost();
  GameCanvas.dataset.replayLaunchCount = '0';
  GameCanvas.dataset.replayOutcome = 'recording';
  GameCanvas.dataset.replayMode = '';
  GameCanvas.dataset.replayPlayedLaunchCount = '0';
  GameCanvas.dataset.replayValidation = '';
  GameCanvas.dataset.replayValidatedScore = '';
  GameCanvas.dataset.onlineSubmission = '';
  GameCanvas.dataset.replayPayload = '';
  GameCanvas.dataset.replayBytes = '0';
  RunState = createRunState(ActiveSystem.launchBudget);
  ScoreState = createScoreState();
  ReplayState = createReplayRecorder({
    systemIdentifier: ActiveSystem.id,
    contentVersion: ActiveSystem.contentVersion,
    fixedStepHz: FixedPhysicsStepHertz,
  });
  RelayNetworkState = createRelayNetworkState(StartingWorldIdentifier);
  synchronizeRelayNetworkVisuals();
  WardenPursuitState = createWardenPursuitState();
  WardenEventPulseStartedAtSeconds = null;
  CommandDefeatStartedAtSeconds = null;
  WardenEventPulseMesh.visible = false;
  WardenEventPulseMaterial.opacity = 0;
  GameCanvas.dataset.wardenVisualBeat = '';
  WardenVisualGroup.position.copy(WardenEntryPosition);
  WardenVisualGroup.rotation.set(0, 0, 0);
  WardenShieldRings.forEach((Ring, RingIndex) => {
    Ring.rotation.x = RingIndex === 0 ? 0 : Math.PI * 0.5;
    Ring.rotation.y = 0;
    Ring.rotation.z = 0;
  });
  WardenApproachStartPosition.copy(WardenEntryPosition);
  GameCanvas.dataset.lastSuppressedWorld = '';
  GameCanvas.dataset.wardenCaughtWorld = '';
  publishWardenState();
  RunFlightTimeSeconds = 0;
  try {
    const PersonalBest = loadPersonalBest(
      window.localStorage,
      ActiveSystem.id,
      ActiveSystem.contentVersion,
    );
    GameCanvas.dataset.personalBest = PersonalBest ? String(PersonalBest.score) : '';
  } catch {
    GameCanvas.dataset.personalBest = '';
  }

  for (const WorldDefinition of WorldDefinitions) {
    const IsInitiallyRestored = WorldDefinition.initiallyRestored === true;
    WorldDefinition.restored = IsInitiallyRestored;
    const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
    WorldRuntime.restorationStartedAtSeconds = IsInitiallyRestored ? -Infinity : null;
    WorldRuntime.restorationCompleted = IsInitiallyRestored;
    WorldRuntime.restorationOriginLocal.set(1, 0, 0);
    WorldRuntime.restorationUniforms.restorationOrigin.value.set(1, 0, 0);
    WorldRuntime.restorationUniforms.restorationProgress.value = IsInitiallyRestored
      ? 1.2
      : -0.1;
    WorldRuntime.restorationWaveMesh.visible = false;
    WorldRuntime.surfaceMaterial.color.set(0xffffff);
    WorldRuntime.atmosphereMaterial.opacity = IsInitiallyRestored
      ? WorldDefinition.restoration.atmosphereOpacity
      : 0.025;
    WorldRuntime.atmosphereMesh.scale.setScalar(IsInitiallyRestored ? 1 : 0.96);
    WorldRuntime.contourRingGroup.visible = IsInitiallyRestored;
    WorldRuntime.contourRingGroup.rotation.set(0, 0, 0);
    WorldRuntime.contourRingGroup.scale.setScalar(1);
    const StillnessPresentation = getStillnessPresentation(IsInitiallyRestored, 1);
    WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
    WorldRuntime.stillnessCageGroup.rotation.set(0, 0, 0);
    WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
    WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
    WorldRuntime.group.rotation.set(0, 0, 0);
    WorldRuntime.group.scale.setScalar(1);
    if (WorldRuntime.ambientMoteGroup) {
      WorldRuntime.ambientMoteGroup.rotation.set(0, 0, 0);
      WorldRuntime.ambientMoteGroup.material.opacity = IsInitiallyRestored
        ? WorldRuntime.ambientMoteGroup.userData.baseOpacity
        : 0;
    }

    for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
      const RestorationProgress = IsInitiallyRestored ? 1 : 0;
      setSurfacePropRestorationProgress(SurfacePropObject, RestorationProgress);
      SurfacePropObject.userData.restorationDistance = IsInitiallyRestored ? 0 : 1;
      SurfacePropObject.scale.setScalar(
        SurfacePropObject.userData.baseScale * (IsInitiallyRestored ? 1 : 0.05),
      );
    }
  }

  for (const TrailParticle of TrailParticlePool) {
    TrailParticle.lifeRemainingSeconds = 0;
    updateTrailParticleInstance(TrailParticle, 0);
  }
  TrailParticleMesh.instanceMatrix.needsUpdate = true;

  const StartingWorldDefinition = getWorldDefinition(StartingWorldIdentifier);
  const FirstTargetWorldDefinition = getWorldDefinition(
    ActiveSystem.openingGuideTargetIdentifier,
  );
  TemporaryThreeVector.set(
    FirstTargetWorldDefinition.position.x - StartingWorldDefinition.position.x,
    FirstTargetWorldDefinition.position.y - StartingWorldDefinition.position.y,
    0,
  ).normalize().multiplyScalar(StartingWorldDefinition.radius + SeedRadius + 0.03);

  const StartingSeedPosition = createVector(
    StartingWorldDefinition.position.x + TemporaryThreeVector.x,
    StartingWorldDefinition.position.y + TemporaryThreeVector.y,
    0,
  );

  SeedPhysicsState = {
    position: StartingSeedPosition,
    velocity: createVector(),
  };
  SeedGroup.position.set(StartingSeedPosition.x, StartingSeedPosition.y, 0);
  CurrentWorldIdentifier = StartingWorldIdentifier;
  if (ActiveSystem.camera?.followPlayer === true) {
    CameraLookTarget.set(StartingSeedPosition.x, StartingSeedPosition.y, 0);
    DesiredCameraLookTarget.copy(CameraLookTarget);
    Camera.position.x = StartingSeedPosition.x;
    Camera.position.y = StartingSeedPosition.y;
    Camera.lookAt(CameraLookTarget);
  }
  publishAttachedSeedState(CurrentWorldIdentifier, StartingSeedPosition);
  LastSafeWorldIdentifier = StartingWorldIdentifier;
  LastSafeSeedPosition = createVector(
    StartingSeedPosition.x,
    StartingSeedPosition.y,
    StartingSeedPosition.z,
  );
  LaunchIgnoredWorldIdentifier = null;
  LaunchIgnoredBodyIdentifier = null;
  SeedstoneUsesRemaining = SeedstoneDefinition.uses;
  SeedstoneCrumbleStartedAtSeconds = null;
  AttachedSeedstoneSurfaceOffset = null;
  AttachedWorldheartSurfaceAngle = null;
  PendingWorldheartBankedPoints = 0;
  WorldheartDefinition.routeAvailable = WorldheartDefinition.routeAvailableInitially === true;
  WorldheartDefinition.restored = WorldheartDefinition.initiallyRestored === true;
  WorldheartJustUnlocked = false;
  FinaleRestorationStartedAtSeconds = null;
  FinaleCoreMesh.visible = false;
  FinaleCoreMesh.scale.setScalar(1);
  FinaleLinkMesh.visible = false;
  FinalePulseMesh.visible = false;
  FinaleSparkMesh.visible = false;
  FinaleLinkMaterial.opacity = 0;
  FinalePulseMaterial.opacity = 0;
  FinaleSparkMaterial.opacity = 0;
  Scene.background.copy(InitialSceneBackgroundColor);
  Renderer.toneMappingExposure = ActiveSystem.environment.toneMappingExposure;
  GameCanvas.dataset.finaleRestoration = '';
  for (const StardustDefinition of StardustDefinitions) {
    StardustDefinition.collected = false;
  }
  PredictedStardustIdentifiers.clear();
  FlightCollectedStardustIdentifiers.clear();
  ActiveHostileEncounterState = null;
  CompletedHostileEncounterWorldIdentifiers.clear();
  HostilePylonGroup.visible = false;
  GamePhase = 'attached';
  updateBreakerBurnInterface();
  PhysicsAccumulatorSeconds = 0;
  PhysicsElapsedTimeSeconds = 0;
  GameElapsedTimeSeconds = 0;
  synchronizeSeedstonePosition();
  synchronizeWorldheartPosition();
  updateScannerInterface();

  TemporaryThreeVector.set(
    StartingWorldDefinition.position.x - FirstTargetWorldDefinition.position.x,
    StartingWorldDefinition.position.y - FirstTargetWorldDefinition.position.y,
    0.14,
  ).normalize();
  const PullGuideStart = new THREE.Vector3(
    StartingSeedPosition.x + (TemporaryThreeVector.x * 0.45),
    StartingSeedPosition.y + (TemporaryThreeVector.y * 0.45),
    0.14,
  );
  const PullGuideEnd = new THREE.Vector3(
    StartingSeedPosition.x + (TemporaryThreeVector.x * 2.7),
    StartingSeedPosition.y + (TemporaryThreeVector.y * 2.7),
    0.14,
  );
  PullGuideGeometry.setFromPoints([PullGuideStart, PullGuideEnd]);
  PullGuideLine.computeLineDistances();
  PullGuideLine.visible = true;

  updateWorldCounter();
  updateLaunchCounter();
  updateScoreInterface();
  updateStardustCounter();
  updateWorldheartObjective();
  updateTargetBeacons(0);
  const OpeningRouteChoices = getRouteChoices(
    CampaignNodeDefinitions,
    StartingWorldIdentifier,
    2,
    ActiveSystem.routeSuggestions[StartingWorldIdentifier] ?? [],
  );
  showInstruction(
    'Choose ' + OpeningRouteChoices[0].label + ' or ' + OpeningRouteChoices[1].label,
    ActiveSystem.openingBody,
  );
  if (ShouldRestoreCanvasFocus) {
    GameCanvas.focus({ preventScroll: true });
  }
}

/** Advances at a completed Worldheart, while keeping the campaign frontier replayable. */
function continueCampaignOrReplay() {
  if (!NextSystemIdentifier) {
    resetGame();
    return;
  }

  const NextSystemUrl = new URL(window.location.href);
  NextSystemUrl.searchParams.set('system', NextSystemIdentifier);
  window.location.assign(NextSystemUrl);
}

function setLeaderboardStatus(Message) {
  LeaderboardStatusElement.textContent = Message;
}

function renderLeaderboardEntries(Entries) {
  LeaderboardListElement.replaceChildren();
  if (Entries.length === 0) {
    const EmptyElement = document.createElement('li');
    EmptyElement.className = 'leaderboard-list__empty';
    EmptyElement.textContent = 'No verified routes yet. The first clean run takes the board.';
    LeaderboardListElement.append(EmptyElement);
    return;
  }
  Entries.forEach((Entry, EntryIndex) => {
    const RowElement = document.createElement('li');
    const RankElement = document.createElement('span');
    RankElement.className = 'leaderboard-list__rank';
    RankElement.textContent = `#${EntryIndex + 1}`;

    const RunnerElement = document.createElement('span');
    RunnerElement.className = 'leaderboard-list__runner';
    const CallsignElement = document.createElement('strong');
    CallsignElement.textContent = typeof Entry.callsign === 'string' ? Entry.callsign : 'RUNNER';
    const DetailElement = document.createElement('small');
    const LaunchesUsed = Number.isInteger(Entry.launchesUsed) ? Entry.launchesUsed : '—';
    const FlightTime = Number.isInteger(Entry.flightTimeMilliseconds)
      ? formatFlightTime(Entry.flightTimeMilliseconds)
      : '—';
    DetailElement.textContent = `${LaunchesUsed} launches · ${FlightTime}`;
    RunnerElement.append(CallsignElement, DetailElement);

    const ScoreElement = document.createElement('strong');
    ScoreElement.className = 'leaderboard-list__score';
    ScoreElement.textContent = Number.isInteger(Entry.score)
      ? Entry.score.toLocaleString('en-GB')
      : '—';

    const WatchButtonElement = document.createElement('button');
    WatchButtonElement.type = 'button';
    WatchButtonElement.textContent = 'Watch';
    WatchButtonElement.disabled = typeof Entry.id !== 'string';
    WatchButtonElement.addEventListener('click', async () => {
      WatchButtonElement.disabled = true;
      setLeaderboardStatus(`Loading ${CallsignElement.textContent}'s verified route…`);
      try {
        const ReplayRecord = await LeaderboardClient.getReplay(Entry.id);
        if (!watchSerializedReplay(
          ReplayRecord.replay,
          `${ReplayRecord.callsign ?? CallsignElement.textContent}'s verified route`,
        )) {
          throw new Error('Remote replay did not validate for this system.');
        }
      } catch (CaughtError) {
        setLeaderboardStatus(CaughtError instanceof Error
          ? CaughtError.message
          : 'Replay could not load.');
        WatchButtonElement.disabled = false;
      }
    });
    RowElement.append(RankElement, RunnerElement, ScoreElement, WatchButtonElement);
    LeaderboardListElement.append(RowElement);
  });
}

async function refreshLeaderboard(LoadSequence) {
  try {
    const Entries = await LeaderboardClient.list({
      systemIdentifier: ActiveSystem.id,
      contentVersion: ActiveSystem.contentVersion,
      limit: 10,
    });
    if (LoadSequence !== LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
      return;
    }
    renderLeaderboardEntries(Entries);
    setLeaderboardStatus(`${Entries.length} verified route${Entries.length === 1 ? '' : 's'} · score, launches, flight time`);
  } catch (CaughtError) {
    if (LoadSequence !== LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
      return;
    }
    renderLeaderboardEntries([]);
    setLeaderboardStatus(CaughtError instanceof Error
      ? CaughtError.message
      : 'Leaderboard could not load.');
  }
}

function openLeaderboardPanel() {
  LeaderboardLoadSequence += 1;
  const LoadSequence = LeaderboardLoadSequence;
  LeaderboardPanelElement.hidden = false;
  VictoryPanelElement.inert = true;
  VictoryPanelElement.setAttribute('inert', '');
  VictoryPanelElement.setAttribute('aria-hidden', 'true');
  const HasVerifiedRun = GameCanvas.dataset.replayValidation === 'verified'
    && GameCanvas.dataset.replayPayload !== ''
    && GameCanvas.dataset.replayMode !== 'complete'
    && GameCanvas.dataset.onlineSubmission !== 'banked';
  LeaderboardFormElement.hidden = !LeaderboardClient.configured || !HasVerifiedRun;
  LeaderboardListElement.replaceChildren();
  try {
    CallsignInputElement.value = window.localStorage.getItem('orbitbreak.callsign') ?? '';
  } catch {
    CallsignInputElement.value = '';
  }
  if (!LeaderboardClient.configured) {
    setLeaderboardStatus('Online board is not connected in this build. Your verified local best is safe.');
    const OfflineElement = document.createElement('li');
    OfflineElement.className = 'leaderboard-list__empty';
    OfflineElement.textContent = 'No endpoint is configured. The game never pretends a local score is online.';
    LeaderboardListElement.append(OfflineElement);
  } else {
    setLeaderboardStatus('Loading verified routes…');
    void refreshLeaderboard(LoadSequence);
  }
  (LeaderboardFormElement.hidden ? CloseLeaderboardButtonElement : CallsignInputElement)
    .focus({ preventScroll: true });
}

function closeLeaderboardPanel(RestoreFocus = true) {
  LeaderboardLoadSequence += 1;
  LeaderboardPanelElement.hidden = true;
  VictoryPanelElement.inert = false;
  VictoryPanelElement.removeAttribute('inert');
  VictoryPanelElement.removeAttribute('aria-hidden');
  if (RestoreFocus && !VictoryPanelElement.hidden) {
    LeaderboardButtonElement.focus({ preventScroll: true });
  }
}

async function submitVerifiedScore(SubmitEvent) {
  SubmitEvent.preventDefault();
  if (
    !LeaderboardClient.configured
    || GameCanvas.dataset.replayValidation !== 'verified'
    || GameCanvas.dataset.replayMode === 'complete'
    || GameCanvas.dataset.onlineSubmission === 'banked'
  ) {
    setLeaderboardStatus('Only a verified completed route can be banked online.');
    return;
  }
  SubmitScoreButtonElement.disabled = true;
  setLeaderboardStatus('Re-simulating route on the leaderboard…');
  try {
    const Submission = await LeaderboardClient.submit({
      callsign: CallsignInputElement.value,
      replay: GameCanvas.dataset.replayPayload,
    });
    try {
      window.localStorage.setItem('orbitbreak.callsign', Submission.entry.callsign);
    } catch {
      // The online result remains valid if callsign convenience storage is unavailable.
    }
    GameCanvas.dataset.onlineSubmission = 'banked';
    LeaderboardFormElement.hidden = true;
    const SuccessMessage = Submission.rank
      ? `Verified and banked at rank #${Submission.rank}.`
      : 'Verified and banked online.';
    setLeaderboardStatus(SuccessMessage);
    const LoadSequence = ++LeaderboardLoadSequence;
    await refreshLeaderboard(LoadSequence);
    if (LoadSequence === LeaderboardLoadSequence && !LeaderboardPanelElement.hidden) {
      setLeaderboardStatus(SuccessMessage);
    }
  } catch (CaughtError) {
    setLeaderboardStatus(CaughtError instanceof Error
      ? CaughtError.message
      : 'Score could not be submitted.');
    SubmitScoreButtonElement.disabled = false;
  }
}

/** Resets the system, then replays a server- or locally-verified input stream. */
function watchSerializedReplay(SerializedReplay, ReplayLabel) {
  const Validation = validateSerializedReplay(SerializedReplay);
  if (
    !Validation.valid
    || Validation.result.systemIdentifier !== ActiveSystem.id
    || Validation.result.contentVersion !== ActiveSystem.contentVersion
  ) {
    return false;
  }
  let CompletedReplay;
  try {
    CompletedReplay = parseReplay(SerializedReplay);
  } catch {
    return false;
  }
  closeLeaderboardPanel(false);
  resetGame();
  ReplayState = CompletedReplay;
  ReplayPlaybackState = createReplayPlaybackState(CompletedReplay);
  GameCanvas.dataset.replayPayload = SerializedReplay;
  GameCanvas.dataset.replayLaunchCount = String(CompletedReplay.launches.length);
  GameCanvas.dataset.replayOutcome = 'playback';
  GameCanvas.dataset.replayMode = 'playing';
  ReplayIndicatorElement.textContent = (
    `WATCHING VERIFIED REPLAY · 0 / ${CompletedReplay.launches.length}`
  );
  ReplayIndicatorElement.hidden = false;
  showInstruction(ReplayLabel, 'Reset at any time to take control.');
  return true;
}

function watchCompletedReplay() {
  if (!watchSerializedReplay(GameCanvas.dataset.replayPayload, 'Verified route replay')) {
    showStatusToast('REPLAY IS NOT VERIFIED', 1200);
  }
}

/** Main frame loop. */
function renderFrame() {
  window.requestAnimationFrame(renderFrame);
  if (!IsPageActive || !IsWebGLContextAvailable) {
    return;
  }

  const DeltaTimeSeconds = Math.min(Clock.getDelta(), MaximumFrameDeltaSeconds);
  GameElapsedTimeSeconds += DeltaTimeSeconds;
  const ElapsedTimeSeconds = GameElapsedTimeSeconds;

  PhysicsAccumulatorSeconds += DeltaTimeSeconds;
  while (PhysicsAccumulatorSeconds >= FixedPhysicsStepSeconds) {
    simulateSeedFixedStep();
    PhysicsAccumulatorSeconds -= FixedPhysicsStepSeconds;
  }

  updateWorldRestorationVisuals(ElapsedTimeSeconds);
  updateOccupationScarVisuals(ElapsedTimeSeconds);
  updateInhabitantVisuals(ElapsedTimeSeconds);
  updateWorldBiomeMotion(DeltaTimeSeconds, ElapsedTimeSeconds);
  updateFinaleRestorationVisuals(ElapsedTimeSeconds);
  updateRelayNetworkVisuals(ElapsedTimeSeconds);
  updateWardenVisuals(DeltaTimeSeconds, ElapsedTimeSeconds);
  updateSeedVisuals(DeltaTimeSeconds, ElapsedTimeSeconds);
  updateCamera(DeltaTimeSeconds);
  updateTacticalBodies(ElapsedTimeSeconds);
  updateStardustVisuals(ElapsedTimeSeconds);
  updateRouteLabels();
  updateFlightAudio();
  updatePersonalBestGhostVisibility();

  Renderer.render(Scene, Camera);
  updatePerformanceBudget(DeltaTimeSeconds);
}

GameCanvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
GameCanvas.addEventListener('pointermove', handlePointerMove, { passive: false });
GameCanvas.addEventListener('pointerup', handlePointerUp, { passive: false });
GameCanvas.addEventListener('pointercancel', handlePointerCancel, { passive: false });
GameCanvas.addEventListener('wheel', handleScoutWheel, { passive: false });
window.addEventListener('resize', resizeRenderer);
window.addEventListener('orientationchange', () => {
  window.setTimeout(resizeRenderer, 120);
});

/** Pauses or resumes frame/audio work and safely cancels any half-finished aim. */
function setPageActivity(IsActive) {
  IsPageActive = IsActive;
  GameCanvas.dataset.pageActive = String(IsPageActive);
  WorldseedSound.setPageActive(IsPageActive && IsWebGLContextAvailable);
  if (IsPageActive) {
    Clock.getDelta();
    resizeRenderer();
  } else if (IsPointerAiming || IsKeyboardAiming || IsPointerWalking || IsPointerScouting) {
    const CanceledPointerIdentifier = ActivePointerIdentifier;
    IsPointerAiming = false;
    IsPointerWalking = false;
    IsPointerScouting = false;
    IsKeyboardAiming = false;
    ActivePointerIdentifier = null;
    GameCanvas.dataset.keyboardAimAngle = '';
    GameCanvas.dataset.keyboardAimPower = '';
    if (
      CanceledPointerIdentifier !== null
      && GameCanvas.hasPointerCapture(CanceledPointerIdentifier)
    ) {
      GameCanvas.releasePointerCapture(CanceledPointerIdentifier);
    }
    GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
    AimPanelElement.hidden = true;
    clearTrajectoryPreview();
    WorldseedSound.endAim();
    showInstruction('Aim again', 'Your shot was canceled while the game was in the background.');
  }
}

/** Applies a user or OS motion preference to presentation only. */
function applyMotionPreference({ persist = false } = {}) {
  PrefersReducedMotion = resolveReducedMotion(
    MotionPreference,
    ReducedMotionMediaQuery.matches,
  );
  GameCanvas.dataset.motionPreference = MotionPreference;
  GameCanvas.dataset.reducedMotion = String(PrefersReducedMotion);
  const MotionPresentation = getMotionPreferencePresentation(
    MotionPreference,
    PrefersReducedMotion,
  );
  MotionButtonElement.textContent = MotionPresentation.label;
  MotionButtonElement.setAttribute('aria-pressed', MotionPresentation.ariaPressed);
  MotionButtonElement.setAttribute(
    'aria-label',
    `Motion preference: ${MotionPreference}. Activate to choose the next mode.`,
  );

  if (persist) {
    try {
      window.localStorage.setItem('orbitbreak.motion', MotionPreference);
    } catch {
      // The active preference still works when storage is unavailable.
    }
  }
  if (!PrefersReducedMotion) return;

  CameraImpactLifeSeconds = 0;
  if (ActiveSystem.camera?.followPlayer === true) {
    DesiredCameraLookTarget.set(SeedPhysicsState.position.x, SeedPhysicsState.position.y, 0);
    CameraLookTarget.copy(DesiredCameraLookTarget);
    Camera.position.x = CameraLookTarget.x;
    Camera.position.y = CameraLookTarget.y;
  } else {
    DesiredCameraLookTarget.set(0, 0, 0);
    CameraLookTarget.set(0, 0, 0);
    Camera.position.x = 0;
    Camera.position.y = 0;
  }
  Camera.lookAt(CameraLookTarget);
}

function selectNextMotionPreference() {
  MotionPreference = cycleMotionPreference(MotionPreference);
  applyMotionPreference({ persist: true });
  showStatusToast(
    MotionPreference === MotionPreferences.system
      ? 'MOTION FOLLOWS SYSTEM'
      : `MOTION ${MotionPreference.toUpperCase()}`,
    850,
  );
}

/** Localhost-only hooks make browser release diagnostics reproducible and non-public. */
function runReleaseDiagnostic(DiagnosticKind) {
  if (!IsReleaseDiagnosticsEnabled) return false;
  if (DiagnosticKind === 'background') {
    GameCanvas.dataset.backgroundDiagnostic = 'inactive';
    setPageActivity(false);
    window.setTimeout(() => {
      setPageActivity(true);
      GameCanvas.dataset.backgroundDiagnostic = 'restored';
    }, 320);
    return true;
  }
  if (DiagnosticKind === 'graphics') {
    const LoseContextExtension = Renderer.getContext().getExtension('WEBGL_lose_context');
    if (!LoseContextExtension) {
      GameCanvas.dataset.graphicsDiagnostic = 'unsupported';
      showStatusToast('GRAPHICS DIAGNOSTIC UNSUPPORTED', 1100);
      return true;
    }
    GameCanvas.dataset.graphicsDiagnostic = 'losing';
    LoseContextExtension.loseContext();
    window.setTimeout(() => LoseContextExtension.restoreContext(), 420);
    return true;
  }
  if (DiagnosticKind === 'performance') {
    const DevicePixelRatioCap = getViewportPixelRatioCap(
      window.innerWidth,
      window.innerHeight,
    );
    let DiagnosticQualityState = advanceAdaptivePixelRatio(
      { cap: AdaptivePixelRatioCap, smoothSamples: 0 },
      { averageFrameSeconds: 1 / 20, deviceCap: DevicePixelRatioCap, isVisible: true },
    );
    applyAdaptiveQualityState(DiagnosticQualityState);
    GameCanvas.dataset.performanceDiagnostic = DiagnosticQualityState.action;
    window.setTimeout(() => {
      for (
        let SampleIndex = 0;
        SampleIndex < SmoothSamplesBeforeUpgrade;
        SampleIndex += 1
      ) {
        DiagnosticQualityState = advanceAdaptivePixelRatio(
          DiagnosticQualityState,
          { averageFrameSeconds: 1 / 60, deviceCap: DevicePixelRatioCap, isVisible: true },
        );
      }
      applyAdaptiveQualityState(DiagnosticQualityState);
      GameCanvas.dataset.performanceDiagnostic = DiagnosticQualityState.action;
    }, 420);
    return true;
  }
  return false;
}

document.addEventListener('visibilitychange', () => {
  setPageActivity(!document.hidden);
});
GameCanvas.addEventListener('webglcontextlost', (ContextEvent) => {
  ContextEvent.preventDefault();
  IsWebGLContextAvailable = false;
  GameCanvas.dataset.webglAvailable = 'false';
  if (IsReleaseDiagnosticsEnabled) GameCanvas.dataset.graphicsDiagnostic = 'lost';
  WorldseedSound.setPageActive(false);
  showStatusToast('RESTORING GRAPHICS', 1800);
});
GameCanvas.addEventListener('webglcontextrestored', () => {
  IsWebGLContextAvailable = true;
  GameCanvas.dataset.webglAvailable = 'true';
  if (IsReleaseDiagnosticsEnabled) GameCanvas.dataset.graphicsDiagnostic = 'restored';
  Clock.getDelta();
  Renderer.resetState();
  resizeRenderer();
  WorldseedSound.setPageActive(IsPageActive);
  showStatusToast('GRAPHICS RESTORED', 900);
});
ReducedMotionMediaQuery.addEventListener('change', () => {
  applyMotionPreference();
});
window.addEventListener('keydown', (KeyboardEventData) => {
  if (KeyboardEventData.key === 'Escape' && !LeaderboardPanelElement.hidden) {
    KeyboardEventData.preventDefault();
    closeLeaderboardPanel();
    return;
  }
  const ActiveModalElement = !LeaderboardPanelElement.hidden
    ? LeaderboardPanelElement
    : (!VictoryPanelElement.hidden ? VictoryPanelElement : null);
  if (KeyboardEventData.key === 'Tab' && ActiveModalElement) {
    const FocusableElements = [...ActiveModalElement.querySelectorAll('input, button')]
      .filter((Element) => !Element.disabled && !Element.hidden && Element.offsetParent !== null);
    const FirstFocusableElement = FocusableElements[0];
    const LastFocusableElement = FocusableElements.at(-1);
    if (
      KeyboardEventData.shiftKey
      && document.activeElement === FirstFocusableElement
    ) {
      KeyboardEventData.preventDefault();
      LastFocusableElement?.focus();
    } else if (
      !KeyboardEventData.shiftKey
      && document.activeElement === LastFocusableElement
    ) {
      KeyboardEventData.preventDefault();
      FirstFocusableElement?.focus();
    }
    return;
  }
  const PressedKey = KeyboardEventData.key.toLowerCase();
  if (PressedKey === ' ' && ActiveHostileEncounterState) {
    KeyboardEventData.preventDefault();
    requestBreakerPulse();
    return;
  }
  if (PressedKey === ' ' && GamePhase === 'flying') {
    KeyboardEventData.preventDefault();
    requestBreakerBurn();
    return;
  }
  if (PressedKey === 'c' && !KeyboardEventData.repeat) {
    KeyboardEventData.preventDefault();
    setScoutMode(!IsScoutMode, { snapToRunner: IsScoutMode });
    return;
  }
  if (PressedKey === 'g' && !KeyboardEventData.shiftKey && !KeyboardEventData.repeat) {
    KeyboardEventData.preventDefault();
    setPersonalBestGhostEnabled(!IsPersonalBestGhostEnabled, { announce: true });
    return;
  }
  if (IsScoutMode && (PressedKey === '+' || PressedKey === '=' || PressedKey === '-')) {
    KeyboardEventData.preventDefault();
    adjustScoutZoom(PressedKey === '-' ? 1 : -1);
    return;
  }
  if (IsReleaseDiagnosticsEnabled && KeyboardEventData.shiftKey) {
    if (PressedKey === 'b' || PressedKey === 'g' || PressedKey === 'f') {
      KeyboardEventData.preventDefault();
      runReleaseDiagnostic(
        PressedKey === 'b'
          ? 'background'
          : (PressedKey === 'g' ? 'graphics' : 'performance'),
      );
      return;
    }
  }
  if (handleKeyboardAimKey(KeyboardEventData)) {
    return;
  }
  if (
    KeyboardEventData.repeat
    || KeyboardEventData.ctrlKey
    || KeyboardEventData.metaKey
    || KeyboardEventData.altKey
  ) {
    return;
  }

  if (PressedKey === 'r') {
    KeyboardEventData.preventDefault();
    resetGame();
  } else if (PressedKey === 'm') {
    KeyboardEventData.preventDefault();
    const IsMuted = WorldseedSound.toggleMute();
    AudioButtonElement.textContent = IsMuted ? 'Audio off [M]' : 'Audio on [M]';
    AudioButtonElement.setAttribute('aria-pressed', String(IsMuted));
  } else if (PressedKey === 'p') {
    KeyboardEventData.preventDefault();
    selectNextMotionPreference();
  }
});
document.addEventListener('focusin', (FocusEventData) => {
  const ActiveModalElement = !LeaderboardPanelElement.hidden
    ? LeaderboardPanelElement
    : (!VictoryPanelElement.hidden ? VictoryPanelElement : null);
  if (!ActiveModalElement || ActiveModalElement.contains(FocusEventData.target)) {
    return;
  }
  ActiveModalElement.querySelector('input:not([disabled]), button:not([disabled])')
    ?.focus({ preventScroll: true });
});
ResetButtonElement.addEventListener('click', resetGame);
ReplayButtonElement.addEventListener('click', resetGame);
WatchReplayButtonElement.addEventListener('click', watchCompletedReplay);
LeaderboardButtonElement.addEventListener('click', openLeaderboardPanel);
LeaderboardFormElement.addEventListener('submit', submitVerifiedScore);
CloseLeaderboardButtonElement.addEventListener('click', () => closeLeaderboardPanel());
PlayAgainButtonElement.addEventListener('click', continueCampaignOrReplay);
AudioButtonElement.addEventListener('click', () => {
  const IsMuted = WorldseedSound.toggleMute();
  AudioButtonElement.textContent = IsMuted ? 'Audio off [M]' : 'Audio on [M]';
  AudioButtonElement.setAttribute('aria-pressed', String(IsMuted));
});
MotionButtonElement.addEventListener('click', selectNextMotionPreference);
ScoutButtonElement.addEventListener('click', () => {
  setScoutMode(!IsScoutMode, { snapToRunner: IsScoutMode });
});
ScoutZoomOutButtonElement.addEventListener('click', () => adjustScoutZoom(1));
ScoutZoomInButtonElement.addEventListener('click', () => adjustScoutZoom(-1));
GhostButtonElement.addEventListener('click', () => {
  setPersonalBestGhostEnabled(!IsPersonalBestGhostEnabled, { announce: true });
});
BurnButtonElement.addEventListener('click', requestBreakerAction);

createLighting();
createStarField();
resizeRenderer();
resetGame();
applyMotionPreference();
renderFrame();
