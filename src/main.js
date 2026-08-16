import * as THREE from 'three';

import { WorldseedAudio } from './audio.js?v=20260815-ob87';
import {
  SurfaceGestureModes,
  createKeyboardAimState,
  getKeyboardAimDragVector,
  getSphereSurfacePosition,
  getSurfacePosition,
  isEditingTextField,
  LaunchCancelRadius,
  shouldCancelAimedLaunch,
} from './controls.js?v=20260816-ob98';
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
import { createWorldVisuals } from './world-geometry.js?v=20260816-ob96';
import { createLivingWorldVisuals } from './living-world-visuals.js?v=20260816-ob96';
import { createWardenVisuals } from './warden-visuals.js?v=20260815-ob90';
import { createPlayerVisuals } from './player-visuals.js?v=20260815-ob90';
import { createStoryDirector } from './story-director.js?v=20260816-ob91';
import { createHud } from './hud.js?v=20260815-ob90';
import { createAimPreview } from './aim-preview.js?v=20260816-ob97';
import { createLandingDirector } from './landing-director.js?v=20260816-ob93';
import { createCameraController } from './camera-controller.js?v=20260816-ob97';
import { createInputController } from './input-controller.js?v=20260816-ob97';
import { createHostileSurface } from './hostile-surface.js?v=20260816-ob93';
import { createScanner } from './scanner.js?v=20260815-ob90';
import { createRoutePresentation } from './route-presentation.js?v=20260815-ob90';
import { createRecordsUi } from './records-ui.js?v=20260816-ob98';
import { createFrameVisuals } from './frame-visuals.js?v=20260816-ob93';
import { createRestorationVisuals } from './restoration-visuals.js?v=20260816-ob92';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js?v=0.179.1';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js?v=0.179.1';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js?v=0.179.1';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js?v=0.179.1';

import {
  DefaultAuthoredSystemIdentifier,
  createAuthoredSystemRuntime,
  getAuthoredSystemDefinition,
  getNextAuthoredSystemIdentifier,
} from './content.js?v=20260816-ob91';

import {
  getLandingAccolade,
  getRestorableWorlds,
  getRouteChoices,
  getTrajectoryPickupIdentifiers,
  isSystemRestored,
  isWorldheartUnlocked,
} from './campaign.js?v=20260814-ob8';

import {
  MaximumLaunchSpeed,
  applyBreakerBurn,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  createOrbitTrapState,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  predictTrajectory,
  simulatePhysicsStep,
} from './physics.js?v=20260816-ob92';
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
  collectFlightStardust,
  resolveWardenAfterNonCommandFlight,
  rollbackFlightStardust as rollbackSharedFlightStardust,
} from './flight-resolver.js?v=20260816-ob92';
import { createLeaderboardClient, resolveLeaderboardBaseUrl } from './leaderboard-client.js?v=20260816-ob91';
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
} from './network.js?v=20260815-ob87';
import {
  WardenPursuitEvents,
  createWardenPursuitState,
} from './warden.js?v=20260815-ob81';
import {
  loadPersonalBest,
} from './records.js?v=20260814-ob8';
import {
  getControlModePresentation,
  getExtractionFreighterTravelProgress,
  getCourierDockWorldRole,
  getInhabitantSilhouette,
  getLeaderboardActionLabel,
  getLiveLinkShipCount,
  getStoryBoardPresentation,
  getTriggeredCampaignStoryBoardIds,
  isCampaignStoryBoardReadyToPresent,
  getProsperityBuildingKind,
  getProsperityBuildingProfile,
  getProsperityPresence,
  getProsperityStage,
  getPublishedWardenState,
  getRelayCourierTravelProgress,
  PlanningMaximumZoomScale,
  PlanningMinimumZoomScale,
  getRelayLinkOpacity,
  getRunUnlockState,
  shouldAssistCommandLock,
  shouldHoldCommittedPrediction,
  getSlingshotBandVisualState,
  getSlingshotPreviewPresentation,
  getWardenApproachCopy,
  shouldShowInhabitantSlot,
  getTradeHullColor,
  getTradeHullKind,
  getTradeHullScale,
  getTyrantOccupationStrength,
  getWorldLifeAudioMix,
  getStoryMusicStage,
  getWorldLifeStage,
  getWorldLandingAimLabel,
} from './presentation.js?v=20260816-ob96';
import {
  PhysicsModelVersion,
  createReplayRecorder,
  recordReplayBurn,
  recordReplayLaunch,
} from './replay.js?v=20260815-ob83';
import {
  consumeDueReplayBurn,
  consumeDueReplayLaunch,
} from './replay-playback.js?v=20260815-ob83';
import {
  createRunState,
  failRunToWarden,
  releaseRunLaunch,
  settleRunFlight,
} from './run.js?v=20260815-ob22';
import {
  bankFlightScore,
  createScoreState,
  getSlingshotBandRadii,
  predictSlingshotEvents,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from './scoring.js?v=20260816-ob98';

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
const LeaderboardApiBaseUrl = resolveLeaderboardBaseUrl({
  configuredBaseUrl: ConfiguredLeaderboardApiBaseUrl,
  queryOverride: PageSearchParameters.get('leaderboardApi'),
  hostname: window.location.hostname,
});
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

const GameShellElement = document.querySelector('#GameShell');
const GameCanvas = document.querySelector('#GameCanvas');
const ModeChipElement = document.querySelector('#ModeChip');
const ModeChipLabelElement = document.querySelector('#ModeChipLabel');
const ModeChipHintElement = document.querySelector('#ModeChipHint');
const LiberationFlashElement = document.querySelector('#LiberationFlash');
const ScoreBurstElement = document.querySelector('#ScoreBurst');
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
GameCanvas.dataset.build = '20260816-ob98';
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

/**
 * Post pipeline: bright emissive work (relays, the liberation wave, trajectory
 * light, town windows, the Warden) blooms so everything the player connects
 * visibly glows against the dark sector. Devices that fall to the degraded
 * presentation tier render directly without the composer.
 */
const Composer = new EffectComposer(Renderer);
const ScenePass = new RenderPass(Scene, Camera);
const BloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.82);
const CompositeOutputPass = new OutputPass();
Composer.addPass(ScenePass);
Composer.addPass(BloomPass);
Composer.addPass(CompositeOutputPass);
let IsBloomPipelineEnabled = true;

/** Renders through the bloom composer unless the adaptive tier disabled it. */
function renderScene() {
  if (IsBloomPipelineEnabled) {
    Composer.render();
  } else {
    Renderer.render(Scene, Camera);
  }
}

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
let HasCommittedAimCamera = false;
let LastAimScreenDistancePixels = Number.POSITIVE_INFINITY;
let FlightOrbitTrapState = createOrbitTrapState();
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
let StoryLookFocus = null;
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
let AttachedWorldheartSurfaceLatitude = 0;
let AttachedSurfaceMeridianSign = 1;
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
const Scanner = createScanner({
  GameCanvas,
  ScannerPanelElement,
  ScannerBodyLayerElement,
  ScannerRunnerElement,
  ActiveSystem,
  WorldDefinitions,
  WorldheartDefinition,
  AsteroidDefinition,
  getWorldDefinition,
  get SeedPhysicsState() { return SeedPhysicsState; },
  get PhysicsElapsedTimeSeconds() { return PhysicsElapsedTimeSeconds; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get GamePhase() { return GamePhase; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RelayNetworkState() { return RelayNetworkState; },
});
const {
  projectScannerPosition,
  configureScannerInterface,
  updateScannerInterface,
} = Scanner;
configureScannerInterface();

const WorldRuntimeByIdentifier = new Map();
const WorldRuntimesByVisualKey = new Map();
const EmptyWorldRuntimeList = [];
const ShaderMotionVisualKeys = ['grove', 'tide'];
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
  get ScannerProjection() { return Scanner.ScannerProjection; },
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
  const ApproachCopy = getWardenApproachCopy({
    defeated: IsCommandDefeated,
    exposed: IsCommandExposed,
    distance: WardenPursuitState.distance,
    targetLabel: TargetWorld?.label ?? '',
    blocked: getFrameLiveRelayCircuits().length > 0,
  });
  WardenStateLabelElement.textContent = ApproachCopy.state;
  WardenDistanceElement.textContent = ApproachCopy.distance;
  WardenTargetElement.textContent = ApproachCopy.target;
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
  ScoreBurstElement,
  Camera,
  ScoreBurstProjection: new THREE.Vector3(),
  GameCanvas,
  WorldDefinitions,
  RestorableWorldCount,
  StardustDefinitions,
  WorldheartDefinition,
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  get PrefersReducedMotion() { return PrefersReducedMotion; },
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
  showScoreBurst,
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
      `Each launch is one Warden step — ${WardenPursuitState.distance} flights away, targeting ${TargetWorld?.label ?? 'the frontier'}. Close a gold loop to push it back.`,
    );
    GameCanvas.dataset.wardenArrivalBroadcast = ActiveSystem.wardenArrivalBroadcast ?? '';
    RecaptureCutGiftAvailable = true;
    publishRunUnlockState();
    if (ActiveSystem.wardenArrivalBroadcast && !ActiveSystem.storyBoards?.wardenArrival) {
      showStatusToast(ActiveSystem.wardenArrivalBroadcast, 3600, 'warden');
    }
  } else if (WardenPursuitState.lastEvent === WardenPursuitEvents.advanced) {
    showStatusToast(
      `WARDEN → ${TargetWorld?.label ?? 'FRONTIER'} · ${WardenPursuitState.distance} FLIGHTS AWAY`,
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

let TrailEmissionAccumulatorSeconds = 0;


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
    const SurfacePosition = getSphereSurfacePosition(
      WorldheartDefinition.position,
      WorldheartDefinition.radius + SeedRadius + 0.03,
      {
        longitude: AttachedWorldheartSurfaceAngle,
        latitude: AttachedWorldheartSurfaceLatitude,
      },
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

const RoutePresentation = createRoutePresentation(THREE, {
  Camera,
  WardenPanelElement,
  StatusToastElement,
  RouteLabelElements,
  TacticalLabelElements,
  TacticalLabelScreenPositions,
  RouteLabelProjection,
  TargetBeaconMesh,
  TargetBeaconMaterial,
  TargetBeaconTransform,
  TacticalBodyMesh,
  TacticalBodyTransform,
  AsteroidOrbitLine,
  AsteroidOrbitMaterial,
  SeedstoneOrbitLine,
  SeedstoneOrbitMaterial,
  WorldheartOpenColor,
  WorldheartLockedColor,
  SeedstoneDefinition,
  AsteroidDefinition,
  WorldheartDefinition,
  WorldDefinitions,
  CampaignNodeDefinitions,
  TacticalBodyDefinitions,
  ActiveSystem,
  showInstruction,
  isLiveInnerCluster,
  getWorldDefinition,
  synchronizeSeedstonePosition,
  synchronizeWorldheartPosition,
  get GamePhase() { return GamePhase; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get SeedstoneUsesRemaining() { return SeedstoneUsesRemaining; },
  get SeedstoneCrumbleStartedAtSeconds() { return SeedstoneCrumbleStartedAtSeconds; },
  get PhysicsElapsedTimeSeconds() { return PhysicsElapsedTimeSeconds; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RelayNetworkState() { return RelayNetworkState; },
  get RunState() { return RunState; },
});
const {
  getActiveTacticalBodyDefinitions,
  getCurrentRouteChoices,
  showRouteChoiceInstruction,
  updateTargetBeacons,
  updateRouteLabels,
  updateTacticalBodies,
} = RoutePresentation;





const RecordsUi = createRecordsUi(THREE, {
  GameCanvas,
  ActiveSystem,
  WorldheartDefinition,
  StardustDefinitions,
  WorldDefinitions,
  LeaderboardClient,
  PersonalBestGhostLine,
  PersonalBestGhostGeometry,
  GhostButtonElement,
  VictoryPanelElement,
  VictoryTitleElement,
  VictoryBodyElement,
  WatchReplayButtonElement,
  ReplayIndicatorElement,
  PersonalBestLabelElement,
  ResultSlingshotScoreElement,
  ResultLiberationScoreElement,
  ResultCompletionBonusElement,
  ResultFlightTimeElement,
  EmblemElements,
  LeaderboardStatusElement,
  LeaderboardListElement,
  LeaderboardPanelElement,
  LeaderboardFormElement,
  LeaderboardButtonElement,
  CallsignInputElement,
  CloseLeaderboardButtonElement,
  SubmitScoreButtonElement,
  getWorldDefinition,
  showInstruction,
  showStatusToast,
  resetGame: (...Args) => resetGame(...Args),
  hideOpeningBriefing: (...Args) => hideOpeningBriefing(...Args),
  get ReplayState() { return ReplayState; },
  set ReplayState(Value) { ReplayState = Value; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
  set ReplayPlaybackState(Value) { ReplayPlaybackState = Value; },
  get HasPersonalBestGhost() { return HasPersonalBestGhost; },
  set HasPersonalBestGhost(Value) { HasPersonalBestGhost = Value; },
  get IsPersonalBestGhostEnabled() { return IsPersonalBestGhostEnabled; },
  set IsPersonalBestGhostEnabled(Value) { IsPersonalBestGhostEnabled = Value; },
  get IsScoutMode() { return IsScoutMode; },
  get GamePhase() { return GamePhase; },
  get LeaderboardLoadSequence() { return LeaderboardLoadSequence; },
  set LeaderboardLoadSequence(Value) { LeaderboardLoadSequence = Value; },
  get ScoreState() { return ScoreState; },
  get RunState() { return RunState; },
  get RunFlightTimeSeconds() { return RunFlightTimeSeconds; },
  get ConstellationNodeElements() { return ConstellationNodeElements; },
});
const {
  formatFlightTime,
  publishFinishedReplay,
  updatePersonalBestGhostVisibility,
  configurePersonalBestGhost,
  loadPersonalBestGhost,
  savePersonalBestGhost,
  setPersonalBestGhostEnabled,
  updateVictorySummary,
  setLeaderboardStatus,
  openLeaderboardPanel,
  closeLeaderboardPanel,
  submitVerifiedScore,
  watchSerializedReplay,
  watchCompletedReplay,
} = RecordsUi;

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

/**
 * Computes a stable resting point on a world's surface.
 *
 * @param {object} WorldDefinition - World being landed on.
 * @param {{x:number,y:number,z:number}} ImpactPosition - Approximate collision position.
 * @returns {{x:number,y:number,z:number}} Snapped seed position on the surface.
 */
const HostileSurface = createHostileSurface(THREE, {
  GameCanvas,
  AimPanelElement,
  SeedGroup,
  SeedRadius,
  LaunchCancelRadius,
  get LastAimScreenDistancePixels() { return LastAimScreenDistancePixels; },
  ActiveSystem,
  WorldheartDefinition,
  CutGuideLine,
  CutGuideGeometry,
  CutGuideMaterial,
  HostilePylonGroup,
  CompletedHostileEncounterWorldIdentifiers,
  positionHostilePylons,
  getWorldDefinition,
  publishAttachedSeedState,
  showInstruction,
  clearTrajectoryPreview,
  cancelCutAim: (...Args) => cancelCutAim(...Args),
  updateBreakerBurnInterface: (...Args) => updateBreakerBurnInterface(...Args),
  get GamePhase() { return GamePhase; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get SeedPhysicsState() { return SeedPhysicsState; },
  get CutAimPointer() { return CutAimPointer; },
  get IsCutAiming() { return IsCutAiming; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
  get ActiveHostileEncounterState() { return ActiveHostileEncounterState; },
  set ActiveHostileEncounterState(Value) { ActiveHostileEncounterState = Value; },
  get IsKeyboardAiming() { return IsKeyboardAiming; },
  set IsKeyboardAiming(Value) { IsKeyboardAiming = Value; },
  get IsPointerAiming() { return IsPointerAiming; },
  set IsPointerAiming(Value) { IsPointerAiming = Value; },
  get LastSafeWorldIdentifier() { return LastSafeWorldIdentifier; },
  set LastSafeWorldIdentifier(Value) { LastSafeWorldIdentifier = Value; },
  get LastSafeSeedPosition() { return LastSafeSeedPosition; },
  set LastSafeSeedPosition(Value) { LastSafeSeedPosition = Value; },
  get AttachedWorldheartSurfaceAngle() { return AttachedWorldheartSurfaceAngle; },
  set AttachedWorldheartSurfaceAngle(Value) { AttachedWorldheartSurfaceAngle = Value; },
  get AttachedWorldheartSurfaceLatitude() { return AttachedWorldheartSurfaceLatitude; },
  set AttachedWorldheartSurfaceLatitude(Value) { AttachedWorldheartSurfaceLatitude = Value; },
  get AttachedSurfaceMeridianSign() { return AttachedSurfaceMeridianSign; },
  set AttachedSurfaceMeridianSign(Value) { AttachedSurfaceMeridianSign = Value; },
});
const {
  calculateSurfaceRestPosition,
  getCurrentAttachedWorld,
  getRunnerSurfaceAngle,
  getRunnerSurfacePose,
  getShipCutOrigin,
  getCurrentCutPreview,
  getCurrentCutHitIds,
  hideCutGuide,
  publishHostileEncounterState,
  showHostileEncounterInstruction,
  beginHostileEncounter,
  setRunnerSurfaceAngle,
  setRunnerSurfacePose,
  flattenRunnerToEquator,
  moveRunnerAroundSurface,
  moveRunnerOnSurface,
} = HostileSurface;


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
  get StoryLookFocus() { return StoryLookFocus; },
  set StoryLookFocus(Value) { StoryLookFocus = Value; },
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
  skipStoryBoards,
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


const LandingDirector = createLandingDirector(THREE, {
  WorldRuntimeByIdentifier,
  WorldDefinitions,
  Camera,
  RouteLabelProjection,
  LiberationFlashElement,
  WorldseedSound,
  GameCanvas,
  clearTrajectoryPreview,
  setSurfacePropRestorationProgress,
  updateWorldCounter,
  updateCommandWorldAvailability,
  updateWorldheartObjective,
  showStatusToast,
  showScoreBurst,
  updateScannerInterface,
  SeedGroup,
  ImpactPulseMesh,
  HostilePylonGroup,
  FinaleCoreMesh,
  FinaleLinkMesh,
  FinalePulseMesh,
  FinaleSparkMesh,
  FinaleCoreMaterial,
  FinaleLinkMaterial,
  FinalePulseMaterial,
  FinaleSparkMaterial,
  FinaleLinkPositionValues,
  FinaleLinkPositionAttribute,
  FinalePulseCount,
  FinalePulseTransform,
  FinaleSparkCount,
  FinaleSparkTransform,
  Scene,
  Renderer,
  InitialSceneBackgroundColor,
  FirstRelayAnswerLine,
  SecondRelayAnswerLine,
  ShownStoryBoardIds,
  CompletedHostileEncounterWorldIdentifiers,
  CourierStartTimesByLinkId,
  calculateSurfaceRestPosition,
  publishAttachedSeedState,
  listLiveWorldIdentifiers,
  isLiveInnerCluster,
  isLiveFurtherReach,
  getCurrentLandingAccolade,
  bankCurrentFlight,
  updateScoreInterface,
  synchronizeRelayNetworkVisuals,
  commitFlightStardust,
  resetFlightFeedback,
  showInstruction,
  showRouteChoiceInstruction,
  settleNonCommandFlight,
  getWorldDefinition,
  enqueueCampaignStoryBoards,
  centerLandedCamera: (...Args) => centerLandedCamera(...Args),
  updateBreakerBurnInterface: (...Args) => updateBreakerBurnInterface(...Args),
  hideCutGuide,
  publishHostileEncounterState,
  beginCommandDefeat,
  startWardenEventPulse,
  publishWardenState,
  updateVictorySummary,
  hideInstruction,
  beginHostileEncounter,
  getRunnerSurfaceAngle,
  updateLaunchCounter,
  revealVictoryPanel,
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  get GamePhase() { return GamePhase; },
  set GamePhase(Value) { GamePhase = Value; },
  get GameElapsedTimeSeconds() { return GameElapsedTimeSeconds; },
  get LiberationFlashLifeSeconds() { return LiberationFlashLifeSeconds; },
  set LiberationFlashLifeSeconds(Value) { LiberationFlashLifeSeconds = Value; },
  get CameraImpactLifeSeconds() { return CameraImpactLifeSeconds; },
  set CameraImpactLifeSeconds(Value) { CameraImpactLifeSeconds = Value; },
  get IsBreakerBurnAvailable() { return IsBreakerBurnAvailable; },
  set IsBreakerBurnAvailable(Value) { IsBreakerBurnAvailable = Value; },
  get IsBreakerBurnPending() { return IsBreakerBurnPending; },
  set IsBreakerBurnPending(Value) { IsBreakerBurnPending = Value; },
  get CommittedPredictionPoints() { return CommittedPredictionPoints; },
  set CommittedPredictionPoints(Value) { CommittedPredictionPoints = Value; },
  get FlightOriginWorldIdentifier() { return FlightOriginWorldIdentifier; },
  get ImpactPulseLifeSeconds() { return ImpactPulseLifeSeconds; },
  set ImpactPulseLifeSeconds(Value) { ImpactPulseLifeSeconds = Value; },
  get SeedPhysicsState() { return SeedPhysicsState; },
  set SeedPhysicsState(Value) { SeedPhysicsState = Value; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  set CurrentWorldIdentifier(Value) { CurrentWorldIdentifier = Value; },
  get LastSafeWorldIdentifier() { return LastSafeWorldIdentifier; },
  set LastSafeWorldIdentifier(Value) { LastSafeWorldIdentifier = Value; },
  get LastSafeSeedPosition() { return LastSafeSeedPosition; },
  set LastSafeSeedPosition(Value) { LastSafeSeedPosition = Value; },
  get LaunchIgnoredWorldIdentifier() { return LaunchIgnoredWorldIdentifier; },
  set LaunchIgnoredWorldIdentifier(Value) { LaunchIgnoredWorldIdentifier = Value; },
  get LaunchIgnoredBodyIdentifier() { return LaunchIgnoredBodyIdentifier; },
  set LaunchIgnoredBodyIdentifier(Value) { LaunchIgnoredBodyIdentifier = Value; },
  get RelayNetworkState() { return RelayNetworkState; },
  get ScoreState() { return ScoreState; },
  get RunState() { return RunState; },
  set RunState(Value) { RunState = Value; },
  get RecaptureCutGiftAvailable() { return RecaptureCutGiftAvailable; },
  get PendingRecaptureCutWorldIdentifier() { return PendingRecaptureCutWorldIdentifier; },
  set PendingRecaptureCutWorldIdentifier(Value) { PendingRecaptureCutWorldIdentifier = Value; },
  get ActiveSystem() { return ActiveSystem; },
  get WorldheartDefinition() { return WorldheartDefinition; },
  get SeedstoneDefinition() { return SeedstoneDefinition; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RelayRevealLookTarget() { return RelayRevealLookTarget; },
  set RelayRevealLookTarget(Value) { RelayRevealLookTarget = Value; },
  get ActiveHostileEncounterState() { return ActiveHostileEncounterState; },
  set ActiveHostileEncounterState(Value) { ActiveHostileEncounterState = Value; },
  get WorldheartCompletionTimeoutIdentifier() { return WorldheartCompletionTimeoutIdentifier; },
  set WorldheartCompletionTimeoutIdentifier(Value) { WorldheartCompletionTimeoutIdentifier = Value; },
  get PendingVictoryAfterStoryBoard() { return PendingVictoryAfterStoryBoard; },
  set PendingVictoryAfterStoryBoard(Value) { PendingVictoryAfterStoryBoard = Value; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get IsCampaignFinale() { return IsCampaignFinale; },
  get PendingWorldheartBankedPoints() { return PendingWorldheartBankedPoints; },
  set PendingWorldheartBankedPoints(Value) { PendingWorldheartBankedPoints = Value; },
  get FinaleRestorationStartedAtSeconds() { return FinaleRestorationStartedAtSeconds; },
  set FinaleRestorationStartedAtSeconds(Value) { FinaleRestorationStartedAtSeconds = Value; },
  get AttachedSeedstoneSurfaceOffset() { return AttachedSeedstoneSurfaceOffset; },
  set AttachedSeedstoneSurfaceOffset(Value) { AttachedSeedstoneSurfaceOffset = Value; },
  get AttachedWorldheartSurfaceAngle() { return AttachedWorldheartSurfaceAngle; },
  set AttachedWorldheartSurfaceAngle(Value) { AttachedWorldheartSurfaceAngle = Value; },
  get AttachedWorldheartSurfaceLatitude() { return AttachedWorldheartSurfaceLatitude; },
  set AttachedWorldheartSurfaceLatitude(Value) { AttachedWorldheartSurfaceLatitude = Value; },
  get AttachedSurfaceMeridianSign() { return AttachedSurfaceMeridianSign; },
  set AttachedSurfaceMeridianSign(Value) { AttachedSurfaceMeridianSign = Value; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
});
const {
  restoreWorld,
  suppressWorld,
  attachSeedToWorld,
  attachSeedToSeedstone,
  attachSeedToWorldheart,
  completeWorldheartLiberation,
  updateFinaleRestorationVisuals,
  resetLandingDirector,
} = LandingDirector;


/** Reveals the modal completion summary and moves keyboard focus into it. */
function revealVictoryPanel() {
  VictoryPanelElement.hidden = false;
  ReplayButtonElement.focus({ preventScroll: true });
}

/**
 * Emits one pooled trail particle at the current seed position.
 */
const CameraController = createCameraController(THREE, {
  Camera,
  GameCanvas,
  Scene,
  Renderer,
  CameraLookTarget,
  DesiredCameraLookTarget,
  PlanningCameraLookTarget,
  CameraPanOffset,
  ScoutCameraTarget,
  ScoutZoomOutButtonElement,
  ScoutZoomInButtonElement,
  ScoutZoomStatusElement,
  ScoutButtonElement,
  WorldDefinitions,
  WorldheartDefinition,
  SeedstoneDefinition,
  PredictedSlingshotWorldIdentifiers,
  TrajectoryMaterial,
  MinimumScoutZoomScale,
  isLiveInnerCluster,
  getSectorClusterRules,
  calculateBodyPositionAtTime,
  getWorldDefinition,
  getActiveMaximumScoutZoomScale,
  renderTrajectoryLine,
  predictCurrentLaunchTrajectory,
  updatePersonalBestGhostVisibility,
  resizeRenderer,
  updateScannerInterface,
  getActiveElement: () => document.activeElement,
  get ActiveSystem() { return ActiveSystem; },
  get AimInteractionCamera() { return AimInteractionCamera; },
  set AimInteractionCamera(Value) { AimInteractionCamera = Value; },
  get LastPredictedBodyIdentifier() { return LastPredictedBodyIdentifier; },
  set LastPredictedBodyIdentifier(Value) { LastPredictedBodyIdentifier = Value; },
  get LastPlanningPathPoints() { return LastPlanningPathPoints; },
  set LastPlanningPathPoints(Value) { LastPlanningPathPoints = Value; },
  get IsScoutMode() { return IsScoutMode; },
  set IsScoutMode(Value) { IsScoutMode = Value; },
  get PlanningCameraScale() { return PlanningCameraScale; },
  set PlanningCameraScale(Value) { PlanningCameraScale = Value; },
  get AimZoomScale() { return AimZoomScale; },
  set AimZoomScale(Value) { AimZoomScale = Value; },
  get CameraZoomScale() { return CameraZoomScale; },
  set CameraZoomScale(Value) { CameraZoomScale = Value; },
  get ScoutZoomScale() { return ScoutZoomScale; },
  set ScoutZoomScale(Value) { ScoutZoomScale = Value; },
  get GamePhase() { return GamePhase; },
  get IsPointerAiming() { return IsPointerAiming; },
  get HasCommittedAimCamera() { return HasCommittedAimCamera; },
  set HasCommittedAimCamera(Value) { HasCommittedAimCamera = Value; },
  get IsKeyboardAiming() { return IsKeyboardAiming; },
  get IsPointerScouting() { return IsPointerScouting; },
  get SeedPhysicsState() { return SeedPhysicsState; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get PhysicsElapsedTimeSeconds() { return PhysicsElapsedTimeSeconds; },
  get CameraDistanceScale() { return CameraDistanceScale; },
  set CameraDistanceScale(Value) { CameraDistanceScale = Value; },
  get CameraImpactLifeSeconds() { return CameraImpactLifeSeconds; },
  set CameraImpactLifeSeconds(Value) { CameraImpactLifeSeconds = Value; },
  get RelayRevealLookTarget() { return RelayRevealLookTarget; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
  get CommittedPredictionPoints() { return CommittedPredictionPoints; },
  get FlightElapsedSeconds() { return FlightElapsedSeconds; },
  get LaunchIgnoredWorldIdentifier() { return LaunchIgnoredWorldIdentifier; },
  get LaunchIgnoredBodyIdentifier() { return LaunchIgnoredBodyIdentifier; },
  get RelayNetworkState() { return RelayNetworkState; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RecaptureCutGiftAvailable() { return RecaptureCutGiftAvailable; },
  get IsOpeningBriefingActive() { return IsOpeningBriefingActive; },
  get StoryLookFocus() { return StoryLookFocus; },
  get ActiveStoryBoardTokens() { return ActiveStoryBoardTokens; },
  getWardenLookPosition: () => ({
    x: WardenVisualGroup.position.x,
    y: WardenVisualGroup.position.y,
  }),
  get GameElapsedTimeSeconds() { return GameElapsedTimeSeconds; },
  get BaseCameraDistance() { return BaseCameraDistance; },
  set BaseCameraDistance(Value) { BaseCameraDistance = Value; },
});
const {
  captureAimInteractionCamera,
  releaseAimInteractionCamera,
  rememberPlanningPath,
  getPlanningFocusPoints,
  applySectorPlanningCamera,
  commitAimPlanningCamera,
  clearCommittedAimCamera,
  shouldUseSectorPlanningCamera,
  updateFlightPlanningPresentation,
  refreshPlanningZoomControls,
  updateScoutZoomInterface,
  setScoutMode,
  adjustScoutZoom,
  adjustViewZoom,
  handleScoutWheel,
  updateCamera,
  centerLandedCamera,
} = CameraController;

const FrameVisuals = createFrameVisuals(THREE, {
  GameCanvas,
  Camera,
  SeedGroup,
  RouteLabelProjection,
  StardustDefinitions,
  StardustTransform,
  StardustMesh,
  StardustPredictedColor,
  StardustBaseColor,
  ShaderMotionVisualKeys,
  WorldRuntimesByVisualKey,
  EmptyWorldRuntimeList,
  SurfaceSwayQuaternion,
  LocalSwayAxis,
  TrailParticlePool,
  TrailParticleMesh,
  updateTrailParticleInstance,
  RunnerVisualGroup,
  ShipVisualGroup,
  ShipPresentationScale,
  RunnerArmMeshes,
  RunnerLegMeshes,
  RunnerThrusterGroup,
  SeedHaloMesh,
  SeedHaloMaterial,
  LiberationFlashElement,
  LandingMarkerMesh,
  LaunchPulseMesh,
  ImpactPulseMesh,
  PullGuideLine,
  PullGuideMaterial,
  CutGuideLine,
  CutGuideMaterial,
  CircuitBeaconLine,
  CircuitBeaconMaterial,
  StartingWorldIdentifier,
  TacticalBodyDefinitions,
  getWorldDefinition,
  updateTargetBeacons,
  updateFlightPlanningPresentation,
  get GamePhase() { return GamePhase; },
  get SeedPhysicsState() { return SeedPhysicsState; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get PredictedStardustIdentifiers() { return PredictedStardustIdentifiers; },
  get PointerGestureMode() { return PointerGestureMode; },
  get RunnerWalkLifeSeconds() { return RunnerWalkLifeSeconds; },
  set RunnerWalkLifeSeconds(Value) { RunnerWalkLifeSeconds = Value; },
  get IsPointerAiming() { return IsPointerAiming; },
  get IsKeyboardAiming() { return IsKeyboardAiming; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get FlightElapsedSeconds() { return FlightElapsedSeconds; },
  get LiberationFlashLifeSeconds() { return LiberationFlashLifeSeconds; },
  set LiberationFlashLifeSeconds(Value) { LiberationFlashLifeSeconds = Value; },
  get TrailEmissionAccumulatorSeconds() { return TrailEmissionAccumulatorSeconds; },
  set TrailEmissionAccumulatorSeconds(Value) { TrailEmissionAccumulatorSeconds = Value; },
  get LaunchPulseLifeSeconds() { return LaunchPulseLifeSeconds; },
  set LaunchPulseLifeSeconds(Value) { LaunchPulseLifeSeconds = Value; },
  get ImpactPulseLifeSeconds() { return ImpactPulseLifeSeconds; },
  set ImpactPulseLifeSeconds(Value) { ImpactPulseLifeSeconds = Value; },
  get HasLaunchedOnce() { return HasLaunchedOnce; },
  get IsOpeningBriefingActive() { return IsOpeningBriefingActive; },
});
const {
  updateStardustVisuals,
  updateWorldBiomeMotion,
  updateSeedVisuals,
  updateTrailParticles,
} = FrameVisuals;



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
  get LastAimScreenDistancePixels() { return LastAimScreenDistancePixels; },
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
  commitAimPlanningCamera,
  get HasCommittedAimCamera() { return HasCommittedAimCamera; },
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


const InputController = createInputController(THREE, {
  GameCanvas,
  Camera,
  PointerRaycaster,
  PointerNormalizedDeviceCoordinates,
  OrbitalPlane,
  PointerWorldPosition,
  PointerByIdentifier,
  AimPanelElement,
  AimLabelElement,
  AimPowerFillElement,
  AimPowerValueElement,
  BurnButtonElement,
  SeedGroup,
  SeedPointerHitMesh,
  LaunchPulseMesh,
  ImpactPulseMesh,
  PullGuideLine,
  CameraPanOffset,
  PanOffsetStart,
  ScoutPointerStartWorldPosition,
  ScoutCameraStartTarget,
  ScoutCameraTarget,
  LastAimPointerWorldPosition,
  PointerGestureStartWorldPosition,
  AimDragVector,
  AimLaunchVelocity,
  WorldseedSound,
  MaximumDragDistance,
  LaunchVelocityPerDragUnit,
  MinimumLaunchDragDistance,
  LaunchCancelRadius,
  get LastAimScreenDistancePixels() { return LastAimScreenDistancePixels; },
  set LastAimScreenDistancePixels(Value) { LastAimScreenDistancePixels = Value; },
  get FlightOrbitTrapState() { return FlightOrbitTrapState; },
  set FlightOrbitTrapState(Value) { FlightOrbitTrapState = Value; },
  FixedPhysicsStepHertz,
  FixedPhysicsStepSeconds,
  MaximumTrajectoryPredictionSteps,
  SeedRadius,
  WorldDefinitions,
  SeedstoneDefinition,
  WorldheartDefinition,
  FlightCollectedStardustIdentifiers,
  FlightClosePassWorldIdentifiers,
  HostilePylonGroup,
  CompletedHostileEncounterWorldIdentifiers,
  MinimumScoutZoomScale,
  shouldUseSectorPlanningCamera,
  getActiveMaximumScoutZoomScale,
  refreshPlanningZoomControls,
  resizeRenderer,
  setScoutMode,
  getCurrentAttachedWorld,
  setRunnerSurfaceAngle,
  setRunnerSurfacePose,
  flattenRunnerToEquator,
  moveRunnerAroundSurface,
  moveRunnerOnSurface,
  showInstruction,
  showStatusToast,
  hideInstruction,
  showHostileEncounterInstruction,
  showRouteChoiceInstruction,
  getCurrentCutPreview,
  hideCutGuide,
  publishHostileEncounterState,
  getShipCutOrigin,
  getRunnerSurfaceAngle,
  getRunnerSurfacePose,
  completeWorldheartLiberation,
  flushQueuedStoryBoardsIfReady,
  updateLaunchCounter,
  captureCommittedLaunchPrediction,
  captureAimInteractionCamera,
  releaseAimInteractionCamera,
  applySectorPlanningCamera,
  commitAimPlanningCamera,
  clearCommittedAimCamera,
  clearTrajectoryPreview,
  updateAimPreview,
  updateKeyboardAimPreview,
  getCurrentRouteChoices,
  predictCurrentLaunchTrajectory,
  getActiveTacticalBodyDefinitions,
  renderTrajectoryLine,
  getCurrentCutHitIds,
  getActiveElement: () => document.activeElement,
  get GamePhase() { return GamePhase; },
  set GamePhase(Value) { GamePhase = Value; },
  get IsPointerAiming() { return IsPointerAiming; },
  set IsPointerAiming(Value) { IsPointerAiming = Value; },
  get HasCommittedAimCamera() { return HasCommittedAimCamera; },
  set HasCommittedAimCamera(Value) { HasCommittedAimCamera = Value; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get IsPointerWalking() { return IsPointerWalking; },
  set IsPointerWalking(Value) { IsPointerWalking = Value; },
  get IsPointerScouting() { return IsPointerScouting; },
  set IsPointerScouting(Value) { IsPointerScouting = Value; },
  get PointerGestureMode() { return PointerGestureMode; },
  set PointerGestureMode(Value) { PointerGestureMode = Value; },
  get IsKeyboardAiming() { return IsKeyboardAiming; },
  set IsKeyboardAiming(Value) { IsKeyboardAiming = Value; },
  get IsBurnAiming() { return IsBurnAiming; },
  set IsBurnAiming(Value) { IsBurnAiming = Value; },
  get BurnAimDirection() { return BurnAimDirection; },
  set BurnAimDirection(Value) { BurnAimDirection = Value; },
  get IsCutAiming() { return IsCutAiming; },
  set IsCutAiming(Value) { IsCutAiming = Value; },
  get CutAimPointer() { return CutAimPointer; },
  set CutAimPointer(Value) { CutAimPointer = Value; },
  get ActivePointerIdentifier() { return ActivePointerIdentifier; },
  set ActivePointerIdentifier(Value) { ActivePointerIdentifier = Value; },
  get PinchState() { return PinchState; },
  set PinchState(Value) { PinchState = Value; },
  get KeyboardAimState() { return KeyboardAimState; },
  set KeyboardAimState(Value) { KeyboardAimState = Value; },
  get AimZoomScale() { return AimZoomScale; },
  set AimZoomScale(Value) { AimZoomScale = Value; },
  get CameraZoomScale() { return CameraZoomScale; },
  set CameraZoomScale(Value) { CameraZoomScale = Value; },
  get ScoutZoomScale() { return ScoutZoomScale; },
  set ScoutZoomScale(Value) { ScoutZoomScale = Value; },
  get IsScoutMode() { return IsScoutMode; },
  set IsScoutMode(Value) { IsScoutMode = Value; },
  get SeedPhysicsState() { return SeedPhysicsState; },
  set SeedPhysicsState(Value) { SeedPhysicsState = Value; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  set CurrentWorldIdentifier(Value) { CurrentWorldIdentifier = Value; },
  get RunState() { return RunState; },
  set RunState(Value) { RunState = Value; },
  get ReplayPlaybackState() { return ReplayPlaybackState; },
  get ReplayState() { return ReplayState; },
  set ReplayState(Value) { ReplayState = Value; },
  get FlightElapsedSeconds() { return FlightElapsedSeconds; },
  set FlightElapsedSeconds(Value) { FlightElapsedSeconds = Value; },
  get IsBreakerBurnAvailable() { return IsBreakerBurnAvailable; },
  set IsBreakerBurnAvailable(Value) { IsBreakerBurnAvailable = Value; },
  get IsBreakerBurnPending() { return IsBreakerBurnPending; },
  set IsBreakerBurnPending(Value) { IsBreakerBurnPending = Value; },
  get FlightOriginWorldIdentifier() { return FlightOriginWorldIdentifier; },
  set FlightOriginWorldIdentifier(Value) { FlightOriginWorldIdentifier = Value; },
  get FlightHadAsteroidClosePass() { return FlightHadAsteroidClosePass; },
  set FlightHadAsteroidClosePass(Value) { FlightHadAsteroidClosePass = Value; },
  get LaunchIgnoredWorldIdentifier() { return LaunchIgnoredWorldIdentifier; },
  set LaunchIgnoredWorldIdentifier(Value) { LaunchIgnoredWorldIdentifier = Value; },
  get LaunchIgnoredBodyIdentifier() { return LaunchIgnoredBodyIdentifier; },
  set LaunchIgnoredBodyIdentifier(Value) { LaunchIgnoredBodyIdentifier = Value; },
  get AttachedSeedstoneSurfaceOffset() { return AttachedSeedstoneSurfaceOffset; },
  set AttachedSeedstoneSurfaceOffset(Value) { AttachedSeedstoneSurfaceOffset = Value; },
  get SeedstoneUsesRemaining() { return SeedstoneUsesRemaining; },
  set SeedstoneUsesRemaining(Value) { SeedstoneUsesRemaining = Value; },
  get SeedstoneCrumbleStartedAtSeconds() { return SeedstoneCrumbleStartedAtSeconds; },
  set SeedstoneCrumbleStartedAtSeconds(Value) { SeedstoneCrumbleStartedAtSeconds = Value; },
  get GameElapsedTimeSeconds() { return GameElapsedTimeSeconds; },
  get HasLaunchedOnce() { return HasLaunchedOnce; },
  set HasLaunchedOnce(Value) { HasLaunchedOnce = Value; },
  get HasTaughtBurn() { return HasTaughtBurn; },
  set HasTaughtBurn(Value) { HasTaughtBurn = Value; },
  get TrailEmissionAccumulatorSeconds() { return TrailEmissionAccumulatorSeconds; },
  set TrailEmissionAccumulatorSeconds(Value) { TrailEmissionAccumulatorSeconds = Value; },
  get LaunchPulseLifeSeconds() { return LaunchPulseLifeSeconds; },
  set LaunchPulseLifeSeconds(Value) { LaunchPulseLifeSeconds = Value; },
  get ImpactPulseLifeSeconds() { return ImpactPulseLifeSeconds; },
  set ImpactPulseLifeSeconds(Value) { ImpactPulseLifeSeconds = Value; },
  get CameraImpactLifeSeconds() { return CameraImpactLifeSeconds; },
  set CameraImpactLifeSeconds(Value) { CameraImpactLifeSeconds = Value; },
  get CommittedPredictionPoints() { return CommittedPredictionPoints; },
  set CommittedPredictionPoints(Value) { CommittedPredictionPoints = Value; },
  get ActiveHostileEncounterState() { return ActiveHostileEncounterState; },
  set ActiveHostileEncounterState(Value) { ActiveHostileEncounterState = Value; },
  get HasAnnouncedCommandLockGift() { return HasAnnouncedCommandLockGift; },
  set HasAnnouncedCommandLockGift(Value) { HasAnnouncedCommandLockGift = Value; },
  get RunnerWalkLifeSeconds() { return RunnerWalkLifeSeconds; },
  set RunnerWalkLifeSeconds(Value) { RunnerWalkLifeSeconds = Value; },
  get IsOpeningBriefingActive() { return IsOpeningBriefingActive; },
  get AimInteractionCamera() { return AimInteractionCamera; },
  get ScannerProjection() { return Scanner.ScannerProjection; },
  get PhysicsElapsedTimeSeconds() { return PhysicsElapsedTimeSeconds; },
  get WardenPursuitState() { return WardenPursuitState; },
});
const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleKeyboardAimKey,
  updateBreakerBurnInterface,
  requestBreakerAction,
  requestBreakerBurn,
  applyBreakerBurnAtCurrentStep,
  fireHostileCutFromPreview,
  fireNearestHostileCut,
  cancelCutAim,
  cancelAimedLaunch,
  beginKeyboardAim,
} = InputController;


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
  FlightOrbitTrapState = createOrbitTrapState();
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
    centerLandedCamera({ snap: true });
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
  FlightOrbitTrapState = createOrbitTrapState();
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
    orbitTrapState: FlightOrbitTrapState,
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

  if (StepResult.outOfBounds || StepResult.orbitTrapped) {
    recoverSeedFromVoid(StepResult.orbitTrapped ? 'CAUGHT IN ORBIT' : undefined);
  }
}

const RestorationVisuals = createRestorationVisuals(THREE, {
  GameCanvas,
  WorldDefinitions,
  WorldRuntimeByIdentifier,
  WorldseedSound,
  getSectorClusterRules,
  isLiveInnerCluster,
  setSurfacePropRestorationProgress,
  showStatusToast,
  hideInstruction,
  revealVictoryPanel,
  beginHostileEncounter,
  showRouteChoiceInstruction,
  flushQueuedStoryBoardsIfReady,
  get GamePhase() { return GamePhase; },
  set GamePhase(Value) { GamePhase = Value; },
  get CurrentWorldIdentifier() { return CurrentWorldIdentifier; },
  get WardenPursuitState() { return WardenPursuitState; },
  get RelayNetworkState() { return RelayNetworkState; },
  get PrefersReducedMotion() { return PrefersReducedMotion; },
  get WorldheartJustUnlocked() { return WorldheartJustUnlocked; },
  set WorldheartJustUnlocked(Value) { WorldheartJustUnlocked = Value; },
  get RelayRevealLookTarget() { return RelayRevealLookTarget; },
  set RelayRevealLookTarget(Value) { RelayRevealLookTarget = Value; },
  set RelayRevealHoldUntilSeconds(Value) { RelayRevealHoldUntilSeconds = Value; },
  get PendingRecaptureCutWorldIdentifier() { return PendingRecaptureCutWorldIdentifier; },
  set PendingRecaptureCutWorldIdentifier(Value) { PendingRecaptureCutWorldIdentifier = Value; },
  set RecaptureCutGiftAvailable(Value) { RecaptureCutGiftAvailable = Value; },
});
const { updateWorldRestorationVisuals } = RestorationVisuals;
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
  Composer.setSize(ViewportWidth, ViewportHeight);
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
  Composer.setPixelRatio(RenderedPixelRatio);
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
  IsBloomPipelineEnabled = PresentationQualityTier !== 'degraded';
  GameCanvas.dataset.bloomPipeline = String(IsBloomPipelineEnabled);
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
  resetLandingDirector();

  IsPointerAiming = false;
  clearCommittedAimCamera();
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
  GameCanvas.dataset.surfaceLatitude = '';
  GameCanvas.dataset.surfaceMeridianSign = '';
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
    centerLandedCamera({ snap: true });
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
  AttachedWorldheartSurfaceLatitude = 0;
  AttachedSurfaceMeridianSign = 1;
  WorldheartDefinition.routeAvailable = WorldheartDefinition.routeAvailableInitially === true;
  WorldheartDefinition.restored = WorldheartDefinition.initiallyRestored === true;
  WorldheartJustUnlocked = false;
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
  updateScoutZoomInterface();
  updateBreakerBurnInterface();
  PhysicsAccumulatorSeconds = 0;
  PhysicsElapsedTimeSeconds = 0;
  GameElapsedTimeSeconds = 0;
  RelayRevealLookTarget = null;
  RelayRevealHoldUntilSeconds = 0;
  StoryLookFocus = null;
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

let LastControlModeKey = '';

/** Keeps the EXPLORE / LAUNCH / FLIGHT chip and shell mode attribute current. */
function updateControlModeInterface() {
  const Presentation = getControlModePresentation({
    gamePhase: GamePhase,
    isAiming: IsPointerAiming || IsKeyboardAiming,
    isWalking: IsPointerWalking,
    isScoutMode: IsScoutMode,
    isBurnAiming: IsBurnAiming,
    isBreakAvailable: IsBreakerBurnAvailable,
    replayActive: ReplayPlaybackState !== null,
    briefingActive: IsOpeningBriefingActive,
  });
  const ControlModeKey = `${Presentation.mode}|${Presentation.hint}`;
  if (ControlModeKey === LastControlModeKey) {
    return;
  }
  LastControlModeKey = ControlModeKey;
  GameShellElement.dataset.controlMode = Presentation.mode;
  ModeChipElement.classList.toggle('is-hidden', !Presentation.visible);
  if (Presentation.visible) {
    ModeChipLabelElement.textContent = Presentation.label;
    ModeChipHintElement.textContent = Presentation.hint;
  }
}

/** Main frame loop. */
function renderFrame() {
  window.requestAnimationFrame(renderFrame);
  if (!IsPageActive || !IsWebGLContextAvailable) {
    return;
  }

  if (IsOpeningBriefingActive) {
    const DeltaTimeSeconds = Math.min(Clock.getDelta(), MaximumFrameDeltaSeconds);
    updateCamera(DeltaTimeSeconds);
    updateControlModeInterface();
    renderScene();
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
  updateControlModeInterface();
  updateTacticalBodies(ElapsedTimeSeconds, CachedInstructionPanelTop);
  updateStardustVisuals(ElapsedTimeSeconds);
  updateRouteLabels(CachedInstructionPanelTop);
  updateFlightAudio();
  updateWorldLifeAudio();
  updatePersonalBestGhostVisibility();

  renderScene();
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
  } else {
    SmoothPerformanceSampleCount = 0;
    PerformanceSampleElapsedSeconds = 0;
    PerformanceSampleDeltaSeconds = 0;
    PerformanceSampleFrameCount = 0;
    GameCanvas.dataset.smoothPerformanceSamples = '0';
    if (IsPointerAiming || IsKeyboardAiming || IsPointerWalking || IsPointerScouting) {
      const CanceledPointerIdentifier = ActivePointerIdentifier;
      IsPointerAiming = false;
      clearCommittedAimCamera();
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
/** Visible modal fields used by both the Tab cycle and the focus-in trap. */
function getVisibleModalFocusables(ModalElement) {
  return [...ModalElement.querySelectorAll('input, button')]
    .filter((Element) => !Element.disabled && !Element.hidden && Element.offsetParent !== null);
}

window.addEventListener('keydown', (KeyboardEventData) => {
  if (IsOpeningBriefingActive) {
    const PressedBriefingKey = KeyboardEventData.key.toLowerCase();
    if (PressedBriefingKey === 'escape') {
      KeyboardEventData.preventDefault();
      skipStoryBoards();
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
    const FocusableElements = getVisibleModalFocusables(ActiveModalElement);
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
  if (isEditingTextField(KeyboardEventData.target)) {
    return;
  }
  if (
    KeyboardEventData.ctrlKey
    || KeyboardEventData.metaKey
    || KeyboardEventData.altKey
  ) {
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
  if (KeyboardEventData.repeat) {
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
  getVisibleModalFocusables(ActiveModalElement)[0]
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
  skipStoryBoards();
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
