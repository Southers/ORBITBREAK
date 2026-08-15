import { existsSync, readFileSync } from 'node:fs';
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
  requireCondition(
    IndexHtml.includes('"three": "./vendor/three.module.min.js?v=0.179.1"'),
    'The import map must retain the pinned vendored Three.js runtime.',
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
    PresentationSource.includes('export function getSectorPlanningCamera(')
      && PresentationSource.includes('export function getPlanningFocusWorldIdentifiers(')
      && PresentationSource.includes('export function getPlanningAtmosphere(')
      && MainSource.includes('MaximumTrajectoryPredictionSteps = 720')
      && MainSource.includes('applySectorPlanningCamera(')
      && MainSource.includes('snapLiveCameraToPlanningView(')
      && MainSource.includes('PlanningCameraScale * AimZoomScale')
      && MainSource.includes('updateFlightPlanningPresentation(')
      && MainSource.includes('beginPinchIfNeeded()')
      && MainSource.includes('refreshPlanningZoomControls('),
    'Aiming must frame the readable neighbourhood, lift fog and keep pinch zoom on the exact remaining path.',
  );
  requireCondition(
    PresentationSource.includes('export function getWorldLifeStage(')
      && PresentationSource.includes("return 'tyrant';")
      && MainSource.includes('OccupationMineMesh')
      && MainSource.includes('OccupationFumeMesh')
      && MainSource.includes('ExtractionFreighterMesh')
      && MainSource.includes('visiblePrisonerCount')
      && MainSource.includes('RunnerPresentationScale = 0.52')
      && MainSource.includes('getLandedCameraScale('),
    'Occupied worlds must show tyrant extraction, held people and a tiny Runner so living contrast can read.',
  );
  requireCondition(
    Array.isArray(AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]?.openingBriefing)
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier].openingBriefing.length >= 4
      && /id="OpeningBriefing"/.test(IndexHtml)
      && /id="BriefingContinueButton"/.test(IndexHtml)
      && /\.opening-briefing__actions button\s*\{[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && MainSource.includes('beginOpeningBriefing(')
      && PresentationSource.includes('export function getOpeningBriefingPresentation('),
    'The selected sector must open with a story board that names the Runner, the Reach and the charge.',
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
      && MainSource.includes('WorldseedSound.setStoryPaused(true)')
      && MainSource.includes('WorldseedSound.stopTransients()')
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
    MainSource.includes('ProsperityBuildingMesh')
      && MainSource.includes('ProsperityWindowMesh')
      && MainSource.includes('refreshDockedTradeState(')
      && MainSource.includes('getTradeHullKind(')
      && MainSource.includes('getInhabitantSilhouette(')
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
    /id="WardenPanel"[^>]+aria-live="polite"[^>]+aria-atomic="true"/.test(IndexHtml)
      && /id="StatusToast"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/.test(IndexHtml),
    'Warden and transient status updates must remain atomic assistive announcements.',
  );
  requireCondition(
    /id="FlightScore"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /\.flight-score\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.flight-score\s+small\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.warden-panel\s*\{[^}]*top:\s*124px;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.warden-panel\s*\{[^}]*top:\s*164px;/s.test(StyleSheet),
    'Unbanked score updates must remain atomic, legible and separated from the Warden forecast.',
  );
  requireCondition(
    /\.instruction-panel span\s*\{[^}]*color:\s*rgba\(226, 235, 241, 0\.78\);[^}]*font-size:\s*12px;[^}]*line-height:\s*1\.35;/s.test(StyleSheet),
    'Critical instruction body copy must retain its legible contrast, size and line height.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.burn-button\s*\{[^}]*right:\s*max\(18px,\s*env\(safe-area-inset-right\)\);[^}]*left:\s*auto;[^}]*transform:\s*none;/s.test(StyleSheet),
    'Short-landscape Breaker controls must remain on the safe edge of the flight view.',
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
    /id="ReplayIndicator"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /\.replay-indicator\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Replay progress must remain an atomic live status at a legible type floor.',
  );
  requireCondition(
    /\.warden-panel\s+span,\s*\.warden-panel\s+small\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;[^}]*white-space:\s*nowrap;/s.test(StyleSheet),
    'Warden state and target forecasts must retain their legible single-line floor.',
  );
  requireCondition(
    /\.route-label,\s*\.tactical-label\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.tactical-label\s*\{[^}]*font-size:\s*10px;[^}]*white-space:\s*nowrap;/s.test(StyleSheet)
      && /\.route-label\s*\{[^}]*white-space:\s*nowrap;/s.test(StyleSheet)
      && MainSource.includes('separateRouteLabelsFromTacticalLabels(')
      && MainSource.includes('separateOverlappingTacticalLabels(')
      && MainSource.includes('getTacticalLabelHorizontalMargin(')
      && MainSource.includes('TacticalLabelScreenPositions'),
    'Route and tactical labels must remain legible, single-line and collision-aware.',
  );
  requireCondition(
    /id="ScannerPanel"[^>]*role="img"[^>]*aria-label="System scanner"/.test(IndexHtml)
      && /\.scanner-panel\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.counter__label\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.counter__label\s*\{[^}]*font-size:\s*10px;/s.test(StyleSheet)
      && MainSource.includes('getScannerAccessibleLabel({')
      && MainSource.includes('getPlayfieldLabelVerticalBounds({')
      && MainSource.includes("ScannerPanelElement.setAttribute('aria-label', ScannerAccessibleLabel)"),
    'Navigation HUD labels must remain legible and the visual scanner must expose a semantic snapshot.',
  );
  requireCondition(
    /id="AimPanel"[^>]*role="group"[^>]*aria-label="Aim preview"/.test(IndexHtml)
      && /\.aim-panel\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /#AimLabel\s*\{[^}]*min-width:\s*100px;[^}]*max-width:\s*160px;/s.test(StyleSheet)
      && /\.burn-button\s+span\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Aim preview and Breaker Burn labels must retain their named, legible action hierarchy.',
  );
  requireCondition(
    /\.result-breakdown\s+dt\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.emblem\s+small\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Verified score categories and earned emblem captions must retain their legible type floor.',
  );
  requireCondition(
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.hud__actions\s*\{[^}]*gap:\s*4px;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?#ResetButton,[\s\S]*?\.scout-zoom-button\s*\{[^}]*min-width:\s*44px;[^}]*padding-inline:\s*5px;[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.scout-zoom-button\s*\{[^}]*font-size:\s*19px;[^}]*line-height:\s*1;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.counter__label\s*\{[^}]*font-size:\s*10px;/s.test(StyleSheet),
    'Portrait utility controls and counters must retain 44px targets and a 10px text floor.',
  );
  requireCondition(
    /@media\s*\(max-width:\s*380px\)\s*\{[^}]*\.instruction-panel\s*\{[^}]*bottom:\s*max\(70px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*64px\)\);/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\.hud__actions\s*\{[^}]*flex-wrap:\s*wrap;/s.test(StyleSheet)
      && /@media\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\.instruction-panel\s*\{[^}]*bottom:\s*max\(118px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*112px\)\);/s.test(StyleSheet),
    'Narrow phones must reserve instruction space above wrapped Scout controls.',
  );
  requireCondition(
    /\.leaderboard-form\s+label\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.leaderboard-list__runner\s+small\s*\{[^}]*color:\s*rgba\(214,\s*228,\s*235,\s*0\.68\);[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.leaderboard-list\s+button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s.test(StyleSheet)
      && MainSource.includes("(LeaderboardListElement.querySelector('button') ?? CloseLeaderboardButtonElement)")
      && MainSource.includes("CallsignInputElement.focus({ preventScroll: true });"),
    'Rankings callsigns, replay actions and submission focus must stay accessible.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.instruction-panel\s*\{[^}]*flex-direction:\s*row;[^}]*gap:\s*14px;[^}]*width:\s*min\(92vw,\s*540px\);[^}]*padding:\s*9px\s+14px;[^}]*text-align:\s*left;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.warden-panel\s*\{[^}]*top:\s*62px;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.instruction-panel\s+strong\s*\{[^}]*flex:\s*0\s+0\s+clamp\(112px,\s*20vw,\s*148px\);/s.test(StyleSheet),
    'Compact landscape must preserve a shallow fluid two-column instruction card.',
  );
  requireCondition(
    MainSource.includes('getPlayfieldLabelVerticalBounds({')
      && MainSource.includes('const InstructionTop = InstructionPanelElement.getBoundingClientRect().top;')
      && MainSource.includes('instructionTop: InstructionTop')
      && PresentationSource.includes('if (wardenVisible && isShortLandscape) return 140;')
      && PresentationSource.includes('? Math.min(BaseMaximumY, instructionTop - 16)'),
    'Compact landscape labels must remain between the reflowed Warden and instruction HUD.',
  );
  requireCondition(
    MainSource.includes('minimumGap: IsShortLandscape ? 160 : 76')
      && MainSource.includes('horizontalClearance: IsShortLandscape ? 180 : 100')
      && MainSource.includes('verticalClearance: IsShortLandscape ? 22 : 30')
      && MainSource.includes('WorldheartDefinition.routeAvailable && !IsShortLandscape'),
    'Short-landscape Command exposure must separate choices and omit its duplicate tactical chip.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-width:\s*640px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.aim-panel\s*\{[^}]*bottom:\s*max\(140px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*134px\)\);/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*480px\)\s*and\s*\(max-width:\s*640px\)\s*and\s*\(max-height:\s*520px\)\s*\{[\s\S]*?\.result-actions\s+button\s*\{[^}]*padding:\s*10px\s+8px;[^}]*font-size:\s*13px;[^}]*line-height:\s*1\.2;[^}]*white-space:\s*nowrap;/s.test(StyleSheet),
    'Narrow-landscape Command aim and result actions must remain separated and compact.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.aim-panel\s*,\s*\.burn-button\.is-pulse\s*\{[^}]*bottom:\s*max\(156px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*150px\)\);/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\.aim-panel\s*,\s*\.burn-button\.is-pulse\s*\{[^}]*bottom:\s*max\(206px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*200px\)\);/s.test(StyleSheet)
      && MainSource.includes("BurnButtonElement.classList.toggle('is-pulse', IsHostileCut)"),
    'Portrait aim and Cut controls must clear the coach at ordinary and wrapped-footer widths.',
  );
  requireCondition(
    /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.victory-panel\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*24px\);[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.result-actions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*-1px;/s.test(StyleSheet)
      && /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.result-actions\s+button\s*\{[^}]*font-size:\s*12px;[^}]*white-space:\s*nowrap;/s.test(StyleSheet),
    'Smallest portrait results must remain scrollable with compact reachable actions.',
  );
  requireCondition(
    /id="ObjectivePanel"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /id="ObjectiveLabel"/.test(IndexHtml)
      && /\.objective-panel__label\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet)
      && /\.objective-panel__state\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*1\.2;/s.test(StyleSheet),
    'Command World objective updates must remain a complete atomic status with legible type.',
  );
  requireCondition(
    /id="ScoutZoomStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(IndexHtml)
      && /updateScoutZoomInterface\(\{\s*announce:\s*DidChange\s*\}\)/.test(MainSource)
      && /ScoutZoomInButtonElement\.setAttribute\('aria-disabled',\s*String\(!Presentation\.canZoomIn\)\)/.test(MainSource)
      && /ScoutZoomOutButtonElement\.setAttribute\('aria-disabled',\s*String\(!Presentation\.canZoomOut\)\)/.test(MainSource)
      && /GameCanvas\.dataset\.scoutZoom\s*=\s*ScoutZoomScale\.toFixed\(2\)/.test(MainSource)
      && /ScoutZoomStatusElement\.textContent\s*=\s*WasScoutMode\s*\?\s*'Scout view off'\s*:\s*''/.test(MainSource)
      && /if\s*\(ShouldRestoreScoutButtonFocus\)\s*ScoutButtonElement\.focus\(\{\s*preventScroll:\s*true\s*\}\)/.test(MainSource),
    'Scout zoom must announce its level and mark deterministic limits without dropping focus.',
  );
  requireCondition(
    /function\s+toggleAudioPreference\(\)\s*\{[\s\S]*?getAudioPreferencePresentation\(WorldseedSound\.toggleMute\(\)\)[\s\S]*?showStatusToast\(Presentation\.status,\s*850\);[\s\S]*?\}/s.test(MainSource)
      && (MainSource.match(/toggleAudioPreference\(\);/g) ?? []).length >= 2,
    'Audio button and keyboard shortcut must share one announced preference state.',
  );
  requireCondition(
    /IsReleaseDiagnosticsEnabled\s*=\s*IsLocalDevelopmentHost\s*&&/.test(MainSource),
    'Release diagnostics must remain restricted to local development hosts.',
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
    IndexHtml.includes('<span class="brand__subtitle">connect the tiny worlds</span>')
      && /\.brand__subtitle\s*\{[^}]*color:\s*rgba\(224,\s*235,\s*240,\s*0\.68\);[^}]*font-size:\s*11px;/s.test(StyleSheet),
    'The masthead must state the legible Tiny Worlds promise.',
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
      ?.completion.continueToNextSystem === false,
    'The selected one-sector candidate must end without a legacy campaign continuation.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.openingBroadcast === 'WARDEN BROADCAST · TRAVEL IS FORBIDDEN · SILENCE KEEPS YOU SAFE',
    'The selected one-sector candidate must retain the opening Warden broadcast.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.openingBody.includes('They are still out there')
      && AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
        ?.openingBody.includes('Carry the first word')
      && MainSource.includes('getHiddenWardenRouteCoach(')
      && MainSource.includes('getLoopObjectivePresentation(')
      && /id="ObjectiveLabel"[^>]*>NEIGHBOURHOOD</.test(IndexHtml)
      && PresentationSource.includes('export function getRelayRevealLookTarget(')
      && MainSource.includes('getRelayRevealLookTarget(')
      && MainSource.includes('CourierStartTimesByLinkId'),
    'The selected sector must teach the first landing and show each new relay before circuits, shields or Command.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.wardenArrivalBroadcast
      === 'WARDEN BROADCAST · CONNECTION IS DISORDER · MOVEMENT IS DISOBEDIENCE',
    'The selected one-sector candidate must retain the Warden arrival ideology.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.routeGuidance?.grove?.meadow
      === "Walk Grove's far rim, then aim back around Ember until the path locks Haven. The whole arc is on the map—hold it to close the gold loop.",
    'The selected one-sector candidate must teach the surface line for its first circuit.',
  );
  requireCondition(
    AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier]
      ?.routeGuidance?.frost?.ember
      === 'Ember is the direct lock; Grove is the alternate arc. Either closes the second gold loop and exposes Command.',
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
    AuthoredCampaignSystemIdentifiers.length === 5,
    'The release campaign must contain exactly five authored systems.',
  );
  for (const SystemIdentifier of AuthoredCampaignSystemIdentifiers) {
    const SystemDefinition = AuthoredSystemDefinitions[SystemIdentifier];
    requireCondition(Boolean(SystemDefinition), `Campaign system ${SystemIdentifier} is missing.`);
    if (!SystemDefinition) continue;
    requireCondition(
      !String(SystemDefinition.contentVersion).startsWith('migration-'),
      `Campaign system ${SystemIdentifier} still uses a migration content version.`,
    );
    for (const ValidationError of validateAuthoredSystemDefinition(SystemDefinition)) {
      Failures.push(`${SystemIdentifier}: ${ValidationError}`);
    }
  }

  requireCondition(Credits.includes('Three.js'), 'CREDITS.md must credit Three.js.');
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
      && ReleaseBrief.includes('cut the teeth')
      && ReleaseBrief.includes('surface walking')
      && ReleaseBrief.includes('zero-bonus-fuel continuation')
      && !ReleaseBrief.includes('eight-launch failure'),
    'RELEASE.md must describe the current surface, Break, Cut and bonus-fuel rules.',
  );
  requireCondition(
    ReleaseBrief.includes('One dense six-world sector'),
    'RELEASE.md must present the selected one-sector candidate rather than the compatibility library.',
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
