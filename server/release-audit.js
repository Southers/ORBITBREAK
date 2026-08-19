import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AuthoredCampaignSystemIdentifiers,
  AuthoredSystemDefinitions,
  DefaultAuthoredSystemIdentifier,
  validateAuthoredSystemDefinition,
} from '../src/content.js';

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const RepositoryRoot = resolve(ScriptDirectory, '..');

function readRepositoryFile(RelativePath) {
  return readFileSync(resolve(RepositoryRoot, RelativePath), 'utf8');
}

function listRepositoryFiles(RelativeDirectory, Extensions) {
  const DirectoryPath = resolve(RepositoryRoot, RelativeDirectory);
  const Files = [];
  for (const Entry of readdirSync(DirectoryPath, { withFileTypes: true })) {
    const RelativePath = `${RelativeDirectory}/${Entry.name}`;
    if (Entry.isDirectory()) {
      Files.push(...listRepositoryFiles(RelativePath, Extensions));
    } else if (Extensions.some((Extension) => Entry.name.endsWith(Extension))) {
      Files.push(RelativePath);
    }
  }
  return Files;
}

/** Returns release-integrity failures without changing the repository or external state. */
export function auditReleaseReadiness() {
  const Failures = [];
  const requireCondition = (Condition, Message) => {
    if (!Condition) Failures.push(Message);
  };
  const IndexHtml = readRepositoryFile('index.html');
  const MainSource = readRepositoryFile('src/main.js');
  const PresentationSource = readRepositoryFile('src/presentation.js');
  const PhysicsSource = readRepositoryFile('src/physics.js');
  const ScoringSource = readRepositoryFile('src/scoring.js');
  const AudioSource = readRepositoryFile('src/audio.js');
  const SectorSource = readRepositoryFile('src/sector.js');
  const FlightResolverSource = readRepositoryFile('src/flight-resolver.js');
  const LivingWorldSource = readRepositoryFile('src/living-world-visuals.js');
  const PlayerSource = readRepositoryFile('src/player-visuals.js');
  const WardenVisualsSource = readRepositoryFile('src/warden-visuals.js');
  const StoryDirectorSource = readRepositoryFile('src/story-director.js');
  const HudSource = readRepositoryFile('src/hud.js');
  const LandingDirectorSource = readRepositoryFile('src/landing-director.js');
  const InputControllerSource = readRepositoryFile('src/input-controller.js');
  const HostileSurfaceSource = readRepositoryFile('src/hostile-surface.js');
  const ControlsSource = readRepositoryFile('src/controls.js');
  const CameraSource = readRepositoryFile('src/camera-controller.js');
  const ScannerSource = readRepositoryFile('src/scanner.js');
  const RoutePresentationSource = readRepositoryFile('src/route-presentation.js');
  const RecordsUiSource = readRepositoryFile('src/records-ui.js');
  const FrameVisualsSource = readRepositoryFile('src/frame-visuals.js');
  const RestorationVisualsSource = readRepositoryFile('src/restoration-visuals.js');
  const WorldGeometrySource = readRepositoryFile('src/world-geometry.js');
  const StyleSheet = readRepositoryFile('src/style.css');
  const Credits = readRepositoryFile('CREDITS.md');
  const ReleaseBrief = readRepositoryFile('RELEASE.md');

  const LocalAssetReferences = [
    ...[...IndexHtml.matchAll(/(?:src|href)="(\.\/[^"#]+)(?:#[^"]*)?"/g)]
      .map((Match) => Match[1].split('?')[0]),
    ...[...IndexHtml.matchAll(/"three":\s*"(\.\/[^"?]+)(?:\?[^"]*)?"/g)]
      .map((Match) => Match[1]),
  ];
  for (const AssetReference of LocalAssetReferences) {
    requireCondition(
      existsSync(resolve(RepositoryRoot, AssetReference)),
      `index.html references missing local asset ${AssetReference}.`,
    );
  }

  requireCondition(
    !/<(?:script|link)\b[^>]+(?:src|href)="https?:\/\//i.test(IndexHtml),
    'Runtime scripts and styles must not depend on a remote host.',
  );
  const RemoteModulePattern = /(?:from\s+['"]https?:\/\/|url\(\s*['"]?https?:\/\/)/i;
  for (const RelativePath of listRepositoryFiles('src', ['.js', '.css'])) {
    requireCondition(
      !RemoteModulePattern.test(readRepositoryFile(RelativePath)),
      `${RelativePath} must not import or load a remote URL.`,
    );
  }
  requireCondition(
    IndexHtml.includes('"three": "./vendor/three.module.min.js?v=0.179.1"'),
    'The import map must retain the pinned vendored Three.js runtime.',
  );
  const ImportMapMatch = IndexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  requireCondition(Boolean(ImportMapMatch), 'index.html must retain a hashed import map.');
  if (ImportMapMatch) {
    const ImportMapHash = createHash('sha256').update(ImportMapMatch[1]).digest('base64');
    requireCondition(
      IndexHtml.includes(`'sha256-${ImportMapHash}'`)
        && IndexHtml.includes("connect-src 'self' http://127.0.0.1:* http://localhost:*")
        && !/connect-src[^"]*https:/.test(IndexHtml),
      'The public CSP must hash the import map and keep network access fail-closed.',
    );
  }
  requireCondition(
    readRepositoryFile('server/cloudflare/wrangler.jsonc').includes('"workers_dev": false'),
    'The Cloudflare adapter must not publish a workers.dev preview URL.',
  );

  const MainBuildVersion = MainSource.match(/GameCanvas\.dataset\.build = '([^']+)'/)?.[1];
  const MainAssetVersion = IndexHtml.match(/src="\.\/src\/main\.js\?v=([^"]+)"/)?.[1];
  const StyleAssetVersion = IndexHtml.match(/href="\.\/src\/style\.css\?v=([^"]+)"/)?.[1];
  requireCondition(Boolean(MainBuildVersion), 'src/main.js must publish a build identifier.');
  requireCondition(
    MainBuildVersion === MainAssetVersion && MainBuildVersion === StyleAssetVersion,
    'HTML, CSS and published canvas build identifiers must match.',
  );
  requireCondition(
    PhysicsSource.includes('export const MaximumLaunchSpeed = 12.5;')
      && MainSource.includes('LaunchVelocityPerDragUnit = MaximumLaunchSpeed / MaximumDragDistance')
      && MainSource.includes('updateSlingshotBandVisuals(')
      && ScoringSource.includes('export function getSlingshotBandRadii('),
    'Launch speed must stay inside the gravity-assist range and show scoring wells while aiming.',
  );
  requireCondition(
    ScoringSource.includes('for (let PointIndex = 1; PointIndex < TrajectoryPoints.length; PointIndex += 1)'),
    'Slingshot prediction must skip the pre-launch rest sample that live scoring never sees.',
  );
  requireCondition(
    PresentationSource.includes('export function getSectorPlanningCamera(')
      && PresentationSource.includes('export function getPlanningFocusWorldIdentifiers(')
      && PresentationSource.includes('export function getPlanningAtmosphere(')
      && MainSource.includes('MaximumTrajectoryPredictionSteps = 1800')
      && MainSource.includes('applySectorPlanningCamera(')
      && CameraSource.includes('snapLiveCameraToPlanningView(')
      && CameraSource.includes('host.PlanningCameraScale * host.AimZoomScale')
      && FrameVisualsSource.includes('updateFlightPlanningPresentation(')
      && InputControllerSource.includes('beginPinchIfNeeded()')
      && MainSource.includes('refreshPlanningZoomControls('),
    'Aiming must frame the readable neighbourhood, lift fog and keep pinch zoom on the exact remaining path.',
  );
  requireCondition(
    InputControllerSource.includes('classifyPendingShipGrab(')
      && InputControllerSource.includes('classifyLandedPointerStart(')
      && InputControllerSource.includes('LandedPointerTargets.ship')
      && CameraSource.includes('commitAimPlanningCamera(')
      && CameraSource.includes('host.HasCommittedAimCamera')
      && InputControllerSource.includes('dataset.aimCamera')
      && InputControllerSource.includes('showWalkFacingInstruction(getCurrentAttachedWorld())'),
    'Ship grab must lock aim from pointer-down, keep the globe camera until cancel, and retain facing after a walk.',
  );
  requireCondition(
    ControlsSource.includes('export function classifyLandedPointerStart(')
      && ControlsSource.includes('if (isOverCage === true)')
      && ControlsSource.includes('CageScreenGrabRadiusPixels = 88')
      && ControlsSource.includes('SeedScreenGrabRadiusPixels = 96')
      && ControlsSource.includes('SeedOnGlobeGrabRadiusPixels = 28')
      && ControlsSource.includes('SeedOnGlobeGrabWorldRadiusScale = 0.12')
      && !InputControllerSource.includes('Walk near')
      && !HostileSurfaceSource.includes('Walk near')
      && InputControllerSource.includes('finishArmedCageTap(')
      && PresentationSource.includes("title: 'Drag the planet to walk'")
      && PresentationSource.includes("title: 'Pull the ship, then let go'")
      && HudSource.includes('function updateFirstRunCoach(')
      && FrameVisualsSource.includes('getLandedVerbHighlight(')
      && !InputControllerSource.includes('classifySphereSurfaceGesture(')
      && !InputControllerSource.includes('classifySurfaceGesture('),
    'First-timer walk vs aim must lock from where the drag starts, not how it moves, with sticky walk-then-launch captions.',
  );
  requireCondition(
    PlayerSource.includes('const SeedHaloGeometry = new THREE.TorusGeometry(0.07, 0.01, 8, 24)')
      && PlayerSource.includes('new THREE.PointLight(0x72dcff, 0, 0.01, 2)')
      && PlayerSource.includes('SeedPointLight.visible = false')
      && !PlayerSource.includes('SeedGroup.add(SeedPointLight)')
      && !PlayerSource.includes('Scene.add(WorldWalkHaloMesh)')
      && !PlayerSource.includes('Scene.add(WalkCursorMesh)')
      && PresentationSource.includes('worldWalkHalo: false')
      && PresentationSource.includes('walkCursor: false')
      && PresentationSource.includes('export function getAtmosphereDistanceFade(')
      && FrameVisualsSource.includes('WorldWalkHaloMesh.visible = false')
      && FrameVisualsSource.includes('WalkCursorMesh.visible = false')
      && RoutePresentationSource.includes('host.IsScoutMode === true')
      && !FrameVisualsSource.includes('WalkHaloRadius')
      && !PlayerSource.includes('SphereGeometry(SeedRadius * 2.35'),
    'Landed Haven must not wear a filled planet walk disc, crust donut, hover outline or cyan runner light; the ship grab cue stays a tiny torus on the craft.',
  );
  requireCondition(
    !WorldGeometrySource.includes('createWorldContourRings')
      && !WorldGeometrySource.includes('controlGrid')
      && !WorldGeometrySource.includes('controlLatitude')
      && WorldGeometrySource.includes("customProgramCacheKey = () => 'orbitbreak-restoration-surface-v7'")
      && WorldGeometrySource.includes('ContourRingGroup.visible = false')
      && !LandingDirectorSource.includes('contourRingGroup.visible = true')
      && LandingDirectorSource.includes('contourRingGroup.visible = false')
      && PresentationSource.includes('export function getParkedShipPresentation(')
      && PresentationSource.includes('viewRightX = 1')
      && !PresentationSource.includes('NoseY = 1')
      && PresentationSource.includes('parentY: { x: NoseX, y: NoseY, z: NoseZ }')
      && PresentationSource.includes('parentZ: { x: DorsalX, y: DorsalY, z: DorsalZ }')
      && PresentationSource.includes('lieDownX: 0')
      && PresentationSource.includes('ParkedShipPresentationScale = 0.08')
      && !PresentationSource.includes('parentY: { x: DorsalX, y: DorsalY, z: DorsalZ }')
      && PlayerSource.includes('new THREE.CylinderGeometry(0.07, 0.13, 0.52, 10)')
      && PlayerSource.includes('new THREE.ConeGeometry(0.07, 0.32, 10)')
      && PlayerSource.includes('new THREE.ConeGeometry(0.15, 0.34, 3)')
      && !PlayerSource.includes('new THREE.CapsuleGeometry(0.2, 0.14, 6, 12)')
      && !PlayerSource.includes('new THREE.BoxGeometry(0.98, 0.18, 0.08)')
      && FrameVisualsSource.includes('getParkedShipPresentation(')
      && FrameVisualsSource.includes('ShipLieGroup.rotation.set(0, 0, 0)')
      && !FrameVisualsSource.includes('ShipLieGroup.rotation.set(ParkedShip.lieDownX, 0, 0)')
      && FrameVisualsSource.includes('ShipVisualGroup.scale.setScalar(ParkedShip.scale)')
      && FrameVisualsSource.includes('PullGuideRibbon.mesh.visible = false')
      && !FrameVisualsSource.includes('PullGuideRibbon.mesh.visible = IsOpeningCoachVisible')
      && !MainSource.includes('writePlanarRibbon(PullGuideRibbon')
      && PlayerSource.includes('const ShipLieGroup = new THREE.Group()')
      && PlayerSource.includes('ShipVisualGroup.add(SeedHaloMesh)')
      && !PlayerSource.includes('SeedGroup.add(SeedHaloMesh)')
      && FrameVisualsSource.includes("dataset.parkedShip = String(ShowParkedShip)")
      && FrameVisualsSource.includes('ShipVisualGroup.visible = true')
      && FrameVisualsSource.includes('ShipThrusterMesh.visible = !ShowParkedShip')
      && PlayerSource.includes('SeedPointLight.visible = false'),
    'Landed Haven must not wear meridian/contour rings or an occupation grid, and the parked Orbitbreaker must lie on the crust as a courier.',
  );
  requireCondition(
    PresentationSource.includes('export function getWorldCrustWalkQuaternion(')
      && PresentationSource.includes('export function getLandedSurfacePlant(')
      && PresentationSource.includes('export function shouldHoldWorldCrustIdleSpin(')
      && FrameVisualsSource.includes('applyOccupiedWorldCrust')
      && FrameVisualsSource.includes('getLandedSurfacePlant(')
      && RestorationVisualsSource.includes('shouldHoldWorldCrustIdleSpin(')
      && RestorationVisualsSource.includes('spinIdleWorldCrust(')
      && CameraSource.includes('const WorldCameraUp = Object.freeze({ x: 0, y: 0, z: 1 })')
      && InputControllerSource.includes('getLogicalSurfaceDirectionFromWorldHit(')
      && LivingWorldSource.includes('CrustOffset.applyMatrix4(WorldGroup.matrixWorld)')
      && !CameraSource.includes('PoleLock'),
    'Landed walk must spin only the occupied world under the Runner, plant feet on the visual crust, and keep camera up on world +Z.',
  );
  requireCondition(
    PresentationSource.includes('export function getWorldLifeStage(')
      && PresentationSource.includes("return 'tyrant';")
      && LivingWorldSource.includes('OccupationMineMesh')
      && LivingWorldSource.includes('OccupationFumeMesh')
      && LivingWorldSource.includes('ExtractionFreighterMesh')
      && LivingWorldSource.includes('visiblePrisonerCount')
      && PlayerSource.includes('RunnerPresentationScale = 0.26')
      && CameraSource.includes('getLandedCameraScale(')
      && CameraSource.includes('getActiveViewZoomMinimumScale(')
      && PresentationSource.includes('LandedMinimumZoomScale = 0.28')
      && PresentationSource.includes('ScoutMinimumZoomScale = 0.38')
      && PresentationSource.includes('house: { height: 0.24')
      && PresentationSource.includes('workshop: { height: 0.33')
      && PresentationSource.includes('worker: { x: 0.13, y: 0.14, z: 0.12 }'),
    'Occupied worlds must show tyrant extraction, held people and a tiny Runner so living contrast can read.',
  );
  requireCondition(
    Array.isArray(AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]?.openingBriefing)
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier].openingBriefing.length >= 2
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier].openingBriefing.length <= 3
      && /id="OpeningBriefing"/.test(IndexHtml)
      && /id="BriefingContinueButton"/.test(IndexHtml)
      && /\.opening-briefing__actions button\s*\{[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && MainSource.includes('beginOpeningBriefing(')
      && PresentationSource.includes('export function getOpeningBriefingPresentation('),
    'The selected sector must open with a story board that names the Runner, the Reach and the charge.',
  );
  requireCondition(
    PresentationSource.includes('export function getHowToPlayPresentation(')
      && PresentationSource.includes("title: 'How to play'")
      && PresentationSource.includes('Drag the planet to walk. The world turns under you.')
      && PresentationSource.includes('Pull the ship and let go to fly to another tiny world.')
      && PresentationSource.includes('Landing links worlds. Linked worlds prosper.')
      && PresentationSource.includes('Occupied worlds have Warden cages. Tap the cage to break it.')
      && PresentationSource.includes('Drag empty space to look around. C pulls the camera back.')
      && PresentationSource.includes('R starts the run over.')
      && PresentationSource.includes('export function shouldShowHowToPlayAfterOpening({')
      && /id="HowToPlay"[^>]*role="dialog"[^>]*aria-modal="true"/.test(IndexHtml)
      && /id="HowToPlayContinueButton"/.test(IndexHtml)
      && /id="HowToPlayButton"/.test(IndexHtml)
      && /\.how-to-play\s*\{[^}]*user-select:\s*none;/s.test(StyleSheet)
      && /\.how-to-play\s*\{[^}]*-webkit-user-select:\s*none;/s.test(StyleSheet)
      && /#HowToPlayContinueButton\s*\{[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && MainSource.includes('function showHowToPlay(')
      && MainSource.includes('function presentHowToPlayAfterOpening(')
      && StoryDirectorSource.includes('presentHowToPlayAfterOpening')
      && !IndexHtml.includes('\u2014'),
    'Play must gate the first walk with one How to play card after the intro, also reachable from pause.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.storyBoards?.wardenArrival?.pages?.length >= 2
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.storyBoards?.firstAnswer?.pages?.[0]?.speaker === 'EMBER'
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.storyBoards?.commandExposed?.pages?.length >= 2
      && MainSource.includes('enqueueCampaignStoryBoards(')
      && MainSource.includes('flushQueuedStoryBoardsIfReady(')
      && PresentationSource.includes('export function isCampaignStoryBoardReadyToPresent(')
      && StoryDirectorSource.includes('WorldseedSound.setStoryPaused(true)')
      && StoryDirectorSource.includes('WorldseedSound.stopTransients()')
      && AudioSource.includes('TransientSource.disconnect()')
      && PresentationSource.includes('export function getTriggeredCampaignStoryBoardIds(')
      && Credits.includes('assets/ember-portrait.jpg')
      && Credits.includes('assets/tide-portrait.jpg')
      && Credits.includes('assets/frost-portrait.jpg')
      && Credits.includes('assets/bastion-portrait.jpg')
      && Credits.includes('assets/command-portrait.jpg'),
    'The selected sector must keep skippable story boards for first answer, Warden arrival and Command.',
  );
  requireCondition(
    LivingWorldSource.includes('ProsperityBuildingMesh')
      && LivingWorldSource.includes('ProsperityWindowMesh')
      && MainSource.includes('refreshDockedTradeState(')
      && LivingWorldSource.includes('getTradeHullKind(')
      && LivingWorldSource.includes('getInhabitantSilhouette(')
      && PresentationSource.includes('export function getProsperityPresence(')
      && PresentationSource.includes('export function getProsperityBuildingKind(')
      && PresentationSource.includes('export function shouldShowInhabitantSlot(')
      && PresentationSource.includes('export function getCourierDockWorldRole(')
      && PresentationSource.includes('export function shouldRevealWarden(') === false
      && MainSource.includes('resolveWardenAfterNonCommandFlight(')
      && MainSource.includes('getWardenRevealFlag()')
      && SectorSource.includes('export function getSectorWardenRevealFlag(')
      && SectorSource.includes('export function isInnerClusterLive(')
      && FlightResolverSource.includes('export function advanceSimulatedFlightStep(')
      && PresentationSource.includes('export function getStoryMusicStage(')
      && MainSource.includes('setStoryMusicStage(')
      && PresentationSource.includes('export function getRangeVeilStrength(')
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.rangeUnlockLine === 'The dark is not as wide as they said.',
    'Living routes must grow houses, windows, docks and culture-true hulls, and the Warden must wait until the inner cluster plus one further world are live.',
  );
  requireCondition(
    /id="MotionButton"/.test(IndexHtml)
      && MainSource.includes("window.localStorage.setItem('orbitbreak.motion'")
      && MainSource.includes("PageSearchParameters.get('diagnostics') === '1'"),
    'The candidate must retain persistent motion control and its explicit diagnostics gate.',
  );
  requireCondition(
    /id="PlayLiveRegion"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /id="StatusToast"/.test(IndexHtml)
      && HudSource.includes('function announceLive(Message)')
      && HudSource.includes('function announceWarden(Message)')
      && MainSource.includes('announceWarden(')
      && MainSource.includes('WardenForecastLine.visible')
      && WardenVisualsSource.includes('function updateWardenTargetTelegraph(')
      && WardenVisualsSource.includes('startWardenEventPulse('),
    'Warden telegraph must stay on the vessel, forecast line, target-world pulse and one polite live region.',
  );
  requireCondition(
    /id="PauseButton"[^>]*aria-label="Pause"/.test(IndexHtml)
      && /id="PauseSheet"[^>]*role="dialog"[^>]*aria-modal="true"/.test(IndexHtml)
      && /id="PauseResumeButton"/.test(IndexHtml)
      && /id="ScoutButton"/.test(IndexHtml)
      && /id="MotionButton"/.test(IndexHtml)
      && /id="AudioButton"/.test(IndexHtml)
      && /id="ResetButton"/.test(IndexHtml)
      && /id="HowToPlayButton"/.test(IndexHtml)
      && /\.pause-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && MainSource.includes('function setPauseSheetOpen(')
      && MainSource.includes("PressedKey === 'escape'"),
    'Play must keep a 44px pause control that opens a labelled sheet of How to play, Scout, zoom, Ghost, Motion, Audio and Reset.',
  );
  requireCondition(
    HudSource.includes('function updateFuelLights()')
      && PlayerSource.includes('function updateFuelLightVisuals(')
      && PlayerSource.includes('FuelPipWarnColor')
      && HudSource.includes("GameCanvas.dataset.launchesRemaining = String(Remaining)"),
    'Bonus fuel must read as ship and backpack lights driven by remainingLaunches, with amber warning on the last two pips.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.victory-panel\s*\{[^}]*width:\s*min\(calc\(100vw - 24px\),\s*760px\);[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s.test(StyleSheet)
      && /\.result-actions\s*\{[^}]*position:\s*sticky;[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s.test(StyleSheet),
    'Short-landscape verified results must keep their actions visible and scrollable.',
  );
  requireCondition(
    /\.result-actions--terminal\s+#LeaderboardButton\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*justify-self:\s*center;[^}]*width:\s*calc\(\(100% - 8px\) \/ 2\);/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.result-actions--terminal\s+#LeaderboardButton\s*\{[^}]*grid-column:\s*auto;[^}]*justify-self:\s*stretch;[^}]*width:\s*auto;/s.test(StyleSheet)
      && /classList\.toggle\('result-actions--terminal',\s*!CanContinueToNextSystem\)/.test(MainSource),
    'Terminal results must centre their unpaired rankings action.',
  );
  requireCondition(
    /id="ReplayIndicator"/.test(IndexHtml)
      && /\.replay-indicator\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Replay progress must remain a visible overlay at a legible type floor.',
  );
  requireCondition(
    /\.route-label,\s*\.tactical-label\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.tactical-label\s*\{[^}]*font-size:\s*10px;[^}]*white-space:\s*nowrap;/s.test(StyleSheet)
      && /\.route-label\s*\{[^}]*white-space:\s*nowrap;/s.test(StyleSheet)
      && RoutePresentationSource.includes('separateRouteLabelsFromTacticalLabels(')
      && RoutePresentationSource.includes('separateOverlappingTacticalLabels(')
      && RoutePresentationSource.includes('getTacticalLabelHorizontalMargin(')
      && MainSource.includes('TacticalLabelScreenPositions'),
    'Route and tactical labels must remain legible, single-line and collision-aware.',
  );
  requireCondition(
    !/id="ScannerPanel"/.test(IndexHtml)
      && !/id="AimPanel"/.test(IndexHtml)
      && !/id="ObjectivePanel"/.test(IndexHtml)
      && !/id="WardenPanel"/.test(IndexHtml)
      && !/id="InstructionPanel"/.test(IndexHtml)
      && !/id="ModeChip"/.test(IndexHtml)
      && !/id="BurnButton"/.test(IndexHtml)
      && !/id="FlightScore"/.test(IndexHtml)
      && ScannerSource.includes('getScannerAccessibleLabel({')
      && RoutePresentationSource.includes('getPlayfieldLabelVerticalBounds({')
      && RoutePresentationSource.includes('host.IsScoutMode'),
    'Play chrome must stay diegetic: no scanner, aim meter, objective, Warden panel, instruction box, mode chip, Break button or flight-score widget.',
  );
  requireCondition(
    /\.result-breakdown\s+dt\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.emblem\s+small\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Verified score categories and earned emblem captions must retain their legible type floor.',
  );
  requireCondition(
    /id="PauseButton"[^>]*aria-label="Pause"/.test(IndexHtml)
      && /\.pause-sheet__actions\s+button[\s\S]*?min-width:\s*44px;[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.scout-zoom-button\s*\{[^}]*font-size:\s*19px;[^}]*line-height:\s*1;/s.test(StyleSheet),
    'Pause sheet actions and Scout zoom must retain 44px targets.',
  );
  requireCondition(
    /\.leaderboard-form\s+label\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.leaderboard-list__runner\s+small\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.leaderboard-list\s+button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && RecordsUiSource.includes("(LeaderboardListElement.querySelector('button') ?? CloseLeaderboardButtonElement)")
      && RecordsUiSource.includes("CallsignInputElement.focus({ preventScroll: true });")
      && RecordsUiSource.includes('const LoadSequence = host.LeaderboardLoadSequence;')
      && RecordsUiSource.includes('const ReplayPayload = GameCanvas.dataset.replayPayload;'),
    'Rankings callsigns, replay actions and submission focus must stay accessible.',
  );
  requireCondition(
    HudSource.includes('function refreshPlayfieldLabelBounds()')
      && MainSource.includes('updateRouteLabels(CachedInstructionPanelTop)')
      && PresentationSource.includes('if (isShortLandscape) return 56 + WardenReserve;')
      && PresentationSource.includes('Math.min(BaseMaximumY, instructionTop - 16)')
      && PresentationSource.includes('export function shouldShowPlayfieldWorldLabels({')
      && PresentationSource.includes('export function collapsePlayfieldLabelBox(')
      && PresentationSource.includes('export function isPlayfieldLabelBoxCollapsed(')
      && PresentationSource.includes("LabelElement.dataset.visible = 'false'")
      && PresentationSource.includes('export function shouldPlayOpeningBriefing({')
      && PresentationSource.includes('export function getRouteLabelHorizontalMargin(')
      && RoutePresentationSource.includes('const LabelsActive = shouldShowPlayfieldWorldLabels({')
      && RoutePresentationSource.includes('function hidePlayfieldLabel(LabelElement)')
      && RoutePresentationSource.includes('collapsePlayfieldLabelBox(LabelElement)')
      && HudSource.includes("showInstruction(Title, Body, CaptionKind = '')")
      && HudSource.includes('function hideScoreBurst()')
      && HudSource.includes("ScoreBurstElement.textContent = ''")
      && /score-burst\[hidden\][\s\S]*width:\s*0 !important;/s.test(StyleSheet)
      && /status-toast:not\(\.is-visible\)[\s\S]*background:\s*none !important;/s.test(StyleSheet),
    'Route labels appear only while aiming or scouting; empty chips and score bursts must collapse to a zero box.',
  );
  requireCondition(
    RoutePresentationSource.includes('const RouteLabelMinimumGap = IsShortLandscape ? 160 : 76')
      && RoutePresentationSource.includes('horizontalClearance: IsShortLandscape ? 180 : 100')
      && RoutePresentationSource.includes('verticalClearance: IsShortLandscape ? 22 : 30')
      && RoutePresentationSource.includes('WorldheartDefinition.routeAvailable && !IsShortLandscape'),
    'Short-landscape Command exposure must separate choices and omit its duplicate tactical chip.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-width:\s*640px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.result-actions\s+button\s*\{[^}]*padding:\s*10px\s+8px;[^}]*font-size:\s*13px;[^}]*line-height:\s*1\.2;[^}]*white-space:\s*nowrap;/s.test(StyleSheet),
    'Narrow-landscape result actions must remain compact.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.victory-panel\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*24px\);[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.result-actions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*-1px;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.result-actions\s+button\s*\{[^}]*font-size:\s*12px;[^}]*white-space:\s*nowrap;/s.test(StyleSheet),
    'Smallest portrait results must remain scrollable with compact reachable actions.',
  );
  requireCondition(
    HudSource.includes('getLoopObjectivePresentation(')
      && HudSource.includes('GameCanvas.dataset.objectiveLabel')
      && HudSource.includes('announceLive(Announcement)'),
    'Loop objective copy must remain on the canvas contract and the polite live region.',
  );
  requireCondition(
    /id="ScoutZoomStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /updateScoutZoomInterface\(\{\s*announce:\s*DidChange\s*\}\)/.test(CameraSource)
      && /ScoutZoomInButtonElement\.setAttribute\('aria-disabled',\s*String\(!Presentation\.canZoomIn\)\)/.test(CameraSource)
      && /ScoutZoomOutButtonElement\.setAttribute\('aria-disabled',\s*String\(!Presentation\.canZoomOut\)\)/.test(CameraSource)
      && /GameCanvas\.dataset\.scoutZoom\s*=\s*host\.ScoutZoomScale\.toFixed\(2\)/.test(CameraSource)
      && /ScoutZoomStatusElement\.textContent\s*=\s*WasScoutMode\s*\?\s*'Scout view off'\s*:\s*''/.test(CameraSource)
      && /if\s*\(ShouldRestoreScoutButtonFocus\)\s*ScoutButtonElement\.focus\(\{\s*preventScroll:\s*true\s*\}\)/.test(CameraSource),
    'Scout zoom must announce its level and mark deterministic limits without dropping focus.',
  );
  requireCondition(
    /function\s+toggleAudioPreference\(\)\s*\{[\s\S]*?getAudioPreferencePresentation\(WorldseedSound\.toggleMute\(\)\)[\s\S]*?showStatusToast\(Presentation\.status,\s*850\);[\s\S]*?\}/s.test(MainSource)
      && (MainSource.match(/toggleAudioPreference\(\);/g) ?? []).length >= 2,
    'Audio button and keyboard shortcut must share one announced preference state.',
  );
  requireCondition(
    MainSource.includes('isEditingTextField(KeyboardEventData.target)')
      && /if\s*\(\s*KeyboardEventData\.ctrlKey\s*\|\|\s*KeyboardEventData\.metaKey\s*\|\|\s*KeyboardEventData\.altKey\s*\)/.test(MainSource)
      && MainSource.includes('getVisibleModalFocusables(ActiveModalElement)')
      && /function setPageActivity\(IsActive\) \{[\s\S]*?SmoothPerformanceSampleCount = 0;[\s\S]*?PerformanceSampleElapsedSeconds = 0;/.test(MainSource),
    'Hotkeys must yield to typing and modifiers, the focus trap must skip hidden fields, and hiding the tab must reset quality samples.',
  );
  requireCondition(
    /IsReleaseDiagnosticsEnabled\s*=\s*IsLocalDevelopmentHost\s*&&/.test(MainSource),
    'Release diagnostics must remain restricted to local development hosts.',
  );
  requireCondition(
    MainSource.includes('resolveLeaderboardBaseUrl({')
      && MainSource.includes('queryOverride: PageSearchParameters.get(\'leaderboardApi\')')
      && /<meta name="orbitbreak-leaderboard-api" content="" \/>/.test(IndexHtml),
    'Public builds must keep the leaderboard endpoint empty and ignore remote query overrides.',
  );
  requireCondition(
    existsSync(resolve(RepositoryRoot, 'SECURITY.md'))
      && readRepositoryFile('SECURITY.md').includes('https://southers.github.io/ORBITBREAK/'),
    'SECURITY.md must describe the public playtest surface.',
  );
  requireCondition(
    existsSync(resolve(RepositoryRoot, 'src/performance.js'))
      && MainSource.includes('advanceAdaptivePixelRatio')
      && MainSource.includes("DiagnosticKind === 'performance'"),
    'The candidate must retain testable adaptive render quality and local diagnostics.',
  );

  const RequiredMetadataPatterns = [
    ['English document language', /<html lang="en">/],
    ['UTF-8 charset', /<meta charset="UTF-8"\s*\/>/],
    ['responsive viewport', /name="viewport"/],
    ['theme colour', /name="theme-color"/],
    ['Content-Security-Policy', /http-equiv="Content-Security-Policy"/],
    ['referrer policy', /name="referrer" content="no-referrer"/],
    ['Permissions-Policy', /http-equiv="Permissions-Policy"/],
    ['page description', /name="description"/],
    ['Open Graph title', /property="og:title"/],
    ['Open Graph description', /property="og:description"/],
    ['Open Graph type', /property="og:type"/],
    ['SVG favicon', /rel="icon"[^>]+orbitbreak-mark\.svg/],
    ['keyboard control description', /id="KeyboardHelp"/],
  ];
  for (const [Label, Pattern] of RequiredMetadataPatterns) {
    requireCondition(Pattern.test(IndexHtml), `index.html is missing ${Label}.`);
  }
  requireCondition(
    IndexHtml.includes('id="PlayCaption"')
      && /\.play-caption span\s*\{[^}]*font-size:\s*12px;[^}]*line-height:\s*1\.35;/s.test(StyleSheet)
      && IndexHtml.includes('id="KeyboardHelp"')
      && IndexHtml.includes('class="visually-hidden"'),
    'First-run captions and keyboard help must stay available without parking a HUD on the globe.',
  );
  requireCondition(
    !IndexHtml.includes('launches expire')
      && IndexHtml.includes("Warden's moving Command World"),
    'Page metadata must describe the current Command World and bonus-fuel rules.',
  );

  requireCondition(
    DefaultAuthoredSystemIdentifier === AuthoredCampaignSystemIdentifiers[0],
    'The default system must be the first campaign chapter.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.completion.continueToNextSystem === true
      && AuthoredSystemDefinitions['broken-belt']?.completion.continueToNextSystem === true
      && AuthoredSystemDefinitions['wandering-garden']?.completion.continueToNextSystem === false,
    'Reach continues to Shatterbelt; Verdant Caravan remains the terminal campaign chapter.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.openingBroadcast === 'WARDEN BROADCAST · TRAVEL IS FORBIDDEN · I HUNT CONNECTION',
    'The selected one-sector candidate must retain the opening Warden broadcast.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.openingBody.includes('Linking them lets those worlds prosper')
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.openingBriefing?.[1]?.body.includes('Orbitbreaker to other tiny worlds')
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.openingBriefing?.[1]?.body.includes('Tap the cage to break it')
      && RoutePresentationSource.includes('getHiddenWardenRouteCoach(')
      && HudSource.includes('getLoopObjectivePresentation(')
      && HudSource.includes('Linking them lets those worlds prosper.')
      && HudSource.includes('Tap the cage to break it.')
      && PresentationSource.includes('export function getRelayRevealLookTarget(')
      && LandingDirectorSource.includes('getRelayRevealLookTarget(')
      && LandingDirectorSource.includes('function restoreWorld(')
      && MainSource.includes('CourierStartTimesByLinkId'),
    'The selected sector must teach the first landing and show each new relay before circuits, shields or Command.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.wardenArrivalBroadcast
      === 'WARDEN BROADCAST · CONNECTION IS DISORDER · I WILL SILENCE EVERY WORLD THAT ANSWERS',
    'The selected one-sector candidate must retain the Warden arrival ideology.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.routeGuidance?.grove?.meadow
      === "Walk Grove's far rim, then aim back around Ember until the path locks Haven. That gold loop protects these worlds.",
    'The selected one-sector candidate must teach the surface line for its first circuit.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.routeGuidance?.frost?.ember
      === 'Aim at Ember to close a gold loop, or go the long way through Grove. Either second loop cracks Command open.',
    'The selected one-sector candidate must teach the route to its second circuit.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.commandApproachLine === 'A network cannot be imprisoned.'
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.completion.endingReveal === 'You did not save them alone. You reminded them they were never alone.'
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.completion.expansionSting === 'WARDEN NODE DISCONNECTED · SECTOR WARDENS: 11',
    'The selected one-sector candidate must retain its final resistance and ending reveals.',
  );
  requireCondition(
    MainSource.includes("const SecondRelayAnswerLine = '“We thought we were alone.”';")
      && MainSource.includes('GameCanvas.dataset.wardenArrivalAnswer = ArrivalAnswerLine;'),
    'The selected one-sector candidate must preserve the second answer through Warden arrival.',
  );
  requireCondition(
    AuthoredCampaignSystemIdentifiers.length === 3
      && AuthoredCampaignSystemIdentifiers[1] === 'broken-belt'
      && AuthoredCampaignSystemIdentifiers[2] === 'wandering-garden',
    'The release campaign must contain exactly three authored Warden sectors.',
  );
  for (const SystemIdentifier of AuthoredCampaignSystemIdentifiers) {
    const SystemDefinition = AuthoredSystemDefinitions[SystemIdentifier];
    requireCondition(Boolean(SystemDefinition), `Campaign system ${SystemIdentifier} is missing.`);
    if (!SystemDefinition) continue;
    requireCondition(
      !String(SystemDefinition.contentVersion).startsWith('migration-'),
      `Campaign system ${SystemIdentifier} still uses a migration content version.`,
    );
    requireCondition(
      SystemDefinition.commandWorldRequiresShieldBreaks === true
        && Boolean(SystemDefinition.storyBoards?.wardenArrival)
        && Boolean(SystemDefinition.openingBriefing?.length),
      `Campaign system ${SystemIdentifier} must own the Warden-loop story contract.`,
    );
    for (const ValidationError of validateAuthoredSystemDefinition(SystemDefinition)) {
      Failures.push(`${SystemIdentifier}: ${ValidationError}`);
    }
  }

  requireCondition(
    Boolean(AuthoredSystemDefinitions['long-night'])
      && Boolean(AuthoredSystemDefinitions.worldheart)
      && Boolean(AuthoredSystemDefinitions['first-light'])
      && !AuthoredCampaignSystemIdentifiers.includes('long-night')
      && !AuthoredCampaignSystemIdentifiers.includes('worldheart'),
    'Long Night, Worldheart and First Light remain query-only compatibility fixtures.',
  );
  requireCondition(Credits.includes('WORLDSEED'), 'CREDITS.md must record WORLDSEED provenance.');
  requireCondition(
    Credits.includes('Opening briefing portraits')
      && Credits.includes('assets/runner-portrait.jpg')
      && Credits.includes('original ORBITBREAK stills'),
    'CREDITS.md must explicitly state the current external-asset status.',
  );
  requireCondition(
    ReleaseBrief.includes('Never perform these without the user'),
    'RELEASE.md must retain the user-controlled external-action boundary.',
  );
  requireCondition(
    ReleaseBrief.includes('Known gated items'),
    'RELEASE.md must list incomplete or externally gated release work.',
  );
  const CandidateBuildVersion = ReleaseBrief.match(/Build `([^`]+)` passes/)?.[1];
  requireCondition(
    CandidateBuildVersion === MainBuildVersion,
    'RELEASE.md candidate evidence must match the published canvas build identifier.',
  );
  requireCondition(
    ReleaseBrief.includes('break your line')
      && ReleaseBrief.includes('destroy the bars')
      && ReleaseBrief.includes('surface walking')
      && ReleaseBrief.includes('zero-bonus-fuel continuation')
      && !ReleaseBrief.includes('eight-launch failure'),
    'RELEASE.md must describe the current surface, Break, Destroy and bonus-fuel rules.',
  );
  requireCondition(
    ReleaseBrief.includes('Three dense Warden sectors')
      && ReleaseBrief.includes("nine-world Breaker's Reach"),
    'RELEASE.md must present the three authored Warden sectors rather than the leftover library.',
  );

  return {
    build: MainBuildVersion ?? null,
    campaignSystems: AuthoredCampaignSystemIdentifiers.length,
    checkedLocalAssets: LocalAssetReferences.length,
    failures: Failures,
  };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const Audit = auditReleaseReadiness();
  if (Audit.failures.length > 0) {
    console.error('ORBITBREAK release audit failed:');
    for (const Failure of Audit.failures) console.error(`- ${Failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `ORBITBREAK ${Audit.build}: release audit passed for ${Audit.campaignSystems}`
      + ` campaign systems and ${Audit.checkedLocalAssets} local HTML assets.`,
    );
  }
}
