import * as THREE from 'three';

import { WorldseedAudio } from './audio.js?v=20260815-ob87';
import {
  SurfaceGestureModes,
  adjustSurfaceAngle,
  adjustKeyboardAimState,
  createKeyboardAimState,
  findNearestKeyboardAimAngle,
  getKeyboardAimDragVector,
  getPinchZoomScale,
  getPointerClientDistance,
  getScoutZoomPresentation,
  getSurfacePosition,
  shouldCancelAimedLaunch,
} from './controls.js?v=20260815-ob84';
import {
  createHostileEncounterState,
  getCutEndPoint,
  getCutHits,
  getHostileEncounterAngularDistance,
  getHostileEncounterMoveDirection,
  getLeftoverHostileEncounter,
  getNearestClampCut,
  getRemainingClamps,
  resolveHostileCut,
} from './encounter.js?v=20260815-ob87';
import {
  MotionPreferences,
  cycleMotionPreference,
  getAudioPreferencePresentation,
  getMotionPreferencePresentation,
  parseMotionPreference,
  resolveReducedMotion,
} from './preferences.js?v=20260815-ob60';
import {
  SmoothSamplesBeforeUpgrade,
  advanceAdaptivePixelRatio,
  getAdaptivePresentationTier,
  getViewportPixelRatioCap,
} from './performance.js?v=20260814-ob13';
import { addEnvironment } from './environment.js?v=20260815-ob89';
import { createWorldVisuals } from './world-geometry.js?v=20260815-ob90';
import { createLivingWorldVisuals } from './living-world-visuals.js?v=20260815-ob90';
import { createWardenVisuals } from './warden-visuals.js?v=20260815-ob90';
import { createPlayerVisuals } from './player-visuals.js?v=20260815-ob90';
import { createStoryDirector } from './story-director.js?v=20260815-ob90';
import { createHud } from './hud.js?v=20260815-ob90';
import { createAimPreview } from './aim-preview.js?v=20260815-ob90';

import {
  DefaultAuthoredSystemIdentifier,
  createAuthoredSystemRuntime,
  getAuthoredSystemDefinition,
  getNextAuthoredSystemIdentifier,
} from './content.js?v=20260815-ob88';

import {
  countRestoredWorlds,
  getLandingAccolade,
  getRestorableWorlds,
  getRouteChoices,
  getSystemEmblems,
  getTrajectoryPickupIdentifiers,
  isSystemRestored,
  isWorldheartUnlocked,
} from './campaign.js?v=20260814-ob8';

import {
  MaximumLaunchSpeed,
  applyBreakerBurn,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  predictTrajectory,
  simulatePhysicsStep,
} from './physics.js?v=20260815-ob83';
import {
  FixedPhysicsStepHertz,
  FixedPhysicsStepSeconds,
  RunnerRadius,
  StardustCollectionRadius,
  StardustPickupRadius,
} from './sim-constants.js?v=20260815-ob89';
import {
  getSectorWardenRevealFlag,
  isFurtherReachLive,
  isInnerClusterLive,
} from './sector.js?v=20260815-ob89';
import {
  advanceSimulatedFlightStep,
  calculateSurfaceRestPosition as calculateSharedSurfaceRestPosition,
  collectFlightStardust,
  resolveWardenAfterNonCommandFlight,
  rollbackFlightStardust as rollbackSharedFlightStardust,
} from './flight-resolver.js?v=20260815-ob89';
import { createLeaderboardClient } from './leaderboard-client.js?v=20260814-ob9';
import {
  connectRelayWorlds,
  countLiveRelayWorlds,
  createRelayNetworkState,
  findCircuitBeaconLink,
  getRelayDegree,
  isRelayWorldLive,
  listLiveRelayCircuits as listAuthoredLiveRelayCircuits,
  listLiveRelayLinks as listAuthoredLiveRelayLinks,
  listProtectedRelayWorlds,
  listRelayCircuits,
  listRelayLinks,
  wouldCloseRelayCircuit,
} from './network.js?v=20260815-ob87';
import {
  WardenPursuitEvents,
  createWardenPursuitState,
} from './warden.js?v=20260815-ob81';
import {
  createRunResult,
  loadPersonalBest,
  savePersonalBest,
} from './records.js?v=20260814-ob8';
import {
  getExtractionFreighterTravelProgress,
  getCourierDockWorldRole,
  getHiddenWardenRouteCoach,
  getInhabitantSilhouette,
  getLandedCameraScale,
  getLiberationFlashOpacity,
  getLeaderboardActionLabel,
  getLoopObjectivePresentation,
  getLiveLinkShipCount,
  getStoryBoardPresentation,
  getTriggeredCampaignStoryBoardIds,
  isCampaignStoryBoardReadyToPresent,
  getPersonalBestStatus,
  getPlayfieldLabelVerticalBounds,
  getProsperityBuildingKind,
  getProsperityBuildingProfile,
  getProsperityPresence,
  getProsperityStage,
  getPublishedWardenState,
  getRangeVeilStrength,
  getRelayCourierTravelProgress,
  getPlanningAtmosphere,
  getPlanningFocusWorldIdentifiers,
  PlanningMaximumZoomScale,
  PlanningMinimumZoomScale,
  getRelayLinkOpacity,
  getRelayRevealHoldDurationSeconds,
  getRelayRevealLookTarget,
  getRunUnlockState,
  getSectorPlanningCamera,
  shouldAssistCommandLock,
  shouldHoldCommittedPrediction,
  getRunResourceSummary,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
  getScannerAccessibleLabel,
  getSlingshotBandVisualState,
  getSlingshotPreviewPresentation,
  getStillnessPresentation,
  shouldShowInhabitantSlot,
  getTradeHullColor,
  getTradeHullKind,
  getTradeHullScale,
  getTyrantOccupationStrength,
  getWorldLifeAudioMix,
  getStoryMusicStage,
  getWorldLifeStage,
  getTacticalLabelHorizontalMargin,
  getWorldLandingAimLabel,
  separateOverlappingRouteLabels,
  separateOverlappingTacticalLabels,
  separateRouteLabelsFromTacticalLabels,
} from './presentation.js?v=20260815-ob88';
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
} from './replay.js?v=20260815-ob83';
import { getReplayGhostWaypoints } from './ghost.js?v=20260815-ob23';
import {
  consumeDueReplayBurn,
  consumeDueReplayLaunch,
  createReplayPlaybackState,
} from './replay-playback.js?v=20260815-ob83';
import { validateSerializedReplay } from './replay-validator.js?v=20260815-ob83';
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
  getSlingshotBandRadii,
  predictSlingshotEvents,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from './scoring.js?v=20260815-ob79';

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
const FirstRelayAnswerLine = '“Is someone there?”';
const SecondRelayAnswerLine = '“We thought we were alone.”';

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
const ObjectiveLabelElement = document.querySelector('#ObjectiveLabel');
const ObjectiveStateElement = document.querySelector('#ObjectiveState');
const ObjectivePipsElement = document.querySelector('#ObjectivePips');
const WardenPanelElement = document.querySelector('#WardenPanel');
const WardenStateLabelElement = document.querySelector('#WardenStateLabel');
const WardenDistanceElement = document.querySelector('#WardenDistance');
const WardenTargetElement = document.querySelector('#WardenTarget');
let ObjectivePipElements = [];
const InstructionPanelElement = document.querySelector('#InstructionPanel');
const InstructionTitleElement = document.querySelector('#InstructionTitle');
const InstructionBodyElement = document.querySelector('#InstructionBody');
const OpeningBriefingElement = document.querySelector('#OpeningBriefing');
const BriefingKickerElement = document.querySelector('#BriefingKicker');
const BriefingPortraitElement = document.querySelector('#BriefingPortrait');
const BriefingSpeakerElement = document.querySelector('#BriefingSpeaker');
const BriefingTitleElement = document.querySelector('#BriefingTitle');
const BriefingBodyElement = document.querySelector('#BriefingBody');
const BriefingProgressElement = document.querySelector('#BriefingProgress');
const BriefingContinueButtonElement = document.querySelector('#BriefingContinueButton');
const BriefingSkipButtonElement = document.querySelector('#BriefingSkipButton');
const AimPanelElement = document.querySelector('#AimPanel');
const AimLabelElement = document.querySelector('#AimLabel');
const AimPowerFillElement = document.querySelector('#AimPowerFill');
const AimPowerValueElement = document.querySelector('#AimPowerValue');
const StatusToastElement = document.querySelector('#StatusToast');
const ReplayIndicatorElement = document.querySelector('#ReplayIndicator');
const RouteLabelElements = [...document.querySelectorAll('.route-label')];
const TacticalLabelElements = [...document.querySelectorAll('.tactical-label')];
const VictoryPanelElement = document.querySelector('#VictoryPanel');
const ResultActionsElement = VictoryPanelElement.querySelector('.result-actions');
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
const ScoutZoomStatusElement = document.querySelector('#ScoutZoomStatus');
const GhostButtonElement = document.querySelector('#GhostButton');
const BurnButtonElement = document.querySelector('#BurnButton');
configureSystemInterface();
GameCanvas.dataset.build = '20260815-ob88';
GameCanvas.dataset.system = ActiveSystem.id;
GameCanvas.dataset.leaderboardConfigured = String(LeaderboardClient.configured);
GameCanvas.dataset.pageActive = String(!document.hidden);
GameCanvas.dataset.webglAvailable = 'true';

/** Fixed-step physics makes live movement and trajectory prediction agree across frame rates. */
const SeedRadius = RunnerRadius;
const MaximumFrameDeltaSeconds = 0.05;
const MaximumDragDistance = 6.25;
const LaunchVelocityPerDragUnit = MaximumLaunchSpeed / MaximumDragDistance;
GameCanvas.dataset.maxLaunchSpeed = String(MaximumLaunchSpeed);
const MinimumLaunchDragDistance = 0.22;
const LaunchCancelRadius = 0.85;
const MaximumTrajectoryPredictionSteps = 720;
const TrajectoryPreviewSampleStride = 5;
GameCanvas.dataset.rankedPredictionSteps = String(MaximumTrajectoryPredictionSteps);
const OutOfBoundsDistance = ActiveSystem.camera?.outOfBoundsDistance ?? 34;
const StartingWorldIdentifier = ActiveSystem.startingWorldIdentifier;
GameCanvas.dataset.currentNode = StartingWorldIdentifier;
const MaximumDrawCallBudget = 190;
const WorldheartUnlockThreshold = ActiveSystem.worldheartUnlockThreshold;
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

const Camera = new THREE.PerspectiveCamera(42, 1, 0.1, 480);
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
const TacticalLabelScreenPositions = [];

let PhysicsAccumulatorSeconds = 0;
let PhysicsElapsedTimeSeconds = 0;
let GameElapsedTimeSeconds = 0;
let RunFlightTimeSeconds = 0;
let IsPageActive = !document.hidden;
let IsWebGLContextAvailable = true;
let AdaptivePixelRatioCap = 2;
let SmoothPerformanceSampleCount = 0;
let PresentationQualityTier = 'high';
let CachedInstructionPanelTop = 0;
let FrameLiveRelayLinks = null;
let FrameLiveRelayCircuits = null;
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
const CameraPanOffset = new THREE.Vector3();
const PanOffsetStart = new THREE.Vector3();
let CameraZoomScale = 1;
let AimZoomScale = 1;
const PointerByIdentifier = new Map();
let PinchState = null;
let IsBurnAiming = false;
let BurnAimDirection = null;
let HasTaughtBurn = false;
let IsCutAiming = false;
let CutAimPointer = null;
let IsKeyboardAiming = false;
let ActivePointerIdentifier = null;
let KeyboardAimState = createKeyboardAimState();
let IsScoutMode = false;
let RelayRevealLookTarget = null;
let RelayRevealHoldUntilSeconds = 0;
let LastPlanningPathPoints = [];
let LastPredictedBodyIdentifier = '';
let CommittedPredictionPoints = null;
let RecaptureCutGiftAvailable = false;
let PendingRecaptureCutWorldIdentifier = null;
let HasAnnouncedCommandLockGift = false;
const CourierStartTimesByLinkId = new Map();
const MinimumScoutZoomScale = PlanningMinimumZoomScale;
const MaximumScoutZoomScaleOpen = PlanningMaximumZoomScale;
const MaximumScoutZoomScaleVeiled = 2.45;
let ScoutZoomScale = 1;
let IsPersonalBestGhostEnabled = false;
let HasPersonalBestGhost = false;
let BaseCameraDistance = 42;
let CameraDistanceScale = 1;
let PlanningCameraScale = 1;
let RunnerWalkLifeSeconds = 0;
let AimInteractionCamera = null;
const PlanningCameraLookTarget = new THREE.Vector3();
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
let OpeningBriefingPageIndex = 0;
let IsOpeningBriefingActive = false;
let ActiveStoryBoardId = null;
let ActiveStoryBoardTokens = {};
let StoryBoardQueue = [];
const ShownStoryBoardIds = new Set();
let PendingRunResetAfterStoryBoard = false;
let PendingVictoryAfterStoryBoard = false;
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
const PredictedSlingshotWorldIdentifiers = new Set();
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
let LastScannerAccessibleLabel = '';
configureScannerInterface();

const WorldRuntimeByIdentifier = new Map();
const WorldRuntimesByVisualKey = new Map();
const EmptyWorldRuntimeList = [];
const ShaderMotionVisualKeys = ['grove', 'tide'];
const TyrantAtmosphereColor = new THREE.Color(0x5a2418);
const AtmosphereRestoreColor = new THREE.Color();
const RestorableWorldCount = getRestorableWorlds(WorldDefinitions).length;
const IsCampaignFinale = ActiveSystem.finale?.isCampaignFinale === true;
const InitialSceneBackgroundColor = ActiveSystem.environment.backgroundColor.clone();

/** Builds system-specific objective and completion UI from authored content. */
function configureSystemInterface() {
  VictoryEyebrowElement.textContent = ActiveSystem.completion.eyebrow;
  VictoryTitleElement.textContent = ActiveSystem.completion.title;
  VictoryBodyElement.textContent = ActiveSystem.completion.body;
  LeaderboardButtonElement.textContent = getLeaderboardActionLabel(LeaderboardClient.configured);
  ConstellationSummaryElement.setAttribute(
    'aria-label',
    `${ActiveSystem.label} constellation summary`,
  );
  EmblemRowElement.setAttribute('aria-label', `${ActiveSystem.label} emblems`);
  const EmblemCopy = ActiveSystem.completion.emblems ?? {
    heart: { title: 'HEART', subtitle: 'RECONNECTED' },
    bloom: { title: 'BLOOM', subtitle: 'ALL WORLDS' },
    arc: { title: 'ARC', subtitle: '3 STARDUST' },
  };
  for (const EmblemElement of EmblemElements) {
    const Copy = EmblemCopy[EmblemElement.dataset.emblem];
    EmblemElement.querySelector('strong').textContent = Copy.title;
    EmblemElement.querySelector('small').textContent = Copy.subtitle;
  }
  const CanContinueToNextSystem = Boolean(NextSystemIdentifier)
    && ActiveSystem.completion.continueToNextSystem !== false;
  PlayAgainButtonElement.textContent = CanContinueToNextSystem
    ? `Continue to ${getAuthoredSystemDefinition(NextSystemIdentifier).label}`
    : '';
  PlayAgainButtonElement.hidden = !CanContinueToNextSystem;
  ResultActionsElement.classList.toggle('result-actions--terminal', !CanContinueToNextSystem);

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
  const CurrentWorld = getWorldDefinition(CurrentWorldIdentifier);
  const PublishedWardenState = getPublishedWardenState(
    WardenPursuitState.status,
    WorldheartDefinition.restored,
  );
  const WardenTarget = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  const ScannerAccessibleLabel = getScannerAccessibleLabel({
    runnerLocation: GamePhase === 'flying'
      ? 'in flight'
      : `at ${CurrentWorld?.label ?? 'an unknown world'}`,
    activeWorldCount: countLiveRelayWorlds(RelayNetworkState),
    worldCount: WorldDefinitions.length,
    wardenStatus: PublishedWardenState.status,
    wardenDistance: WardenPursuitState.distance,
    wardenTargetLabel: WardenTarget?.label ?? '',
  });
  if (ScannerAccessibleLabel !== LastScannerAccessibleLabel) {
    ScannerPanelElement.setAttribute('aria-label', ScannerAccessibleLabel);
    LastScannerAccessibleLabel = ScannerAccessibleLabel;
  }
  GameCanvas.dataset.scannerRunnerX = RunnerPosition.x.toFixed(1);
  GameCanvas.dataset.scannerRunnerY = RunnerPosition.y.toFixed(1);
}

const EnvironmentLights = addEnvironment(THREE, Scene, ActiveSystem.environment);
const KeyLight = EnvironmentLights.keyLight;

const WorldVisuals = createWorldVisuals(THREE, Scene, {
  worldDefinitions: WorldDefinitions,
  worldRuntimeByIdentifier: WorldRuntimeByIdentifier,
  worldRuntimesByVisualKey: WorldRuntimesByVisualKey,
});
const { setSurfacePropRestorationProgress } = WorldVisuals;


const LivingWorldVisuals = createLivingWorldVisuals(THREE, Scene, {
  WorldDefinitions,
  SeedRadius,
  WorldRuntimeByIdentifier,
  GameCanvas,
  CourierStartTimesByLinkId,
  PredictedSlingshotWorldIdentifiers,
  WorldheartDefinition,
  LaunchBudget: ActiveSystem.launchBudget,
  getWorldDefinition,
  getFrameLiveRelayLinks,
  getFrameLiveRelayCircuits,
  isWorldInLiveCircuit,
  get IsPointerAiming() { return IsPointerAiming; },
  get IsKeyboardAiming() { return IsKeyboardAiming; },
  get GamePhase() { return GamePhase; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get ScoreState() { return ScoreState; },
  get RelayNetworkState() { return RelayNetworkState; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RecaptureCutGiftAvailable() { return RecaptureCutGiftAvailable; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get FinaleRestorationStartedAtSeconds() { return FinaleRestorationStartedAtSeconds; },
});
const {
  updateSlingshotBandVisuals,
  updateOccupationScarVisuals,
  updateExtractionFreighterVisuals,
  refreshDockedTradeState,
  updateProsperityBuildingVisuals,
  updateInhabitantVisuals,
  publishRelayNetworkState,
  publishRunUnlockState,
  synchronizeRelayNetworkVisuals,
  updateRelayNetworkVisuals,
  updateLivingWorldVisuals,
  resetLivingWorldVisuals,
  circuitBeaconLine: CircuitBeaconLine,
  circuitBeaconMaterial: CircuitBeaconMaterial,
} = LivingWorldVisuals;


const WardenVisuals = createWardenVisuals(THREE, Scene, {
  WorldheartDefinition,
  GameCanvas,
  getWorldDefinition,
  projectScannerPosition,
  ScannerWardenElement,
  get ScannerProjection() { return ScannerProjection; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get WardenPursuitState() { return WardenPursuitState; },
  get GameElapsedTimeSeconds() { return GameElapsedTimeSeconds; },
});
const {
  HostilePylonGroup,
  positionHostilePylons,
  WardenVisualGroup,
  WardenCoreMaterial,
  WardenArmorMaterial,
  WardenCitadelMaterial,
  WardenBeaconMaterial,
  WardenShieldRings,
  WardenShieldMoonMesh,
  WardenExposureLatticeGroup,
  WardenExposureLatticeMaterial,
  WardenForecastLine,
  WardenEntryPosition,
  WardenApproachStartPosition,
  WardenEventPulseMesh,
  WardenEventPulseMaterial,
  startWardenEventPulse,
  updateWardenVisuals,
  beginCommandDefeat,
  resetWardenVisuals,
} = WardenVisuals;


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
  const IsCommandDefeated = WorldheartDefinition.restored;
  const PublishedWardenState = getPublishedWardenState(
    WardenPursuitState.status,
    IsCommandDefeated,
  );
  WardenPanelElement.hidden = !IsVisible;
  WardenPanelElement.classList.toggle('is-defeated', IsCommandDefeated);
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
  WardenStateLabelElement.textContent = IsCommandDefeated
    ? 'WARDEN DEFEATED'
    : 'WARDEN APPROACH';
  WardenDistanceElement.textContent = IsCommandDefeated
    ? 'SIGNAL BROKEN'
    : IsCommandExposed
    ? 'EXPOSED'
    : WardenPursuitState.distance === 0
    ? 'ARRIVING NOW'
    : `${WardenPursuitState.distance} FLIGHT${WardenPursuitState.distance === 1 ? '' : 'S'}`;
  WardenTargetElement.textContent = IsCommandDefeated
    ? 'WORLDS RESPONDING'
    : IsCommandExposed
    ? 'COMMAND WORLD'
    : TargetWorld
    ? `NEXT: ${TargetWorld.label}`
    : getFrameLiveRelayCircuits().length > 0
      ? 'NETWORK BLOCKED'
      : 'TARGET UNKNOWN';
  GameCanvas.dataset.wardenStatus = PublishedWardenState.status;
  GameCanvas.dataset.wardenDistance = String(WardenPursuitState.distance);
  GameCanvas.dataset.wardenTarget = WardenPursuitState.targetWorldIdentifier ?? '';
  GameCanvas.dataset.wardenEvent = WardenPursuitState.lastEvent;
  GameCanvas.dataset.wardenResolvedFlights = String(WardenPursuitState.resolvedFlightCount);
  GameCanvas.dataset.wardenShieldLayers = String(WardenPursuitState.shieldLayers);
  GameCanvas.dataset.wardenLandmark = PublishedWardenState.landmark;
  publishRunUnlockState();
}

function listLiveWorldIdentifiers() {
  return [...RelayNetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => isRelayWorldLive(RelayNetworkState, WorldIdentifier),
  );
}

function invalidateLiveRelayQueryCache() {
  FrameLiveRelayLinks = null;
  FrameLiveRelayCircuits = null;
}

function getFrameLiveRelayLinks() {
  if (!FrameLiveRelayLinks) {
    FrameLiveRelayLinks = listAuthoredLiveRelayLinks(RelayNetworkState);
  }
  return FrameLiveRelayLinks;
}

function getFrameLiveRelayCircuits() {
  if (!FrameLiveRelayCircuits) {
    FrameLiveRelayCircuits = listAuthoredLiveRelayCircuits(RelayNetworkState);
  }
  return FrameLiveRelayCircuits;
}
const Hud = createHud({
  InstructionPanelElement,
  InstructionTitleElement,
  InstructionBodyElement,
  WorldCounterElement,
  LaunchCounterElement,
  CounterElement,
  ScoreCounterElement,
  FlightScoreValueElement,
  ChainValueElement,
  FlightScoreElement,
  StatusToastElement,
  StardustCounterElement,
  ObjectiveLabelElement,
  ObjectiveStateElement,
  ObjectivePanelElement,
  ObjectivePipsElement,
  ObjectivePipElements,
  GameCanvas,
  WorldDefinitions,
  RestorableWorldCount,
  StardustDefinitions,
  WorldheartDefinition,
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  get CachedInstructionPanelTop() { return CachedInstructionPanelTop; },
  set CachedInstructionPanelTop(Value) { CachedInstructionPanelTop = Value; },
  get StatusToastTimeoutIdentifier() { return StatusToastTimeoutIdentifier; },
  set StatusToastTimeoutIdentifier(Value) { StatusToastTimeoutIdentifier = Value; },
  get RunState() { return RunState; },
  get ScoreState() { return ScoreState; },
  get RelayNetworkState() { return RelayNetworkState; },
  get WardenPursuitState() { return WardenPursuitState; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get ActiveHostileEncounterState() { return ActiveHostileEncounterState; },
});
const {
  refreshInstructionPanelBounds,
  updateStardustCounter,
  updateWorldheartObjective,
  updateWorldCounter,
  updateLaunchCounter,
  updateScoreInterface,
  showStatusToast,
  showInstruction,
  hideInstruction,
  resetHud,
} = Hud;


function getSectorClusterRules() {
  return {
    innerClusterWorldIdentifiers: ActiveSystem.innerClusterWorldIdentifiers,
    furtherReachWorldIdentifiers: ActiveSystem.furtherReachWorldIdentifiers,
    commandWorldIdentifier: ActiveSystem.commandWorldIdentifier,
  };
}

function isLiveInnerCluster(LiveWorldIdentifiers = listLiveWorldIdentifiers()) {
  return isInnerClusterLive(
    LiveWorldIdentifiers,
    ActiveSystem.innerClusterWorldIdentifiers,
  );
}

function isLiveFurtherReach(LiveWorldIdentifiers = listLiveWorldIdentifiers()) {
  return isFurtherReachLive(
    LiveWorldIdentifiers,
    ActiveSystem.furtherReachWorldIdentifiers,
  );
}

function getActiveMaximumScoutZoomScale() {
  return isLiveInnerCluster()
    ? MaximumScoutZoomScaleOpen
    : MaximumScoutZoomScaleVeiled;
}

function getWardenRevealFlag() {
  return getSectorWardenRevealFlag(
    listLiveWorldIdentifiers(),
    ActiveSystem.innerClusterWorldIdentifiers,
    ActiveSystem.furtherReachWorldIdentifiers,
  );
}

function isWorldInLiveCircuit(WorldIdentifier) {
  return getFrameLiveRelayCircuits().some(
    (Circuit) => Circuit.worldIdentifiers.includes(WorldIdentifier),
  );
}

function resolveWardenAfterResolvedFlight({ firstCircuitClosed = false, circuit = null } = {}) {
  const Resolution = resolveWardenAfterNonCommandFlight({
    runtime: ActiveSystem,
    networkState: RelayNetworkState,
    wardenState: WardenPursuitState,
    currentNodeIdentifier: CurrentWorldIdentifier,
    firstCircuitClosed,
    isWorldheartOpen: WorldheartDefinition.routeAvailable === true,
  });
  WardenPursuitState = Resolution.wardenState;
  const CommandWorldJustExposed = updateCommandWorldAvailability();
  let SuppressedWorld = Resolution.suppressedWorld;
  if (Resolution.caught && SuppressedWorld === null) {
    SuppressedWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  }
  if (Resolution.caught) {
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
  if (SuppressedWorld) {
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
    GameCanvas.dataset.lastSuppressedWorld = SuppressedWorld.id;
  }
  publishWardenState();
  const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
  if (WardenPursuitState.lastEvent === WardenPursuitEvents.revealed) {
    startWardenEventPulse(WardenVisualGroup.position, 0xff5148, 'arrival');
    const ArrivalAnswerLine = RelayNetworkState.links.size === 2
      ? SecondRelayAnswerLine
      : '';
    GameCanvas.dataset.wardenArrivalAnswer = ArrivalAnswerLine;
    showInstruction(
      'Unauthorised network detected.',
      `${ArrivalAnswerLine ? `${ArrivalAnswerLine} ` : ''}The Warden is targeting ${TargetWorld?.label ?? 'the frontier'} · ${WardenPursuitState.distance} resolved flights away.`,
    );
    GameCanvas.dataset.wardenArrivalBroadcast = ActiveSystem.wardenArrivalBroadcast ?? '';
    RecaptureCutGiftAvailable = true;
    publishRunUnlockState();
    if (ActiveSystem.wardenArrivalBroadcast && !ActiveSystem.storyBoards?.wardenArrival) {
      showStatusToast(ActiveSystem.wardenArrivalBroadcast, 3600, 'warden');
    }
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
    if (WardenPursuitState.status === 'hidden') {
      showInstruction(
        'The neighbourhood holds.',
        `${CircuitWorldLabels || 'The relay loop'} is talking both ways.`,
      );
      showStatusToast('RELAY LOOP CLOSED · WORLDS ANSWER', 1600);
    } else {
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
    }
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

const PlayerVisuals = createPlayerVisuals(THREE, Scene, {
  SeedRadius,
  GameCanvas,
  MaximumTrajectoryPredictionSteps,
  TrajectoryPreviewSampleStride,
});
const {
  SeedGroup,
  RunnerVisualGroup,
  RunnerPresentationScale,
  ShipPresentationScale,
  RunnerSuitMaterial,
  RunnerDarkMaterial,
  RunnerVisorMaterial,
  RunnerBackpackMesh,
  RunnerTorsoMesh,
  RunnerHelmetMesh,
  RunnerVisorMesh,
  RunnerLimbGeometry,
  RunnerArmMeshes,
  RunnerLegMeshes,
  RunnerThrusterMaterial,
  RunnerThrusterGroup,
  RunnerAntennaStem,
  RunnerAntennaLight,
  ShipVisualGroup,
  ShipHullMaterial,
  ShipAccentMaterial,
  ShipHullMesh,
  ShipNoseMesh,
  ShipWindowMesh,
  ShipThrusterMesh,
  SeedHaloGeometry,
  SeedHaloMaterial,
  SeedHaloMesh,
  SeedPointLight,
  SeedPointerHitGeometry,
  SeedPointerHitMaterial,
  SeedPointerHitMesh,
  MaximumPreviewPointCount,
  TrajectoryPositionValues,
  TrajectoryGeometry,
  TrajectoryPositionAttribute,
  TrajectoryMaterial,
  TrajectoryLine,
  LandingMarkerGeometry,
  LandingMarkerMaterial,
  LandingMarkerMesh,
  FeedbackPulseGeometry,
  LaunchPulseMesh,
  ImpactPulseMesh,
  PullGuideGeometry,
  PullGuideMaterial,
  PullGuideLine,
  CutGuideGeometry,
  CutGuideMaterial,
  CutGuideLine,
  TrailParticlePool,
  TrailParticleCount,
  TrailParticleGeometry,
  TrailParticleMaterial,
  TrailParticleMesh,
  TrailParticleTransform,
  createFeedbackPulse,
  updateTrailParticleInstance,
} = PlayerVisuals;

let NextTrailParticleIndex = 0;
let TrailEmissionAccumulatorSeconds = 0;


/**
 * Converts pointer coordinates into the XY orbital plane.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {THREE.Vector3|null} Intersection position or null if the ray misses the plane.
 */
function getPointerWorldPosition(PointerEventData, UnprojectCamera = Camera) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;

  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, UnprojectCamera);
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

function isPointerOverAttachedWorld(WorldPosition) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !WorldPosition) {
    return false;
  }
  const Distance = Math.hypot(
    WorldPosition.x - AttachedWorld.position.x,
    WorldPosition.y - AttachedWorld.position.y,
  );
  return Distance <= AttachedWorld.radius + 0.45;
}

function rememberPointerLocation(PointerEventData) {
  PointerByIdentifier.set(PointerEventData.pointerId, {
    clientX: PointerEventData.clientX,
    clientY: PointerEventData.clientY,
  });
}

function forgetPointerLocation(PointerEventData) {
  PointerByIdentifier.delete(PointerEventData.pointerId);
}

function beginPinchIfNeeded() {
  if (PointerByIdentifier.size !== 2 || IsBurnAiming || IsCutAiming) {
    return false;
  }
  const [FirstPointer, SecondPointer] = [...PointerByIdentifier.values()];
  PinchState = {
    startDistance: getPointerClientDistance(FirstPointer, SecondPointer),
    startScale: shouldUseSectorPlanningCamera() && !IsScoutMode
      ? AimZoomScale
      : CameraZoomScale,
  };
  IsPointerWalking = false;
  IsPointerScouting = false;
  GameCanvas.classList.remove('is-walking', 'is-scouting');
  return true;
}

function updatePinchZoom() {
  if (!PinchState || PointerByIdentifier.size !== 2) {
    return false;
  }
  const [FirstPointer, SecondPointer] = [...PointerByIdentifier.values()];
  const UsesPlanningZoom = shouldUseSectorPlanningCamera() && !IsScoutMode;
  const NextScale = getPinchZoomScale(
    PinchState.startDistance,
    getPointerClientDistance(FirstPointer, SecondPointer),
    PinchState.startScale,
    {
      minimumScale: MinimumScoutZoomScale,
      maximumScale: getActiveMaximumScoutZoomScale(),
    },
  );
  if (UsesPlanningZoom) {
    if (NextScale === AimZoomScale) {
      return false;
    }
    AimZoomScale = NextScale;
    refreshPlanningZoomControls();
    GameCanvas.dataset.aimZoom = AimZoomScale.toFixed(2);
    return true;
  }
  if (NextScale === CameraZoomScale) {
    return false;
  }
  CameraZoomScale = NextScale;
  ScoutZoomScale = NextScale;
  refreshPlanningZoomControls();
  GameCanvas.dataset.scoutZoom = CameraZoomScale.toFixed(2);
  resizeRenderer();
  return true;
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
        ActiveHostileEncounterState,
        getCurrentCutHitIds(),
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
  if (WardenPursuitState.status === 'hidden') {
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
  if (WardenPursuitState.status === 'hidden') {
    const RouteChoices = getCurrentRouteChoices(2);
    const Coach = getHiddenWardenRouteCoach({
      liveRelayCount: countLiveRelayWorlds(RelayNetworkState),
      routeLabels: RouteChoices.map((RouteChoice) => RouteChoice.label),
      openingBody: ActiveSystem.openingBody,
      rangeUnlockLine: ActiveSystem.rangeUnlockLine,
      innerClusterLive: isLiveInnerCluster(),
    });
    showInstruction(Coach.title, Coach.body);
    return;
  }
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
    const AlternateCircuitChoice = ExpansionChoice && wouldCloseRelayCircuit(
      RelayNetworkState,
      CurrentWorldIdentifier,
      ExpansionChoice.id,
    )
      ? ExpansionChoice
      : null;
    const AuthoredGuidance = ActiveSystem.routeGuidance?.[CurrentWorldIdentifier]?.[
      CircuitChoice.id
    ];
    showInstruction(
      AlternateCircuitChoice
        ? `Close via ${CircuitChoice.label} or ${AlternateCircuitChoice.label}`
        : ExpansionChoice
        ? `Reinforce ${CircuitChoice.label} or expand to ${ExpansionChoice.label}`
        : `Reinforce the route to ${CircuitChoice.label}`,
      AuthoredGuidance
        ?? 'Close the gold relay loop to protect its worlds and push the Warden back.',
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
function updateRouteLabels(InstructionTop) {
  const RouteChoices = GamePhase === 'attached'
    ? getCurrentRouteChoices(RouteLabelElements.length)
    : [];
  const IsCompactLayout = window.innerWidth <= 640;
  const IsShortLandscape = window.innerWidth >= window.innerHeight
    && window.innerHeight <= 520;
  const HorizontalMargin = IsCompactLayout ? 48 : 58;
  const LabelVerticalBounds = getPlayfieldLabelVerticalBounds({
    viewportHeight: window.innerHeight,
    instructionTop: InstructionTop,
    isCompact: IsCompactLayout,
    isShortLandscape: IsShortLandscape,
    wardenVisible: !WardenPanelElement.hidden,
    isTactical: false,
  });
  const LabelPositions = [];

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
    LabelPositions.push({
      x: Math.round(
        THREE.MathUtils.clamp(
          (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth,
          HorizontalMargin,
          window.innerWidth - HorizontalMargin,
        ),
      ),
      y: Math.round(THREE.MathUtils.clamp(
        (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
        LabelVerticalBounds.minimumY,
        LabelVerticalBounds.maximumY,
      )),
    });
  }

  const RouteHorizontalMargin = IsShortLandscape ? 80 : HorizontalMargin;
  const ResolvedLabelPositions = separateOverlappingRouteLabels(LabelPositions, {
    minimumGap: IsShortLandscape ? 160 : 76,
    minimumX: RouteHorizontalMargin,
    maximumX: window.innerWidth - RouteHorizontalMargin,
  });
  const ClearedLabelPositions = separateRouteLabelsFromTacticalLabels(
    ResolvedLabelPositions,
    TacticalLabelScreenPositions,
    {
      horizontalClearance: IsShortLandscape ? 180 : 100,
      verticalClearance: IsShortLandscape ? 22 : 30,
      minimumY: LabelVerticalBounds.minimumY,
      maximumY: LabelVerticalBounds.maximumY,
    },
  );
  for (let LabelIndex = 0; LabelIndex < ClearedLabelPositions.length; LabelIndex += 1) {
    RouteLabelElements[LabelIndex].style.left = `${ClearedLabelPositions[LabelIndex].x}px`;
    RouteLabelElements[LabelIndex].style.top = `${ClearedLabelPositions[LabelIndex].y}px`;
  }
}

/** Updates deterministic tactical-body transforms and their world-space HUD labels. */
function updateTacticalBodies(ElapsedTimeSeconds, InstructionTop) {
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
    isLiveInnerCluster()
      ? (WorldheartDefinition.routeAvailable ? WorldheartOpenColor : WorldheartLockedColor)
      : WorldheartLockedColor,
  );
  TacticalBodyMesh.instanceMatrix.needsUpdate = true;
  TacticalBodyMesh.instanceColor.needsUpdate = true;
  TacticalBodyMesh.visible = ShouldShowTacticalLayer;
  AsteroidOrbitLine.visible = ShouldShowTacticalLayer;
  AsteroidOrbitMaterial.opacity = 0.14 + (Math.sin(ElapsedTimeSeconds * 1.8) * 0.035);
  SeedstoneOrbitLine.visible = ShouldShowTacticalLayer && Boolean(SeedstoneDefinition.orbit);
  SeedstoneOrbitMaterial.opacity = 0.11 + (Math.sin(ElapsedTimeSeconds * 1.5) * 0.025);

  const IsCompactLayout = window.innerWidth <= 640;
  const IsShortLandscape = window.innerWidth >= window.innerHeight
    && window.innerHeight <= 520;
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
    WorldheartDefinition.routeAvailable && !IsShortLandscape
      ? {
        definition: WorldheartDefinition,
        position: WorldheartPosition,
        text: WorldheartDefinition.orbit
          ? `${WorldheartDefinition.label} · EXPOSED · MOVING`
          : `${WorldheartDefinition.label} · EXPOSED`,
      }
      : null,
  ];
  TacticalLabelScreenPositions.length = 0;
  const ProjectedTacticalLabelPositions = [];
  const VisibleTacticalLabelElements = [];
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
    const HorizontalLabelMargin = getTacticalLabelHorizontalMargin(
      TacticalLabelDefinition.text,
    );
    const ProjectedLabelLeft = Math.round(
      THREE.MathUtils.clamp(
        ProjectedLabelX,
        HorizontalLabelMargin,
        window.innerWidth - HorizontalLabelMargin,
      ),
    );
    const ProjectedLabelTop = Math.round(
      (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
    );
    ProjectedTacticalLabelPositions.push({
      x: ProjectedLabelLeft,
      y: ProjectedLabelTop,
    });
    VisibleTacticalLabelElements.push(TacticalLabelElement);
  }
  const LabelVerticalBounds = getPlayfieldLabelVerticalBounds({
    viewportHeight: window.innerHeight,
    instructionTop: InstructionTop,
    isCompact: IsCompactLayout,
    isShortLandscape: IsShortLandscape,
    wardenVisible: !WardenPanelElement.hidden,
    isTactical: true,
  });
  const ResolvedTacticalLabelPositions = separateOverlappingTacticalLabels(
    ProjectedTacticalLabelPositions,
    {
      horizontalClearance: 160,
      verticalClearance: 28,
      minimumY: LabelVerticalBounds.minimumY,
      maximumY: LabelVerticalBounds.maximumY,
    },
  );
  TacticalLabelScreenPositions.push(...ResolvedTacticalLabelPositions);
  for (
    let LabelIndex = 0;
    LabelIndex < ResolvedTacticalLabelPositions.length;
    LabelIndex += 1
  ) {
    VisibleTacticalLabelElements[LabelIndex].style.left = (
      `${ResolvedTacticalLabelPositions[LabelIndex].x}px`
    );
    VisibleTacticalLabelElements[LabelIndex].style.top = (
      `${ResolvedTacticalLabelPositions[LabelIndex].y}px`
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
  PersonalBestLabelElement.textContent = getPersonalBestStatus({
    isReplayVerified: IsReplayVerified,
    runScore: RunResult.score,
    personalBestScore: PersonalBestUpdate?.personalBest.score ?? null,
    isNewPersonalBest: PersonalBestUpdate?.isNewPersonalBest === true,
  });
  ResultSlingshotScoreElement.textContent = ScoreState.bankedSlingshotScore.toLocaleString('en-GB');
  ResultLiberationScoreElement.textContent = ScoreState.networkScore.toLocaleString('en-GB');
  ResultCompletionBonusElement.textContent = ScoreState.victoryScore.toLocaleString('en-GB');
  ResultFlightTimeElement.textContent = formatFlightTime(RunResult.flightTimeMilliseconds);
  const EndingReveal = ActiveSystem.completion.endingReveal
    ? ` ${ActiveSystem.completion.endingReveal}`
    : '';
  VictoryBodyElement.textContent = `${CompletionBody}${EndingReveal} ${getRunResourceSummary(
    RunState,
  )} · ${formatFlightTime(RunResult.flightTimeMilliseconds)} flight time.`;
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
function announceCollectedStardust() {
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

/** Collects any optional stardust touched by the live fixed-step seed position. */
function collectStardustAtPosition(SeedPosition) {
  const CollectedBefore = FlightCollectedStardustIdentifiers.size;
  collectFlightStardust(
    StardustDefinitions,
    SeedPosition,
    FlightCollectedStardustIdentifiers,
  );
  if (FlightCollectedStardustIdentifiers.size === CollectedBefore) {
    return;
  }
  announceCollectedStardust();
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
  rollbackSharedFlightStardust(StardustDefinitions, FlightCollectedStardustIdentifiers);
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
function calculateSurfaceRestPosition(WorldDefinition, ImpactPosition, BodyPosition = WorldDefinition.position) {
  return calculateSharedSurfaceRestPosition(WorldDefinition, ImpactPosition, BodyPosition);
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

function getShipCutOrigin() {
  return {
    x: SeedPhysicsState.position.x,
    y: SeedPhysicsState.position.y,
  };
}

function getCurrentCutPreview() {
  if (!ActiveHostileEncounterState) return null;
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld) return null;
  const Origin = getShipCutOrigin();
  if (CutAimPointer) {
    const End = getCutEndPoint(
      Origin,
      CutAimPointer,
      ActiveHostileEncounterState.maxCutLength,
    );
    const Distance = Math.hypot(CutAimPointer.x - Origin.x, CutAimPointer.y - Origin.y);
    return {
      origin: Origin,
      end: End,
      distance: Distance,
      willCancel: shouldCancelAimedLaunch({
        pointerDistanceFromShip: Distance,
        cancelRadius: LaunchCancelRadius,
      }),
      hits: getCutHits(ActiveHostileEncounterState, Origin, End, AttachedWorld),
    };
  }
  const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
  const AutoCut = getNearestClampCut(
    ActiveHostileEncounterState,
    Origin,
    AttachedWorld,
    RunnerSurfaceAngle,
  );
  return AutoCut
    ? {
      origin: AutoCut.origin,
      end: AutoCut.end,
      distance: Math.hypot(AutoCut.end.x - Origin.x, AutoCut.end.y - Origin.y),
      willCancel: false,
      hits: AutoCut.hits,
    }
    : null;
}

function getCurrentCutHitIds() {
  const Preview = getCurrentCutPreview();
  if (!Preview || Preview.willCancel) return [];
  return Preview.hits.map((Hit) => Hit.id);
}

function hideCutGuide() {
  CutGuideLine.visible = false;
}

function renderCutGuide(Preview) {
  if (!Preview || Preview.willCancel) {
    hideCutGuide();
    return;
  }
  CutGuideGeometry.setFromPoints([
    new THREE.Vector3(Preview.origin.x, Preview.origin.y, 0.28),
    new THREE.Vector3(Preview.end.x, Preview.end.y, 0.28),
  ]);
  CutGuideLine.computeLineDistances();
  CutGuideMaterial.color.setHex(Preview.hits.length > 0 ? 0xffd678 : 0xff766d);
  CutGuideMaterial.opacity = Preview.hits.length > 0 ? 0.95 : 0.55;
  CutGuideLine.visible = true;
}

function refreshHostileClampVisuals() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState) {
    hideCutGuide();
    HostilePylonGroup.visible = false;
    return;
  }
  const Preview = getCurrentCutPreview();
  positionHostilePylons(
    AttachedWorld,
    ActiveHostileEncounterState,
    Preview && !Preview.willCancel ? Preview.hits.map((Hit) => Hit.id) : [],
  );
  if (IsCutAiming) {
    renderCutGuide(Preview);
  } else {
    hideCutGuide();
  }
}

function publishHostileEncounterState() {
  const AttachedWorld = getCurrentAttachedWorld();
  const RunnerSurfaceAngle = AttachedWorld
    ? getRunnerSurfaceAngle(AttachedWorld)
    : 0;
  const RemainingCount = ActiveHostileEncounterState
    ? getRemainingClamps(ActiveHostileEncounterState).length
    : 0;
  const Preview = getCurrentCutPreview();
  const CutReady = Boolean(Preview && Preview.hits.length > 0 && !Preview.willCancel);
  GameCanvas.dataset.hostileEncounter = ActiveHostileEncounterState?.worldIdentifier ?? '';
  GameCanvas.dataset.hostilePulseReady = String(CutReady);
  GameCanvas.dataset.hostileClampCount = String(RemainingCount);
  GameCanvas.dataset.hostilePylonAngle = ActiveHostileEncounterState
    ? (getRemainingClamps(ActiveHostileEncounterState)[0]?.surfaceAngle ?? 0).toFixed(4)
    : '';
  refreshHostileClampVisuals();
  return CutReady;
}

function showHostileEncounterInstruction() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState) return false;
  const IsCommandApproach = AttachedWorld.kind === 'worldheart';
  const RemainingCount = getRemainingClamps(ActiveHostileEncounterState).length;
  const CommandApproachTitle = ActiveSystem.commandApproachLine
    ?? 'The lattice is open.';
  const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
  const MoveKey = getHostileEncounterMoveDirection(
    ActiveHostileEncounterState,
    RunnerSurfaceAngle,
  ) > 0 ? 'Q' : 'E';
  const DistanceDegrees = Math.round(THREE.MathUtils.radToDeg(
    getHostileEncounterAngularDistance(ActiveHostileEncounterState, RunnerSurfaceAngle),
  ));
  if (IsCommandApproach) {
    showInstruction(
      CommandApproachTitle,
      RemainingCount === 3
        ? 'Grab the ship and drag through a gold tooth. Drag back onto it to cancel.'
        : `${RemainingCount} left. A longer drag can take more than one.`,
    );
  } else if (RemainingCount === ActiveHostileEncounterState.clamps.length
    && RemainingCount === 1) {
    showInstruction(
      `${AttachedWorld.label} has one leftover tooth.`,
      'Grab the ship and drag through it. This is Cut.',
    );
  } else if (RemainingCount === 3) {
    showInstruction(
      `${AttachedWorld.label} still has teeth.`,
      'Grab the ship and drag through a clamp. Walk with Q/E if the cut cannot reach.',
    );
  } else {
    showInstruction(
      `${RemainingCount} clamp${RemainingCount === 1 ? '' : 's'} left on ${AttachedWorld.label}.`,
      DistanceDegrees > 18
        ? `Walk ${MoveKey} toward the next one, then drag through it.`
        : 'A longer drag can take more than one.',
    );
  }
  return true;
}

function beginHostileEncounter(WorldDefinition, EncounterDefinition = WorldDefinition.hostileEncounter) {
  if (
    ReplayPlaybackState !== null
    || !EncounterDefinition
    || CompletedHostileEncounterWorldIdentifiers.has(WorldDefinition.id)
  ) {
    return false;
  }
  cancelCutAim({ announce: false });
  ActiveHostileEncounterState = createHostileEncounterState({
    worldIdentifier: WorldDefinition.id,
    runnerSurfaceAngle: getRunnerSurfaceAngle(WorldDefinition),
    ...EncounterDefinition,
  });
  IsKeyboardAiming = false;
  IsPointerAiming = false;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  GameCanvas.dataset.keyboardAimAssist = '';
  clearTrajectoryPreview();
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






const StoryDirector = createStoryDirector({
  ActiveSystem,
  GameCanvas,
  WorldseedSound,
  CampaignNodeDefinitions,
  StartingWorldIdentifier,
  OpeningBriefingElement,
  BriefingKickerElement,
  BriefingSpeakerElement,
  BriefingTitleElement,
  BriefingBodyElement,
  BriefingProgressElement,
  BriefingContinueButtonElement,
  BriefingSkipButtonElement,
  BriefingPortraitElement,
  InstructionPanelElement,
  showInstruction,
  showStatusToast,
  resetGame,
  revealVictoryPanel,
  showHostileEncounterInstruction,
  showRouteChoiceInstruction,
  get OpeningBriefingPageIndex() { return OpeningBriefingPageIndex; },
  set OpeningBriefingPageIndex(Value) { OpeningBriefingPageIndex = Value; },
  get IsOpeningBriefingActive() { return IsOpeningBriefingActive; },
  set IsOpeningBriefingActive(Value) { IsOpeningBriefingActive = Value; },
  get ActiveStoryBoardId() { return ActiveStoryBoardId; },
  set ActiveStoryBoardId(Value) { ActiveStoryBoardId = Value; },
  get ActiveStoryBoardTokens() { return ActiveStoryBoardTokens; },
  set ActiveStoryBoardTokens(Value) { ActiveStoryBoardTokens = Value; },
  get StoryBoardQueue() { return StoryBoardQueue; },
  set StoryBoardQueue(Value) { StoryBoardQueue = Value; },
  ShownStoryBoardIds,
  get PendingRunResetAfterStoryBoard() { return PendingRunResetAfterStoryBoard; },
  set PendingRunResetAfterStoryBoard(Value) { PendingRunResetAfterStoryBoard = Value; },
  get PendingVictoryAfterStoryBoard() { return PendingVictoryAfterStoryBoard; },
  set PendingVictoryAfterStoryBoard(Value) { PendingVictoryAfterStoryBoard = Value; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
  get GamePhase() { return GamePhase; },
  set GamePhase(Value) { GamePhase = Value; },
  get RelayRevealLookTarget() { return RelayRevealLookTarget; },
  get RelayRevealHoldUntilSeconds() { return RelayRevealHoldUntilSeconds; },
  get GameElapsedTimeSeconds() { return GameElapsedTimeSeconds; },
  get ActiveHostileEncounterState() { return ActiveHostileEncounterState; },
});
const {
  hideStoryBoardOverlay,
  hideOpeningBriefing,
  beginStoryBoard,
  enqueueCampaignStoryBoards,
  flushQueuedStoryBoardsIfReady,
  beginOpeningBriefing,
  advanceOpeningBriefing,
  finishOpeningBriefing,
} = StoryDirector;


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

  if (enqueueCampaignStoryBoards(['runLost'])) {
    return;
  }

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
  return resolveWardenAfterResolvedFlight({ firstCircuitClosed, circuit });
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
  clearTrajectoryPreview();
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
  CommittedPredictionPoints = null;
  GameCanvas.dataset.predictionHoldActive = 'false';
  const LandingOriginWorldIdentifier = FlightOriginWorldIdentifier;
  const SurfaceRestPosition = calculateSurfaceRestPosition(WorldDefinition, ImpactPosition);

  ImpactPulseMesh.material.color.set(0xfff2bc);
  ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.22);
  ImpactPulseMesh.scale.setScalar(1);
  ImpactPulseMesh.visible = true;
  ImpactPulseLifeSeconds = 0.58;
  CameraImpactLifeSeconds = 0.24;
  WorldseedSound.impact(WorldDefinition.id);
  if (!WorldDefinition.restored) {
    WorldseedSound.haulLane();
  }

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

  const LiveWorldsBefore = listLiveWorldIdentifiers();
  const InnerClusterLiveBefore = isLiveInnerCluster(LiveWorldsBefore);
  const FurtherReachLiveBefore = isLiveFurtherReach(LiveWorldsBefore);
  const CommandAvailableBefore = WorldheartDefinition.routeAvailable === true;

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
    CourierStartTimesByLinkId.set(RelayConnection.link.id, GameElapsedTimeSeconds);
    WorldseedSound.tradeLane();
  }
  if (
    RelayConnection?.destinationReactivated
    && RecaptureCutGiftAvailable
    && !WorldDefinition.hostileEncounter
    && !CompletedHostileEncounterWorldIdentifiers.has(WorldDefinition.id)
  ) {
    PendingRecaptureCutWorldIdentifier = WorldDefinition.id;
  }
  GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
  commitFlightStardust();
  resetFlightFeedback();
  restoreWorld(WorldDefinition, ImpactPosition);

  if (GamePhase === 'restoring') {
    const AnswerLine = RelayNetworkState.links.size === 1
      ? FirstRelayAnswerLine
      : (RelayNetworkState.links.size === 2
        ? SecondRelayAnswerLine
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
    clearTrajectoryPreview();
    showStatusToast(
      TotalBankedPoints > 0
        ? `+${TotalBankedPoints.toLocaleString('en-GB')} BANKED`
        : (LandingAccolade ?? 'CLEAN LANDING'),
      850,
    );
    showRouteChoiceInstruction();
  }
  const SuppressedWorld = settleNonCommandFlight({
    firstCircuitClosed: RelayConnection?.circuitClosed === true,
    circuit: RelayConnection?.circuit ?? null,
  });
  if (RunState.status === 'failed' || GamePhase === 'runFailed') {
    updateBreakerBurnInterface();
    return;
  }
  const LiveWorldsAfter = listLiveWorldIdentifiers();
  enqueueCampaignStoryBoards(
    getTriggeredCampaignStoryBoardIds({
      shownIds: [...ShownStoryBoardIds],
      createdLinkCount: RelayNetworkState.links.size,
      linkCreated: RelayConnection?.created === true,
      linkedWorldIdentifier: WorldDefinition.id,
      innerClusterJustUnlocked: !InnerClusterLiveBefore
        && isLiveInnerCluster(LiveWorldsAfter),
      neighbourhoodJustAwake: isLiveInnerCluster(LiveWorldsAfter)
        && !FurtherReachLiveBefore
        && isLiveFurtherReach(LiveWorldsAfter),
      wardenJustRevealed: WardenPursuitState.lastEvent === WardenPursuitEvents.revealed,
      circuitJustClosed: RelayConnection?.circuitClosed === true,
      worldJustSuppressed: Boolean(SuppressedWorld),
      worldJustRecaptured: RelayConnection?.destinationReactivated === true,
      commandJustExposed: !CommandAvailableBefore
        && WorldheartDefinition.routeAvailable === true,
    }),
    { world: (SuppressedWorld ?? WorldDefinition).label },
  );
  if (
    GamePhase === 'restoring'
    && LandingOriginWorldIdentifier
    && (RelayConnection?.created || RelayConnection?.destinationReactivated)
    && WardenPursuitState.lastEvent !== WardenPursuitEvents.revealed
  ) {
    const OriginWorld = getWorldDefinition(LandingOriginWorldIdentifier);
    if (OriginWorld) {
      RelayRevealLookTarget = getRelayRevealLookTarget({
        origin: OriginWorld.position,
        destination: WorldDefinition.position,
        runner: SurfaceRestPosition,
        viewportWorldWidth: ActiveSystem.camera?.viewportWorldWidth ?? 20,
        viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
      });
      GameCanvas.dataset.relayReveal = `${LandingOriginWorldIdentifier}:${WorldDefinition.id}`;
    }
  }
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

/** Completes the command landing only after its lattice teeth are cut. */
function completeWorldheartLiberation() {
  if (WorldheartDefinition.restored) return false;
  CompletedHostileEncounterWorldIdentifiers.add(WorldheartDefinition.id);
  ActiveHostileEncounterState = null;
  HostilePylonGroup.visible = false;
  hideCutGuide();
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
  beginCommandDefeat(GameElapsedTimeSeconds);
  startWardenEventPulse(WorldheartDefinition.position, 0x72d9ff, 'defeat');
  GamePhase = 'victoryPending';
  updateWorldheartObjective();
  publishWardenState();
  updateVictorySummary();
  hideInstruction();
  beginFinaleRestoration();
  if (IsCampaignFinale) {
    showStatusToast('THE WORLDHEART IS AWAKENING', 2200, 'memory');
  } else {
    showStatusToast(
      ActiveSystem.completion.expansionSting
        ? `${ActiveSystem.completion.expansionSting} · +${(PendingWorldheartBankedPoints + CompletionBonus).toLocaleString('en-GB')} BANKED`
        : `COMMAND BROKEN · +${(PendingWorldheartBankedPoints + CompletionBonus).toLocaleString('en-GB')} BANKED`,
      1800,
    );
  }

  const VictoryDelaySeconds = PrefersReducedMotion
    ? 0.85
    : ActiveSystem.finale?.victoryDelaySeconds ?? 1.35;
  WorldheartCompletionTimeoutIdentifier = window.setTimeout(() => {
    WorldheartCompletionTimeoutIdentifier = null;
    PendingVictoryAfterStoryBoard = true;
    if (enqueueCampaignStoryBoards(
      getTriggeredCampaignStoryBoardIds({
        shownIds: [...ShownStoryBoardIds],
        reachJustAnswered: true,
      }),
    )) {
      return;
    }
    PendingVictoryAfterStoryBoard = false;
    revealVictoryPanel();
    GamePhase = 'victory';
    WorldseedSound.victory();
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
  clearTrajectoryPreview();
  updateWorldheartObjective();
  const HasSurfaceApproach = beginHostileEncounter(WorldheartDefinition);
  if (ReplayPlaybackState !== null || !HasSurfaceApproach) {
    completeWorldheartLiberation();
  } else {
    showStatusToast('COMMAND LANDED · CORE LATTICE ACTIVE', 1500);
    enqueueCampaignStoryBoards(
      getTriggeredCampaignStoryBoardIds({
        shownIds: [...ShownStoryBoardIds],
        commandJustLanded: true,
      }),
    );
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

function captureAimInteractionCamera() {
  if (AimInteractionCamera) {
    return;
  }
  AimInteractionCamera = Camera.clone();
}

function releaseAimInteractionCamera() {
  AimInteractionCamera = null;
}

function rememberPlanningPath(Prediction) {
  LastPredictedBodyIdentifier = Prediction?.collisionWorldIdentifier
    || Prediction?.collisionBodyIdentifier
    || '';
  const Points = Array.isArray(Prediction?.points) ? Prediction.points : [];
  if (Points.length < 1) {
    LastPlanningPathPoints = [];
    return;
  }
  const Sampled = [];
  const SampleStride = Math.max(1, Math.floor(Points.length / 12));
  for (let PointIndex = 0; PointIndex < Points.length; PointIndex += SampleStride) {
    const Point = Points[PointIndex];
    Sampled.push({ x: Point.x, y: Point.y });
  }
  const LastPoint = Points[Points.length - 1];
  Sampled.push({ x: LastPoint.x, y: LastPoint.y });
  LastPlanningPathPoints = Sampled;
}

function getPlanningFocusPoints() {
  const AllowedIdentifiers = new Set(getPlanningFocusWorldIdentifiers({
    innerClusterLive: isLiveInnerCluster(),
    commandRouteAvailable: WorldheartDefinition.routeAvailable === true,
    predictedBodyIdentifiers: [
      LastPredictedBodyIdentifier,
      ...PredictedSlingshotWorldIdentifiers,
    ],
    currentWorldIdentifier: CurrentWorldIdentifier ?? '',
    ...getSectorClusterRules(),
  }));
  const FocusPoints = WorldDefinitions
    .filter((WorldDefinition) => AllowedIdentifiers.has(WorldDefinition.id))
    .map((WorldDefinition) => WorldDefinition.position);
  if (AllowedIdentifiers.has(WorldheartDefinition.id)) {
    FocusPoints.push(calculateBodyPositionAtTime(WorldheartDefinition, PhysicsElapsedTimeSeconds));
  }
  return FocusPoints;
}

function applySectorPlanningCamera() {
  if (IsScoutMode || !ActiveSystem.camera?.followPlayer) {
    PlanningCameraScale = 1;
    return;
  }
  const FocusPoints = getPlanningFocusPoints();
  const PlanningCamera = getSectorPlanningCamera({
    runner: SeedPhysicsState.position,
    focusPoints: FocusPoints,
    pathPoints: LastPlanningPathPoints,
    viewportWorldWidth: ActiveSystem.camera?.viewportWorldWidth ?? 20,
    viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
  });
  PlanningCameraLookTarget.set(PlanningCamera.lookX, PlanningCamera.lookY, 0);
  PlanningCameraScale = PlanningCamera.scale;
  GameCanvas.dataset.planningCameraScale = PlanningCamera.scale.toFixed(2);
  GameCanvas.dataset.planningFocusCount = String(FocusPoints.length);
}

/** Jumps to the sector aim frame so landed pan/zoom cannot hide the path in fog. */
function snapLiveCameraToPlanningView() {
  applySectorPlanningCamera();
  CameraLookTarget.copy(PlanningCameraLookTarget);
  DesiredCameraLookTarget.copy(PlanningCameraLookTarget);
  CameraDistanceScale = PlanningCameraScale * AimZoomScale;
  Camera.position.set(
    CameraLookTarget.x,
    CameraLookTarget.y,
    BaseCameraDistance * CameraDistanceScale,
  );
  Camera.lookAt(CameraLookTarget);
}

function shouldUseSectorPlanningCamera() {
  return (IsPointerAiming || IsKeyboardAiming || GamePhase === 'flying')
    && !IsScoutMode
    && GamePhase !== 'restoring'
    && GamePhase !== 'recovering';
}

/**
 * Clears trajectory presentation after aiming ends.
 */
function clearTrajectoryPreview() {
  TrajectoryLine.visible = false;
  LandingMarkerMesh.visible = false;
  TrajectoryGeometry.setDrawRange(0, 0);
  PredictedStardustIdentifiers.clear();
  PredictedSlingshotWorldIdentifiers.clear();
  LastPlanningPathPoints = [];
  LastPredictedBodyIdentifier = '';
  if (!shouldUseSectorPlanningCamera()) {
    PlanningCameraScale = 1;
    GameCanvas.dataset.planningCameraScale = '';
  }
}

function renderTrajectoryLine(PredictionPoints) {
  const PreviewSampleStride = TrajectoryPreviewSampleStride;
  let PreviewPointCount = 0;
  for (
    let PredictionPointIndex = 0;
    PredictionPointIndex < PredictionPoints.length;
    PredictionPointIndex += PreviewSampleStride
  ) {
    const PredictionPoint = PredictionPoints[PredictionPointIndex];
    TrajectoryPositionAttribute.setXYZ(
      PreviewPointCount,
      PredictionPoint.x,
      PredictionPoint.y,
      0.12,
    );
    PreviewPointCount += 1;
  }

  const FinalVisiblePredictionPoint = PredictionPoints[PredictionPoints.length - 1];
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
}

function captureCommittedLaunchPrediction(LaunchVelocity) {
  const LiveRelayCount = countLiveRelayWorlds(RelayNetworkState);
  if (!getRunUnlockState({
    liveRelayCount: LiveRelayCount,
    uniqueCircuitCount: listRelayCircuits(RelayNetworkState).length,
    wardenStatus: WardenPursuitState.status,
    recaptureCutAvailable: RecaptureCutGiftAvailable,
    prefersReducedMotion: PrefersReducedMotion,
  }).predictionHold) {
    CommittedPredictionPoints = null;
    GameCanvas.dataset.predictionHoldActive = 'false';
    return;
  }
  const TrajectoryPrediction = predictCurrentLaunchTrajectory(LaunchVelocity, {
    ignoredWorldIdentifier: LaunchIgnoredWorldIdentifier,
    ignoredCollisionBodyIdentifier: LaunchIgnoredBodyIdentifier,
  });
  CommittedPredictionPoints = TrajectoryPrediction.points.length > 1
    ? TrajectoryPrediction.points.map((Point) => ({ x: Point.x, y: Point.y, z: Point.z ?? 0 }))
    : null;
  GameCanvas.dataset.predictionHoldActive = String(Boolean(CommittedPredictionPoints));
}

function updateFlightPlanningPresentation() {
  const LiveRelayCount = countLiveRelayWorlds(RelayNetworkState);
  if (shouldHoldCommittedPrediction({
    liveRelayCount: LiveRelayCount,
    flightElapsedSeconds: FlightElapsedSeconds,
    prefersReducedMotion: PrefersReducedMotion,
    committedPointCount: CommittedPredictionPoints?.length ?? 0,
  })) {
    renderTrajectoryLine(CommittedPredictionPoints);
    TrajectoryMaterial.color.set(0xffd98a);
    TrajectoryMaterial.opacity = 0.86;
    applySectorPlanningCamera();
    GameCanvas.dataset.predictionHoldActive = 'true';
    return;
  }
  GameCanvas.dataset.predictionHoldActive = 'false';
  const TrajectoryPrediction = predictCurrentLaunchTrajectory(SeedPhysicsState.velocity, {
    ignoredWorldIdentifier: LaunchIgnoredWorldIdentifier,
    ignoredCollisionBodyIdentifier: LaunchIgnoredBodyIdentifier,
  });
  rememberPlanningPath(TrajectoryPrediction);
  if (TrajectoryPrediction.points.length > 1) {
    renderTrajectoryLine(TrajectoryPrediction.points);
  }
  applySectorPlanningCamera();
}

/** Keeps every live aim suggestion on the same fixed-step prediction contract. */
function predictCurrentLaunchTrajectory(InitialVelocity, PredictionOverrides = {}) {
  return predictTrajectory(
    SeedPhysicsState.position,
    createVector(InitialVelocity.x, InitialVelocity.y, 0),
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
      ...PredictionOverrides,
    },
  );
}

const AimPreview = createAimPreview(THREE, {
  AimDragVector,
  get SeedPhysicsState() { return SeedPhysicsState; },
  MaximumDragDistance,
  AimLaunchVelocity,
  LaunchVelocityPerDragUnit,
  LaunchCancelRadius,
  AimPanelElement,
  AimPowerFillElement,
  AimPowerValueElement,
  AimLabelElement,
  WorldseedSound,
  GameCanvas,
  WorldDefinitions,
  SeedRadius,
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  PredictedStardustIdentifiers,
  StardustDefinitions,
  StardustCollectionRadius,
  TrajectoryMaterial,
  LandingMarkerMaterial,
  AsteroidDefinition,
  LandingMarkerMesh,
  SeedstoneDefinition,
  TemporaryThreeVector,
  WorldheartDefinition,
  IsCampaignFinale,
  PredictedSlingshotWorldIdentifiers,
  get KeyboardAimState() { return KeyboardAimState; },
  LastAimPointerWorldPosition,
  shouldCancelAimedLaunch,
  clearTrajectoryPreview,
  applySectorPlanningCamera,
  predictCurrentLaunchTrajectory,
  rememberPlanningPath,
  predictSlingshotEvents,
  getWorldDefinition,
  getTrajectoryPickupIdentifiers,
  renderTrajectoryLine,
  showInstruction,
  calculateBodyPositionAtTime,
  isSystemRestored,
  getWorldLandingAimLabel,
  getSlingshotPreviewPresentation,
  getKeyboardAimDragVector,
});
const {
  updateAimPreview,
  updateKeyboardAimPreview,
} = AimPreview;


/** Uses the shared predictor to give keyboard players a bounded lead on the moving Command World. */
function createSuggestedKeyboardAimState(SuggestedTarget) {
  const DirectAimState = createKeyboardAimState({
    directionX: SuggestedTarget.position.x - SeedPhysicsState.position.x,
    directionY: SuggestedTarget.position.y - SeedPhysicsState.position.y,
    powerRatio: 1,
  });
  const IsMovingCommandTarget = SuggestedTarget.id === WorldheartDefinition.id
    && Boolean(WorldheartDefinition.orbit)
    && shouldAssistCommandLock({
      wardenStatus: WardenPursuitState.status,
      routeAvailable: WorldheartDefinition.routeAvailable === true,
    });
  if (!IsMovingCommandTarget) {
    GameCanvas.dataset.keyboardAimAssist = WorldheartDefinition.routeAvailable
      && SuggestedTarget.id === WorldheartDefinition.id
      ? 'command-direct'
      : 'route';
    return DirectAimState;
  }

  const MaximumLaunchSpeed = MaximumDragDistance * LaunchVelocityPerDragUnit;
  let DidFindCommandLock = false;
  const AssistedAngleRadians = findNearestKeyboardAimAngle(
    DirectAimState.angleRadians,
    (CandidateAngleRadians) => {
      const Prediction = predictCurrentLaunchTrajectory(
        {
          x: Math.cos(CandidateAngleRadians) * MaximumLaunchSpeed,
          y: Math.sin(CandidateAngleRadians) * MaximumLaunchSpeed,
        },
      );
      DidFindCommandLock = Prediction.collisionBodyIdentifier === WorldheartDefinition.id;
      return DidFindCommandLock;
    },
  );
  GameCanvas.dataset.keyboardAimAssist = DidFindCommandLock ? 'command-lock' : 'command-direct';
  if (DidFindCommandLock && !HasAnnouncedCommandLockGift) {
    HasAnnouncedCommandLockGift = true;
    showStatusToast('COMMAND WORLD LOCKED', 1400);
  }
  return { ...DirectAimState, angleRadians: AssistedAngleRadians };
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
  if (!SuggestedTarget) GameCanvas.dataset.keyboardAimAssist = 'direct';
  KeyboardAimState = SuggestedTarget
    ? createSuggestedKeyboardAimState(SuggestedTarget)
    : createKeyboardAimState({
      directionX: SuggestedTargetPosition.x - SeedPhysicsState.position.x,
      directionY: SuggestedTargetPosition.y - SeedPhysicsState.position.y,
      powerRatio: 1,
    });
  IsKeyboardAiming = true;
  CameraPanOffset.set(0, 0, 0);
  AimZoomScale = 1;
  WorldseedSound.beginAim();
  GameCanvas.classList.add('is-aiming');
  PullGuideLine.visible = false;
  AimPanelElement.hidden = false;
  updateKeyboardAimPreview();
  snapLiveCameraToPlanningView();
  refreshPlanningZoomControls();
  showInstruction(
    'Keyboard aim ready',
    'Left/right steer · up/down set power · pinch or wheel to zoom the map · Enter launches.',
  );
  return true;
}

/** Cancels pointer or keyboard aim without spending a launch. */
function cancelAimedLaunch({ announce = true } = {}) {
  const WasAiming = IsPointerAiming || IsKeyboardAiming;
  IsPointerAiming = false;
  IsKeyboardAiming = false;
  IsPointerWalking = false;
  IsPointerScouting = false;
  PointerGestureMode = SurfaceGestureModes.pending;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  GameCanvas.dataset.keyboardAimAssist = '';
  releaseAimInteractionCamera();
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
  if (WasAiming && announce) showStatusToast('LAUNCH CANCELED', 700);
  if (WasAiming) showRouteChoiceInstruction();
  refreshPlanningZoomControls();
}

/** Cancels keyboard aiming without spending a launch. */
function cancelKeyboardAim() {
  if (!IsKeyboardAiming) {
    return;
  }
  cancelAimedLaunch({ announce: false });
}

/** Routes focused canvas keys into the same aim and launch state as a pointer gesture. */
function handleKeyboardAimKey(KeyboardEventData) {
  if (IsOpeningBriefingActive) {
    return false;
  }
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
    if (DidMove) {
      RunnerWalkLifeSeconds = 0.34;
    }
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

  if (PressedKey === 'escape' && (
    IsKeyboardAiming || IsPointerAiming || IsBurnAiming || IsCutAiming
  )) {
    KeyboardEventData.preventDefault();
    if (IsCutAiming) {
      cancelCutAim();
    } else if (IsBurnAiming) {
      cancelBurnAim();
    } else {
      cancelAimedLaunch();
    }
    return true;
  }
  if (ActiveHostileEncounterState && GamePhase === 'attached') {
    if (!IsLaunchKey && RotationDirection === 0 && PowerDirection === 0) {
      return false;
    }
    KeyboardEventData.preventDefault();
    if (IsLaunchKey) {
      if (KeyboardEventData.repeat) return true;
      if (IsCutAiming) fireHostileCutFromPreview();
      else fireNearestHostileCut();
      return true;
    }
    const AttachedWorld = getCurrentAttachedWorld();
    const Origin = getShipCutOrigin();
    const BasisPointer = CutAimPointer ?? (
      AttachedWorld
        ? getNearestClampCut(
          ActiveHostileEncounterState,
          Origin,
          AttachedWorld,
          getRunnerSurfaceAngle(AttachedWorld),
        )?.end
        : null
    ) ?? { x: Origin.x + 1, y: Origin.y };
    KeyboardAimState = createKeyboardAimState({
      directionX: BasisPointer.x - Origin.x,
      directionY: BasisPointer.y - Origin.y,
      powerRatio: Math.min(
        1,
        Math.max(
          0.2,
          Math.hypot(BasisPointer.x - Origin.x, BasisPointer.y - Origin.y)
            / ActiveHostileEncounterState.maxCutLength,
        ),
      ),
    });
    IsCutAiming = true;
    GameCanvas.classList.add('is-aiming');
    AimPanelElement.hidden = false;
    KeyboardAimState = adjustKeyboardAimState(KeyboardAimState, {
      rotationDirection: RotationDirection,
      powerDirection: PowerDirection,
      fine: KeyboardEventData.shiftKey,
    });
    const Drag = getKeyboardAimDragVector(
      KeyboardAimState,
      ActiveHostileEncounterState.maxCutLength,
    );
    updateCutAimPreview({
      x: Origin.x + Drag.x,
      y: Origin.y + Drag.y,
    });
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

function beginCameraPan(WorldPosition) {
  IsPointerScouting = true;
  ScoutPointerStartWorldPosition.copy(WorldPosition);
  if (IsScoutMode) {
    ScoutCameraStartTarget.copy(ScoutCameraTarget);
  } else {
    PanOffsetStart.copy(CameraPanOffset);
  }
  GameCanvas.classList.add('is-scouting');
}

function updateCameraPan(WorldPosition) {
  const NextX = (IsScoutMode ? ScoutCameraStartTarget.x : PanOffsetStart.x)
    + (ScoutPointerStartWorldPosition.x - WorldPosition.x);
  const NextY = (IsScoutMode ? ScoutCameraStartTarget.y : PanOffsetStart.y)
    + (ScoutPointerStartWorldPosition.y - WorldPosition.y);
  if (IsScoutMode) {
    ScoutCameraTarget.set(
      ScannerProjection
        ? THREE.MathUtils.clamp(
          NextX,
          ScannerProjection.minimumX,
          ScannerProjection.minimumX + ScannerProjection.width,
        )
        : NextX,
      ScannerProjection
        ? THREE.MathUtils.clamp(
          NextY,
          ScannerProjection.minimumY,
          ScannerProjection.minimumY + ScannerProjection.height,
        )
        : NextY,
      0,
    );
    GameCanvas.dataset.scoutX = ScoutCameraTarget.x.toFixed(2);
    GameCanvas.dataset.scoutY = ScoutCameraTarget.y.toFixed(2);
    return;
  }
  CameraPanOffset.set(NextX, NextY, 0);
  GameCanvas.dataset.scoutX = CameraPanOffset.x.toFixed(2);
  GameCanvas.dataset.scoutY = CameraPanOffset.y.toFixed(2);
}

function beginCutAim(WorldPosition) {
  if (!ActiveHostileEncounterState || GamePhase !== 'attached') return false;
  IsCutAiming = true;
  CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  GameCanvas.classList.add('is-aiming');
  AimPanelElement.hidden = false;
  AimLabelElement.textContent = 'CUT';
  updateCutAimPreview(WorldPosition);
  return true;
}

function updateCutAimPreview(WorldPosition) {
  if (!IsCutAiming || !ActiveHostileEncounterState) return;
  CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  const Preview = getCurrentCutPreview();
  const WillCancel = Boolean(Preview?.willCancel);
  const HitCount = Preview && !WillCancel ? Preview.hits.length : 0;
  AimPanelElement.classList.toggle('is-cancel', WillCancel);
  AimLabelElement.textContent = WillCancel ? 'RELEASE TO CANCEL' : 'CUT';
  const PowerRatio = THREE.MathUtils.clamp(
    (Preview?.distance ?? 0) / ActiveHostileEncounterState.maxCutLength,
    0,
    1,
  );
  AimPowerFillElement.style.width = WillCancel ? '0%' : `${Math.round(PowerRatio * 100)}%`;
  AimPowerFillElement.style.transform = 'none';
  AimPowerValueElement.textContent = WillCancel
    ? 'CANCEL'
    : (HitCount > 0 ? `${HitCount} HIT` : 'MISS');
  publishHostileEncounterState();
  updateBreakerBurnInterface();
}

function cancelCutAim({ announce = true } = {}) {
  const WasAiming = IsCutAiming;
  IsCutAiming = false;
  CutAimPointer = null;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  hideCutGuide();
  if (WasAiming && announce) showStatusToast('CUT CANCELED', 650);
  if (ActiveHostileEncounterState) {
    publishHostileEncounterState();
    updateBreakerBurnInterface();
    showHostileEncounterInstruction();
  }
}

function applyHostileCut(Origin, End) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState || ReplayPlaybackState !== null) {
    return false;
  }
  const Resolved = resolveHostileCut(
    ActiveHostileEncounterState,
    Origin,
    End,
    AttachedWorld,
  );
  if (Resolved.hitIds.length < 1) {
    showStatusToast('MISSED', 700);
    showHostileEncounterInstruction();
    return false;
  }
  ActiveHostileEncounterState = Resolved.state;
  const LastHit = Resolved.hitIds.at(-1);
  const HitClamp = Resolved.state.clamps[LastHit];
  if (HitClamp) {
    const HitPosition = {
      x: AttachedWorld.position.x
        + (Math.cos(HitClamp.surfaceAngle) * (AttachedWorld.radius + 0.3)),
      y: AttachedWorld.position.y
        + (Math.sin(HitClamp.surfaceAngle) * (AttachedWorld.radius + 0.3)),
    };
    ImpactPulseMesh.material.color.set(0xffd678);
    ImpactPulseMesh.position.set(HitPosition.x, HitPosition.y, 0.28);
    ImpactPulseMesh.scale.setScalar(1.2);
    ImpactPulseMesh.visible = true;
    ImpactPulseLifeSeconds = 0.58;
  }
  WorldseedSound.impact(AttachedWorld.id);
  GameCanvas.dataset.lastHostileWorld = AttachedWorld.id;
  if (Resolved.state.completed) {
    CompletedHostileEncounterWorldIdentifiers.add(AttachedWorld.id);
    ActiveHostileEncounterState = null;
    HostilePylonGroup.visible = false;
    hideCutGuide();
    publishHostileEncounterState();
    if (AttachedWorld.kind === 'worldheart') {
      return completeWorldheartLiberation();
    }
    updateBreakerBurnInterface();
    showStatusToast('THE RIM IS CLEAR', 1350);
    showInstruction(
      `${AttachedWorld.label} can fly.`,
      'Grab the ship and launch. Drag empty space to look around.',
    );
    flushQueuedStoryBoardsIfReady();
    return true;
  }
  publishHostileEncounterState();
  updateBreakerBurnInterface();
  const RemainingCount = getRemainingClamps(Resolved.state).length;
  showStatusToast(
    Resolved.hitIds.length > 1
      ? `${Resolved.hitIds.length} CLAMPS GONE`
      : 'CLAMP GONE',
    900,
  );
  showInstruction(
    `${RemainingCount} left on ${AttachedWorld.label}.`,
    RemainingCount === 1
      ? 'One tooth remains. Drag through it.'
      : 'A longer drag can take more than one.',
  );
  return true;
}

function fireHostileCutFromPreview() {
  const Preview = getCurrentCutPreview();
  if (!Preview || Preview.willCancel) {
    cancelCutAim({ announce: true });
    return false;
  }
  IsCutAiming = false;
  CutAimPointer = null;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  hideCutGuide();
  return applyHostileCut(Preview.origin, Preview.end);
}

function releaseCutAim() {
  return fireHostileCutFromPreview();
}

function fireNearestHostileCut() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !ActiveHostileEncounterState) return false;
  CutAimPointer = null;
  const Preview = getCurrentCutPreview();
  if (!Preview || Preview.hits.length < 1) {
    showStatusToast('TOO FAR', 700);
    showHostileEncounterInstruction();
    return false;
  }
  return applyHostileCut(Preview.origin, Preview.end);
}

function beginBurnAim(WorldPosition) {
  IsBurnAiming = true;
  BurnAimDirection = {
    x: WorldPosition.x - SeedPhysicsState.position.x,
    y: WorldPosition.y - SeedPhysicsState.position.y,
  };
  GameCanvas.classList.add('is-aiming');
  AimPanelElement.hidden = false;
  AimLabelElement.textContent = 'BREAK';
  updateBurnAimPreview(WorldPosition);
}

function updateBurnAimPreview(WorldPosition) {
  BurnAimDirection = {
    x: WorldPosition.x - SeedPhysicsState.position.x,
    y: WorldPosition.y - SeedPhysicsState.position.y,
  };
  const Distance = Math.hypot(BurnAimDirection.x, BurnAimDirection.y);
  const WillCancel = shouldCancelAimedLaunch({
    pointerDistanceFromShip: Distance,
    cancelRadius: LaunchCancelRadius,
  });
  AimPanelElement.classList.toggle('is-cancel', WillCancel);
  AimLabelElement.textContent = WillCancel ? 'RELEASE TO CANCEL' : 'BREAK';
  const PowerRatio = THREE.MathUtils.clamp(Distance / MaximumDragDistance, 0, 1);
  AimPowerFillElement.style.width = WillCancel ? '0%' : `${Math.round(PowerRatio * 100)}%`;
  AimPowerFillElement.style.transform = 'none';
  AimPowerValueElement.textContent = WillCancel ? 'CANCEL' : `${Math.round(PowerRatio * 100)}%`;
  if (WillCancel || Distance < 0.001) {
    clearTrajectoryPreview();
    return;
  }
  const BurnedState = applyBreakerBurn(SeedPhysicsState, undefined, BurnAimDirection);
  const TrajectoryPrediction = predictTrajectory(
    BurnedState.position,
    BurnedState.velocity,
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedPhysicsStepSeconds,
      maximumSteps: MaximumTrajectoryPredictionSteps,
      ignoredWorldIdentifier: FlightOriginWorldIdentifier,
      collisionBodyDefinitions: getActiveTacticalBodyDefinitions(),
      startTimeSeconds: PhysicsElapsedTimeSeconds,
    },
  );
  if (TrajectoryPrediction.points.length > 1) {
    renderTrajectoryLine(TrajectoryPrediction.points);
  }
}

function cancelBurnAim({ announce = true } = {}) {
  IsBurnAiming = false;
  BurnAimDirection = null;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  clearTrajectoryPreview();
  if (announce) showStatusToast('BREAK CANCELED', 650);
}

function releaseBurnAim() {
  const Direction = BurnAimDirection;
  const Distance = Math.hypot(Direction?.x ?? 0, Direction?.y ?? 0);
  const WillCancel = shouldCancelAimedLaunch({
    pointerDistanceFromShip: Distance,
    cancelRadius: LaunchCancelRadius,
  });
  IsBurnAiming = false;
  ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  clearTrajectoryPreview();
  if (WillCancel || !Direction) {
    BurnAimDirection = null;
    showStatusToast('BREAK CANCELED', 650);
    return false;
  }
  BurnAimDirection = Direction;
  return requestBreakerBurn();
}

/**
 * Begins a slingshot drag when the seed is attached and the pointer acquired it.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerDown(PointerEventData) {
  if (IsOpeningBriefingActive) {
    return;
  }
  if (RunState.status !== 'active' || ReplayPlaybackState !== null) {
    return;
  }

  rememberPointerLocation(PointerEventData);
  if (beginPinchIfNeeded()) {
    PointerEventData.preventDefault();
    return;
  }
  if (ActivePointerIdentifier !== null || PinchState) {
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
  if (!CurrentPointerWorldPosition) {
    return;
  }

  GameCanvas.focus({ preventScroll: true });
  ActivePointerIdentifier = PointerEventData.pointerId;
  GameCanvas.setPointerCapture(PointerEventData.pointerId);

  if (GamePhase === 'flying') {
    if (isPointerOverSeed(PointerEventData) && IsBreakerBurnAvailable && !IsBreakerBurnPending) {
      beginBurnAim(CurrentPointerWorldPosition);
    } else {
      beginCameraPan(CurrentPointerWorldPosition);
    }
    PointerEventData.preventDefault();
    return;
  }

  if (GamePhase !== 'attached') {
    ActivePointerIdentifier = null;
    if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
      GameCanvas.releasePointerCapture(PointerEventData.pointerId);
    }
    return;
  }

  cancelKeyboardAim();
  if (isPointerOverSeed(PointerEventData) && ActiveHostileEncounterState) {
    setScoutMode(false);
    PointerGestureMode = SurfaceGestureModes.aim;
    beginCutAim(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (isPointerOverSeed(PointerEventData) && !ActiveHostileEncounterState) {
    setScoutMode(false);
    PointerGestureMode = SurfaceGestureModes.aim;
    PointerGestureStartWorldPosition.copy(CurrentPointerWorldPosition);
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    captureAimInteractionCamera();
    CameraPanOffset.set(0, 0, 0);
    AimZoomScale = 1;
    IsPointerAiming = true;
    WorldseedSound.beginAim();
    GameCanvas.classList.add('is-aiming');
    AimPanelElement.hidden = false;
    updateAimPreview(CurrentPointerWorldPosition);
    snapLiveCameraToPlanningView();
    refreshPlanningZoomControls();
    PointerEventData.preventDefault();
    return;
  }

  if (isPointerOverAttachedWorld(CurrentPointerWorldPosition)) {
    setScoutMode(false);
    PointerGestureMode = SurfaceGestureModes.walk;
    IsPointerWalking = true;
    GameCanvas.classList.add('is-walking');
    const AttachedWorld = getCurrentAttachedWorld();
    if (!showHostileEncounterInstruction()) {
      showInstruction(
        `Walking around ${AttachedWorld.label}`,
        'Trace the rim to choose a launch point. Grab the ship to aim. Drag empty space to pan. Pinch or wheel to zoom.',
      );
    }
    PointerEventData.preventDefault();
    return;
  }

  beginCameraPan(CurrentPointerWorldPosition);
  PointerEventData.preventDefault();
}

/**
 * Updates a slingshot drag.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerMove(PointerEventData) {
  rememberPointerLocation(PointerEventData);
  if (PinchState) {
    updatePinchZoom();
    PointerEventData.preventDefault();
    return;
  }
  if (PointerEventData.pointerId !== ActivePointerIdentifier) {
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(
    PointerEventData,
    (IsPointerAiming && AimInteractionCamera) ? AimInteractionCamera : Camera,
  );
  if (!CurrentPointerWorldPosition) {
    return;
  }

  if (IsCutAiming) {
    updateCutAimPreview(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (IsBurnAiming) {
    updateBurnAimPreview(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (IsPointerScouting) {
    updateCameraPan(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
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
  AimPanelElement.classList.remove('is-cancel');
  releaseAimInteractionCamera();

  if (AimDragVector.length() < MinimumLaunchDragDistance) {
    clearTrajectoryPreview();
    WorldseedSound.endAim();
    showInstruction('Aim the Runner', 'Drag, or use the arrow keys and press Enter to launch.');
    return false;
  }

  applySectorPlanningCamera();

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
  captureCommittedLaunchPrediction(AimLaunchVelocity);
  refreshPlanningZoomControls();
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
  if (!HasTaughtBurn) {
    HasTaughtBurn = true;
    showInstruction(
      'Break ready',
      'Drag from the ship to break your line any direction. Drag back onto it, or press Escape, to cancel.',
    );
  } else {
    hideInstruction();
  }
  return true;
}

function updateBreakerBurnInterface() {
  const IsHostileCut = Boolean(ActiveHostileEncounterState);
  const RemainingCount = IsHostileCut
    ? getRemainingClamps(ActiveHostileEncounterState).length
    : 0;
  const PreviewHitCount = IsHostileCut ? getCurrentCutHitIds().length : 0;
  if (IsHostileCut) publishHostileEncounterState();
  BurnButtonElement.hidden = GamePhase !== 'flying' && !IsHostileCut;
  BurnButtonElement.classList.toggle('is-pulse', IsHostileCut);
  BurnButtonElement.classList.toggle(
    'is-spent',
    IsHostileCut ? RemainingCount < 1 : !IsBreakerBurnAvailable,
  );
  BurnButtonElement.disabled = IsHostileCut ? RemainingCount < 1 : !IsBreakerBurnAvailable;
  BurnButtonElement.querySelector('span').textContent = IsHostileCut ? 'CUT' : 'BREAK';
  BurnButtonElement.querySelector('strong').textContent = IsHostileCut
    ? (PreviewHitCount > 0 ? `${PreviewHitCount} HIT` : `${RemainingCount} LEFT`)
    : IsBreakerBurnAvailable
      ? (IsBreakerBurnPending ? 'ARMED' : 'READY')
      : 'SPENT';
  BurnButtonElement.setAttribute(
    'aria-label',
    IsHostileCut
      ? `Cut ${RemainingCount} clamp${RemainingCount === 1 ? '' : 's'} remaining`
      : `Break ${IsBreakerBurnAvailable ? 'ready' : 'spent'}`,
  );
  GameCanvas.dataset.breakerBurn = GamePhase !== 'flying'
    ? 'stowed'
    : (IsBreakerBurnAvailable ? (IsBreakerBurnPending ? 'armed' : 'ready') : 'spent');
}

function requestBreakerPulse() {
  if (IsCutAiming) return fireHostileCutFromPreview();
  return fireNearestHostileCut();
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
  SeedPhysicsState = applyBreakerBurn(SeedPhysicsState, undefined, BurnAimDirection);
  IsBreakerBurnAvailable = false;
  IsBreakerBurnPending = false;
  CommittedPredictionPoints = null;
  GameCanvas.dataset.predictionHoldActive = 'false';
  if (record) {
    ReplayState = recordReplayBurn(ReplayState, {
      stepIndex: Math.round(PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
      directionX: BurnAimDirection?.x ?? null,
      directionY: BurnAimDirection?.y ?? null,
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
  showStatusToast('BREAK', 650);
  BurnAimDirection = null;
  updateBreakerBurnInterface();
  return true;
}

/**
 * Converts the final drag vector into launch velocity, or cancels if the gesture was tiny.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerUp(PointerEventData) {
  forgetPointerLocation(PointerEventData);
  if (PinchState && PointerByIdentifier.size < 2) {
    PinchState = null;
    if (PointerEventData.pointerId === ActivePointerIdentifier) {
      ActivePointerIdentifier = null;
    }
    PointerEventData.preventDefault();
    return;
  }

  if (PointerEventData.pointerId !== ActivePointerIdentifier) {
    return;
  }

  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }

  if (IsCutAiming) {
    const CurrentCutPointerWorldPosition = getPointerWorldPosition(PointerEventData);
    if (CurrentCutPointerWorldPosition) {
      updateCutAimPreview(CurrentCutPointerWorldPosition);
    }
    releaseCutAim();
    PointerEventData.preventDefault();
    return;
  }

  if (IsBurnAiming) {
    const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
    if (CurrentPointerWorldPosition) {
      updateBurnAimPreview(CurrentPointerWorldPosition);
    }
    releaseBurnAim();
    PointerEventData.preventDefault();
    return;
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
    PointerEventData.preventDefault();
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(
    PointerEventData,
    (IsPointerAiming && AimInteractionCamera) ? AimInteractionCamera : Camera,
  );
  if (CurrentPointerWorldPosition) {
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    updateAimPreview(CurrentPointerWorldPosition);
  }

  if (shouldCancelAimedLaunch({
    pointerDistanceFromShip: AimDragVector.length(),
    cancelRadius: LaunchCancelRadius,
  })) {
    cancelAimedLaunch();
    PointerEventData.preventDefault();
    return;
  }

  releaseAimedLaunch();
  PointerGestureMode = SurfaceGestureModes.pending;
  PointerEventData.preventDefault();
}

function handlePointerCancel(PointerEventData) {
  forgetPointerLocation(PointerEventData);
  if (PinchState && PointerByIdentifier.size < 2) {
    PinchState = null;
  }
  if (PointerEventData.pointerId !== ActivePointerIdentifier) return;
  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }
  if (IsCutAiming) {
    cancelCutAim();
    return;
  }
  if (IsBurnAiming) {
    cancelBurnAim();
    return;
  }
  const WasAiming = IsPointerAiming;
  IsPointerAiming = false;
  IsPointerWalking = false;
  IsPointerScouting = false;
  ActivePointerIdentifier = null;
  PointerGestureMode = SurfaceGestureModes.pending;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  releaseAimInteractionCamera();
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
    clearTrajectoryPreview();
    updateBreakerBurnInterface();
    if (SuppressedWorld) {
      enqueueCampaignStoryBoards(
        getTriggeredCampaignStoryBoardIds({
          shownIds: [...ShownStoryBoardIds],
          worldJustSuppressed: true,
        }),
        { world: SuppressedWorld.label },
      );
      if (!IsOpeningBriefingActive) {
        showInstruction(
          `Signal lost: ${SuppressedWorld.label}.`,
          'Its route and courier are dark. Land there again to reconnect it.',
        );
      }
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
    hideCutGuide();
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
  applySectorPlanningCamera();
  IsBreakerBurnAvailable = true;
  IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  HasLaunchedOnce = true;
  captureCommittedLaunchPrediction({ x: Launch.velocityX, y: Launch.velocityY, z: 0 });
  refreshPlanningZoomControls();
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
  if (BurnUpdate.burn) {
    BurnAimDirection = Number.isFinite(BurnUpdate.directionX) && Number.isFinite(BurnUpdate.directionY)
      ? { x: BurnUpdate.directionX, y: BurnUpdate.directionY }
      : null;
    applyBreakerBurnAtCurrentStep();
  }
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

  const CollectedStardustBefore = FlightCollectedStardustIdentifiers.size;
  const IgnoredBodyDefinition = LaunchIgnoredBodyIdentifier
    ? TacticalBodyDefinitions.find(
      (BodyDefinition) => BodyDefinition.id === LaunchIgnoredBodyIdentifier,
    ) ?? null
    : null;
  const StepResult = advanceSimulatedFlightStep({
    physicsState: SeedPhysicsState,
    worlds: WorldDefinitions,
    tacticalBodies: getActiveTacticalBodyDefinitions(),
    stardust: StardustDefinitions,
    scoreState: ScoreState,
    fixedStepSeconds: FixedPhysicsStepSeconds,
    simulationTimeSeconds: PhysicsElapsedTimeSeconds,
    ignoredWorldIdentifier: LaunchIgnoredWorldIdentifier,
    ignoredBodyIdentifier: LaunchIgnoredBodyIdentifier,
    ignoredBodyDefinition: IgnoredBodyDefinition,
    flightOriginWorldIdentifier: FlightOriginWorldIdentifier,
    flightCollectedStardust: FlightCollectedStardustIdentifiers,
    outOfBoundsDistance: OutOfBoundsDistance,
  });
  SeedPhysicsState = StepResult.physicsState;
  LaunchIgnoredWorldIdentifier = StepResult.ignoredWorldIdentifier;
  LaunchIgnoredBodyIdentifier = StepResult.ignoredBodyIdentifier;
  if (FlightCollectedStardustIdentifiers.size > CollectedStardustBefore) {
    announceCollectedStardust();
  }

  updateFlightFeedback();

  const SlingshotEvents = StepResult.slingshotEvents;
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

  const CollisionWorldDefinition = StepResult.collisionWorld;
  const CollisionBody = StepResult.collisionBody;

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

  if (StepResult.outOfBounds) {
    recoverSeedFromVoid();
  }
}

function applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) {
  const VeilStrength = getRangeVeilStrength(
    WorldDefinition.id,
    InnerClusterLive,
    getSectorClusterRules(),
  );
  if (VeilStrength <= 0) {
    return 0;
  }
  WorldRuntime.stillnessCageGroup.visible = true;
  WorldRuntime.stillnessCageGroup.scale.setScalar(1.06 + (VeilStrength * 0.1));
  WorldRuntime.stillnessCageMaterial.opacity = WorldDefinition.restored
    ? 0.1 * VeilStrength
    : Math.max(WorldRuntime.stillnessCageMaterial.opacity, 0.36 * VeilStrength);
  if (WorldRuntime.atmosphereMaterial && Number.isFinite(WorldRuntime.atmosphereMaterial.opacity)) {
    WorldRuntime.atmosphereMaterial.opacity *= 1 - (0.62 * VeilStrength);
  }
  return VeilStrength;
}

/**
 * Advances the signature spherical restoration wave, staged surface growth and atmosphere.
 *
 * @param {number} ElapsedTimeSeconds - Total elapsed game time.
 */
function updateWorldRestorationVisuals(ElapsedTimeSeconds) {
  const InnerClusterLive = isLiveInnerCluster();
  const VeiledWorldIdentifiers = [];
  GameCanvas.dataset.innerClusterLive = String(InnerClusterLive);
  for (const WorldDefinition of WorldDefinitions) {
    const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);

    if (!WorldDefinition.restored) {
      WorldRuntime.group.rotation.y += 0.0005;
      WorldRuntime.stillnessCageGroup.rotation.y += 0.0015;
      if (WorldRuntime.atmosphereMaterial?.color) {
        WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor);
        WorldRuntime.atmosphereMaterial.opacity = 0.11;
      }
      if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
        VeiledWorldIdentifiers.push(WorldDefinition.id);
      }
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
    if (WorldRuntime.atmosphereMaterial?.color) {
      AtmosphereRestoreColor.set(WorldDefinition.atmosphereColor);
      WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor).lerp(
        AtmosphereRestoreColor,
        AtmosphereProgress,
      );
    }
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
          const ShouldPreserveWardenReveal = (
            WardenPursuitState.lastEvent === WardenPursuitEvents.revealed
            && GameCanvas.dataset.wardenArrivalBroadcast !== ''
          );
          GameCanvas.dataset.lastMemory = WorldDefinition.memory;
          if (!ShouldPreserveWardenReveal) {
            showStatusToast(WorldDefinition.memory, 2100, 'memory');
          }
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
            if (PrefersReducedMotion || !RelayRevealLookTarget) {
              RelayRevealLookTarget = null;
              RelayRevealHoldUntilSeconds = 0;
              GameCanvas.dataset.relayReveal = '';
            } else {
              RelayRevealHoldUntilSeconds = ElapsedTimeSeconds + getRelayRevealHoldDurationSeconds({
                liveRelayCount: countLiveRelayWorlds(RelayNetworkState),
                prefersReducedMotion: PrefersReducedMotion,
              });
            }
            const EncounterDefinition = WorldDefinition.hostileEncounter
              ?? (
                PendingRecaptureCutWorldIdentifier === WorldDefinition.id
                  ? getLeftoverHostileEncounter()
                  : null
              );
            const DidBeginHostileEncounter = beginHostileEncounter(
              WorldDefinition,
              EncounterDefinition,
            );
            if (DidBeginHostileEncounter
              && PendingRecaptureCutWorldIdentifier === WorldDefinition.id) {
              RecaptureCutGiftAvailable = false;
              PendingRecaptureCutWorldIdentifier = null;
              showStatusToast('RECAPTURE CUT', 1350);
            }
            if (!DidBeginHostileEncounter && !ShouldPreserveWardenReveal) {
              showRouteChoiceInstruction();
            }
            flushQueuedStoryBoardsIfReady();
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
    if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
      VeiledWorldIdentifiers.push(WorldDefinition.id);
    }
  }
  GameCanvas.dataset.rangeVeil = InnerClusterLive ? 'lifted' : VeiledWorldIdentifiers.join(',');
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

function updateWorldLifeAudio() {
  let TyrantWorldCount = 0;
  let IsolatedWorldCount = 0;
  let LivingWorldCount = 0;
  for (const WorldDefinition of WorldDefinitions) {
    const LifeStage = getWorldLifeStage({
      restored: WorldDefinition.restored,
      liveLinkCount: getRelayDegree(RelayNetworkState, WorldDefinition.id),
    });
    if (LifeStage === 'tyrant') TyrantWorldCount += 1;
    else if (LifeStage === 'isolated') IsolatedWorldCount += 1;
    else LivingWorldCount += 1;
  }
  WorldseedSound.setWorldLifeMix(getWorldLifeAudioMix({
    tyrantWorldCount: TyrantWorldCount,
    isolatedWorldCount: IsolatedWorldCount,
    livingWorldCount: LivingWorldCount,
  }));
  const MusicStage = getStoryMusicStage({
    innerClusterLive: isLiveInnerCluster(),
    wardenStatus: WardenPursuitState.status,
  });
  WorldseedSound.setStoryMusicStage(MusicStage);
  GameCanvas.dataset.storyMusicStage = MusicStage;
  const MaximumScoutScale = getActiveMaximumScoutZoomScale();
  if (ScoutZoomScale > MaximumScoutScale) {
    ScoutZoomScale = MaximumScoutScale;
    GameCanvas.dataset.scoutZoom = ScoutZoomScale.toFixed(2);
  }
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

  const IsWalking = (
    PointerGestureMode === SurfaceGestureModes.walk
    || RunnerWalkLifeSeconds > 0
  ) && GamePhase === 'attached';
  if (RunnerWalkLifeSeconds > 0) {
    RunnerWalkLifeSeconds = Math.max(0, RunnerWalkLifeSeconds - DeltaTimeSeconds);
  }
  const RunnerAnimationState = getRunnerAnimationState(
    GamePhase,
    IsPointerAiming || IsKeyboardAiming,
    IsWalking && !PrefersReducedMotion,
  );
  const RunnerPose = getRunnerPose(
    RunnerAnimationState,
    ElapsedTimeSeconds * 9.2,
  );
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
      THREE.MathUtils.lerp(0.62, 1.08, UnfoldProgress) * ShipPresentationScale,
      THREE.MathUtils.lerp(0.82, 1, UnfoldProgress) * ShipPresentationScale,
      ShipPresentationScale,
    );
  } else {
    ShipVisualGroup.scale.set(
      1.08 * ShipPresentationScale,
      ShipPresentationScale,
      ShipPresentationScale,
    );
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
    updateFlightPlanningPresentation();
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
    && !HasLaunchedOnce
    && !IsOpeningBriefingActive;
  PullGuideLine.visible = IsOpeningCoachVisible;
  updateTargetBeacons(ElapsedTimeSeconds);
  if (IsOpeningCoachVisible) {
    PullGuideMaterial.dashOffset -= DeltaTimeSeconds * 0.9;
  }
  if (CutGuideLine.visible) {
    CutGuideMaterial.dashOffset -= DeltaTimeSeconds * 1.4;
  }
  if (CircuitBeaconLine.visible) {
    CircuitBeaconMaterial.dashOffset -= DeltaTimeSeconds * 0.55;
  }
}

/** Keeps Scout and aim zoom labels, limits and optional announcements in one shared state. */
function refreshPlanningZoomControls({ announce = false } = {}) {
  const Visible = IsScoutMode || shouldUseSectorPlanningCamera();
  ScoutZoomOutButtonElement.hidden = !Visible;
  ScoutZoomInButtonElement.hidden = !Visible;
  if (!Visible) {
    if (!IsScoutMode) ScoutZoomStatusElement.textContent = '';
    return;
  }
  const Scale = shouldUseSectorPlanningCamera() && !IsScoutMode
    ? AimZoomScale
    : (IsScoutMode ? ScoutZoomScale : CameraZoomScale);
  const Presentation = getScoutZoomPresentation(Scale, {
    minimumScale: MinimumScoutZoomScale,
    maximumScale: getActiveMaximumScoutZoomScale(),
  });
  ScoutZoomInButtonElement.setAttribute('aria-disabled', String(!Presentation.canZoomIn));
  ScoutZoomOutButtonElement.setAttribute('aria-disabled', String(!Presentation.canZoomOut));
  ScoutZoomInButtonElement.setAttribute('aria-label', Presentation.zoomInLabel);
  ScoutZoomOutButtonElement.setAttribute('aria-label', Presentation.zoomOutLabel);
  if (announce) ScoutZoomStatusElement.textContent = Presentation.status;
}

function updateScoutZoomInterface({ announce = false } = {}) {
  refreshPlanningZoomControls({ announce });
}

function setScoutMode(Enabled, { snapToRunner = true } = {}) {
  const CanScout = ActiveSystem.camera?.followPlayer === true
    && GamePhase === 'attached'
    && ReplayPlaybackState === null;
  const WasScoutMode = IsScoutMode;
  IsScoutMode = Enabled && CanScout;
  if (IsScoutMode) {
    ScoutCameraTarget.copy(CameraLookTarget);
  } else if (snapToRunner) {
    ScoutCameraTarget.set(SeedPhysicsState.position.x, SeedPhysicsState.position.y, 0);
    CameraPanOffset.set(0, 0, 0);
  }
  const ShouldRestoreScoutButtonFocus = !IsScoutMode
    && (
      document.activeElement === ScoutZoomOutButtonElement
      || document.activeElement === ScoutZoomInButtonElement
    );
  ScoutButtonElement.textContent = IsScoutMode ? 'Runner [C]' : 'Scout [C]';
  ScoutButtonElement.setAttribute('aria-pressed', String(IsScoutMode));
  if (!IsScoutMode) {
    ScoutZoomStatusElement.textContent = WasScoutMode ? 'Scout view off' : '';
  }
  refreshPlanningZoomControls({ announce: IsScoutMode });
  GameCanvas.dataset.scoutMode = String(IsScoutMode);
  GameCanvas.dataset.scoutZoom = ScoutZoomScale.toFixed(2);
  GameCanvas.classList.toggle('is-scouting', IsScoutMode && IsPointerScouting);
  if (ShouldRestoreScoutButtonFocus) ScoutButtonElement.focus({ preventScroll: true });
  updatePersonalBestGhostVisibility();
  resizeRenderer();
}

function adjustScoutZoom(Direction) {
  return adjustViewZoom(Direction);
}

function adjustViewZoom(Direction) {
  const MaximumScale = getActiveMaximumScoutZoomScale();
  if (shouldUseSectorPlanningCamera()) {
    const PreviousScale = AimZoomScale;
    AimZoomScale = THREE.MathUtils.clamp(
      AimZoomScale + (Math.sign(Direction) * 0.1),
      MinimumScoutZoomScale,
      MaximumScale,
    );
    const DidChange = AimZoomScale !== PreviousScale;
    if (DidChange) {
      refreshPlanningZoomControls({ announce: true });
      GameCanvas.dataset.aimZoom = AimZoomScale.toFixed(2);
    }
    return DidChange;
  }
  const PreviousScale = CameraZoomScale;
  CameraZoomScale = THREE.MathUtils.clamp(
    CameraZoomScale + (Math.sign(Direction) * 0.1),
    MinimumScoutZoomScale,
    MaximumScale,
  );
  ScoutZoomScale = CameraZoomScale;
  const DidChange = CameraZoomScale !== PreviousScale;
  if (IsScoutMode) updateScoutZoomInterface({ announce: DidChange });
  if (!DidChange) return false;
  GameCanvas.dataset.scoutZoom = CameraZoomScale.toFixed(2);
  resizeRenderer();
  return true;
}

function handleScoutWheel(WheelEventData) {
  if (IsOpeningBriefingActive || ReplayPlaybackState !== null) return;
  if (GamePhase === 'victory' || GamePhase === 'runFailed' || GamePhase === 'victoryPending') {
    return;
  }
  if (adjustViewZoom(WheelEventData.deltaY > 0 ? 1 : -1)) {
    WheelEventData.preventDefault();
  }
}

/**
 * Adds gentle camera follow while the seed is flying without losing the level overview.
 * This is intentionally restrained for motion comfort on phones.
 *
 * @param {number} DeltaTimeSeconds - Real frame delta.
 */
function updateCamera(DeltaTimeSeconds) {
  const UsesExplorationCamera = ActiveSystem.camera?.followPlayer === true;
  const UsesPlanningCamera = UsesExplorationCamera && shouldUseSectorPlanningCamera();
  if (
    GamePhase !== 'victory'
    && GamePhase !== 'victoryPending'
    && Scene.fog
  ) {
    const PlanningAtmosphere = getPlanningAtmosphere({
      isPlanning: UsesPlanningCamera,
      fogDensity: ActiveSystem.environment.fogDensity,
      toneMappingExposure: ActiveSystem.environment.toneMappingExposure,
    });
    Scene.fog.density = PlanningAtmosphere.fogDensity;
    Renderer.toneMappingExposure = PlanningAtmosphere.toneMappingExposure;
  }
  if (UsesExplorationCamera && IsScoutMode) {
    DesiredCameraLookTarget.copy(ScoutCameraTarget);
  } else if (UsesExplorationCamera && RelayRevealLookTarget && !PrefersReducedMotion) {
    DesiredCameraLookTarget.set(RelayRevealLookTarget.x, RelayRevealLookTarget.y, 0);
  } else if (UsesPlanningCamera) {
    DesiredCameraLookTarget.copy(PlanningCameraLookTarget).add(CameraPanOffset);
  } else if (UsesExplorationCamera) {
    DesiredCameraLookTarget.set(
      SeedPhysicsState.position.x + CameraPanOffset.x,
      SeedPhysicsState.position.y + CameraPanOffset.y,
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

  let DesiredDistanceScale = 1;
  if (IsScoutMode) {
    DesiredDistanceScale = ScoutZoomScale;
  } else if (UsesPlanningCamera) {
    DesiredDistanceScale = PlanningCameraScale * AimZoomScale;
  } else if (
    UsesExplorationCamera
    && (GamePhase === 'attached' || GamePhase === 'restoring')
  ) {
    const LandedWorld = getWorldDefinition(CurrentWorldIdentifier);
    DesiredDistanceScale = LandedWorld
      ? getLandedCameraScale({
        worldRadius: LandedWorld.radius,
        viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
      })
      : 0.5;
    GameCanvas.dataset.landedCameraScale = DesiredDistanceScale.toFixed(2);
  }
  if (!IsScoutMode && !UsesPlanningCamera) {
    DesiredDistanceScale *= CameraZoomScale;
  }
  CameraDistanceScale += (DesiredDistanceScale - CameraDistanceScale) * CameraFollowAlpha;

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
  Camera.position.z = BaseCameraDistance * CameraDistanceScale;
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
  refreshInstructionPanelBounds();
  GameCanvas.dataset.viewport = `${ViewportWidth}x${ViewportHeight}`;
  GameCanvas.dataset.orientation = ViewportWidth >= ViewportHeight ? 'landscape' : 'portrait';
  Camera.aspect = ViewportAspectRatio;
  Camera.far = 480;
  Camera.near = 0.1;

  const RequiredWorldHeight = ActiveSystem.camera?.viewportWorldHeight ?? 29;
  const RequiredWorldWidth = ActiveSystem.camera?.viewportWorldWidth ?? 25;
  const HalfVerticalFieldOfViewRadians = THREE.MathUtils.degToRad(Camera.fov * 0.5);
  const DistanceForHeight = RequiredWorldHeight / (2 * Math.tan(HalfVerticalFieldOfViewRadians));
  const DistanceForWidth = RequiredWorldWidth / (
    2 * Math.tan(HalfVerticalFieldOfViewRadians) * Math.max(ViewportAspectRatio, 0.2)
  );
  BaseCameraDistance = Math.max(DistanceForHeight, DistanceForWidth, 34);
  Camera.position.z = BaseCameraDistance * (IsScoutMode ? ScoutZoomScale : CameraDistanceScale);
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
  const NextPresentationTier = getAdaptivePresentationTier(AdaptivePixelRatioCap);
  const DidTierChange = NextPresentationTier !== PresentationQualityTier;
  PresentationQualityTier = NextPresentationTier;
  const ShadowsEnabled = PresentationQualityTier === 'high';
  if (KeyLight.castShadow !== ShadowsEnabled) {
    KeyLight.castShadow = ShadowsEnabled;
    Renderer.shadowMap.enabled = ShadowsEnabled;
  }
  GameCanvas.dataset.adaptiveQuality = QualityState.action;
  GameCanvas.dataset.presentationTier = PresentationQualityTier;
  GameCanvas.dataset.smoothPerformanceSamples = String(SmoothPerformanceSampleCount);
  if (!DidCapChange && !DidTierChange) return;
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

  if (
    IsReleaseDiagnosticsEnabled
    && (PerformanceSampleFrameCount === 1 || MaximumObservedDrawCalls > PreviousMaximumDrawCalls)
  ) {
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
  resetHud();
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
  CameraZoomScale = 1;
  AimZoomScale = 1;
  CameraPanOffset.set(0, 0, 0);
  PointerByIdentifier.clear();
  PinchState = null;
  IsBurnAiming = false;
  BurnAimDirection = null;
  HasTaughtBurn = false;
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
  CameraDistanceScale = 1;
  PlanningCameraScale = 1;
  releaseAimInteractionCamera();
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  ScoutButtonElement.textContent = 'Scout [C]';
  ScoutButtonElement.setAttribute('aria-pressed', 'false');
  ScoutZoomOutButtonElement.hidden = true;
  ScoutZoomInButtonElement.hidden = true;
  ScoutZoomStatusElement.textContent = '';
  updateScoutZoomInterface();
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
  GameCanvas.dataset.keyboardAimAssist = '';
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
  resetWardenVisuals();
  GameCanvas.dataset.lastSuppressedWorld = '';
  GameCanvas.dataset.wardenCaughtWorld = '';
  GameCanvas.dataset.wardenArrivalAnswer = '';
  GameCanvas.dataset.wardenArrivalBroadcast = '';
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
  PredictedSlingshotWorldIdentifiers.clear();
  FlightCollectedStardustIdentifiers.clear();
  IsCutAiming = false;
  CutAimPointer = null;
  hideCutGuide();
  ActiveHostileEncounterState = null;
  CompletedHostileEncounterWorldIdentifiers.clear();
  HostilePylonGroup.visible = false;
  RecaptureCutGiftAvailable = false;
  PendingRecaptureCutWorldIdentifier = null;
  HasAnnouncedCommandLockGift = false;
  CommittedPredictionPoints = null;
  resetLivingWorldVisuals();
  GameCanvas.dataset.predictionHoldActive = '';
  GamePhase = 'attached';
  updateBreakerBurnInterface();
  PhysicsAccumulatorSeconds = 0;
  PhysicsElapsedTimeSeconds = 0;
  GameElapsedTimeSeconds = 0;
  RelayRevealLookTarget = null;
  RelayRevealHoldUntilSeconds = 0;
  CourierStartTimesByLinkId.clear();
  GameCanvas.dataset.relayReveal = '';
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
  if (!beginOpeningBriefing()) {
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
    if (ActiveSystem.openingBroadcast) {
      showStatusToast(ActiveSystem.openingBroadcast, 2200, 'warden');
    }
    if (ShouldRestoreCanvasFocus) {
      GameCanvas.focus({ preventScroll: true });
    }
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
      (LeaderboardListElement.querySelector('button') ?? CloseLeaderboardButtonElement)
        .focus({ preventScroll: true });
    }
  } catch (CaughtError) {
    setLeaderboardStatus(CaughtError instanceof Error
      ? CaughtError.message
      : 'Score could not be submitted.');
    SubmitScoreButtonElement.disabled = false;
    CallsignInputElement.focus({ preventScroll: true });
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
  hideOpeningBriefing();
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

  if (IsOpeningBriefingActive) {
    Clock.getDelta();
    Renderer.render(Scene, Camera);
    return;
  }

  const DeltaTimeSeconds = Math.min(Clock.getDelta(), MaximumFrameDeltaSeconds);
  GameElapsedTimeSeconds += DeltaTimeSeconds;
  const ElapsedTimeSeconds = GameElapsedTimeSeconds;
  invalidateLiveRelayQueryCache();

  PhysicsAccumulatorSeconds += DeltaTimeSeconds;
  while (PhysicsAccumulatorSeconds >= FixedPhysicsStepSeconds) {
    simulateSeedFixedStep();
    PhysicsAccumulatorSeconds -= FixedPhysicsStepSeconds;
  }

  updateWorldRestorationVisuals(ElapsedTimeSeconds);
  updateOccupationScarVisuals(ElapsedTimeSeconds);
  refreshDockedTradeState(ElapsedTimeSeconds);
  updateProsperityBuildingVisuals(ElapsedTimeSeconds);
  updateExtractionFreighterVisuals(ElapsedTimeSeconds);
  updateInhabitantVisuals(ElapsedTimeSeconds);
  if (PresentationQualityTier !== 'degraded' && !PrefersReducedMotion) {
    updateWorldBiomeMotion(DeltaTimeSeconds, ElapsedTimeSeconds);
  }
  updateFinaleRestorationVisuals(ElapsedTimeSeconds);
  updateRelayNetworkVisuals(ElapsedTimeSeconds);
  updateSlingshotBandVisuals(ElapsedTimeSeconds);
  updateWardenVisuals(DeltaTimeSeconds, ElapsedTimeSeconds);
  updateSeedVisuals(DeltaTimeSeconds, ElapsedTimeSeconds);
  if (
    RelayRevealLookTarget
    && RelayRevealHoldUntilSeconds > 0
    && ElapsedTimeSeconds >= RelayRevealHoldUntilSeconds
  ) {
    RelayRevealLookTarget = null;
    RelayRevealHoldUntilSeconds = 0;
    GameCanvas.dataset.relayReveal = '';
    flushQueuedStoryBoardsIfReady();
  }
  updateCamera(DeltaTimeSeconds);
  updateTacticalBodies(ElapsedTimeSeconds, CachedInstructionPanelTop);
  updateStardustVisuals(ElapsedTimeSeconds);
  updateRouteLabels(CachedInstructionPanelTop);
  updateFlightAudio();
  updateWorldLifeAudio();
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
    GameCanvas.dataset.keyboardAimAssist = '';
    if (
      CanceledPointerIdentifier !== null
      && GameCanvas.hasPointerCapture(CanceledPointerIdentifier)
    ) {
      GameCanvas.releasePointerCapture(CanceledPointerIdentifier);
    }
    GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
    AimPanelElement.hidden = true;
    releaseAimInteractionCamera();
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

function toggleAudioPreference() {
  const Presentation = getAudioPreferencePresentation(WorldseedSound.toggleMute());
  AudioButtonElement.textContent = Presentation.label;
  AudioButtonElement.setAttribute('aria-pressed', Presentation.ariaPressed);
  showStatusToast(Presentation.status, 850);
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
  if (IsOpeningBriefingActive) {
    const PressedBriefingKey = KeyboardEventData.key.toLowerCase();
    if (PressedBriefingKey === 'escape') {
      KeyboardEventData.preventDefault();
      finishOpeningBriefing();
      return;
    }
    if (PressedBriefingKey === 'enter' || PressedBriefingKey === ' ') {
      if (OpeningBriefingElement.contains(KeyboardEventData.target)
        && KeyboardEventData.target.tagName === 'BUTTON') {
        return;
      }
      KeyboardEventData.preventDefault();
      advanceOpeningBriefing();
      return;
    }
    if (KeyboardEventData.key === 'Tab') {
      const FocusableElements = [BriefingContinueButtonElement, BriefingSkipButtonElement];
      const FirstFocusableElement = FocusableElements[0];
      const LastFocusableElement = FocusableElements.at(-1);
      if (KeyboardEventData.shiftKey && document.activeElement === FirstFocusableElement) {
        KeyboardEventData.preventDefault();
        LastFocusableElement?.focus();
      } else if (!KeyboardEventData.shiftKey && document.activeElement === LastFocusableElement) {
        KeyboardEventData.preventDefault();
        FirstFocusableElement?.focus();
      }
      return;
    }
  }
  if (KeyboardEventData.key === 'Escape' && !LeaderboardPanelElement.hidden) {
    KeyboardEventData.preventDefault();
    closeLeaderboardPanel();
    return;
  }
  const ActiveModalElement = !LeaderboardPanelElement.hidden
    ? LeaderboardPanelElement
    : (!VictoryPanelElement.hidden
      ? VictoryPanelElement
      : (IsOpeningBriefingActive ? OpeningBriefingElement : null));
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
  if ((PressedKey === ' ' || PressedKey === 'enter') && ActiveHostileEncounterState) {
    KeyboardEventData.preventDefault();
    if (IsCutAiming) fireHostileCutFromPreview();
    else fireNearestHostileCut();
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
  if (
    (IsScoutMode || shouldUseSectorPlanningCamera())
    && (PressedKey === '+' || PressedKey === '=' || PressedKey === '-')
  ) {
    KeyboardEventData.preventDefault();
    adjustViewZoom(PressedKey === '-' ? 1 : -1);
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
    toggleAudioPreference();
  } else if (PressedKey === 'p') {
    KeyboardEventData.preventDefault();
    selectNextMotionPreference();
  }
});
document.addEventListener('focusin', (FocusEventData) => {
  const ActiveModalElement = !LeaderboardPanelElement.hidden
    ? LeaderboardPanelElement
    : (!VictoryPanelElement.hidden
      ? VictoryPanelElement
      : (IsOpeningBriefingActive ? OpeningBriefingElement : null));
  if (!ActiveModalElement || ActiveModalElement.contains(FocusEventData.target)) {
    return;
  }
  ActiveModalElement.querySelector('input:not([disabled]), button:not([disabled])')
    ?.focus({ preventScroll: true });
});
ResetButtonElement.addEventListener('click', resetGame);
ReplayButtonElement.addEventListener('click', resetGame);
BriefingContinueButtonElement.addEventListener('click', (PointerEventData) => {
  PointerEventData.stopPropagation();
  advanceOpeningBriefing();
});
BriefingSkipButtonElement.addEventListener('click', (PointerEventData) => {
  PointerEventData.stopPropagation();
  finishOpeningBriefing();
});
WatchReplayButtonElement.addEventListener('click', watchCompletedReplay);
LeaderboardButtonElement.addEventListener('click', openLeaderboardPanel);
LeaderboardFormElement.addEventListener('submit', submitVerifiedScore);
CloseLeaderboardButtonElement.addEventListener('click', () => closeLeaderboardPanel());
PlayAgainButtonElement.addEventListener('click', continueCampaignOrReplay);
AudioButtonElement.addEventListener('click', () => {
  toggleAudioPreference();
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

resizeRenderer();
resetGame();
applyMotionPreference();
renderFrame();
