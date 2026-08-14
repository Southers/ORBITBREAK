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
    /id="MotionButton"/.test(IndexHtml)
      && MainSource.includes("window.localStorage.setItem('orbitbreak.motion'")
      && MainSource.includes("PageSearchParameters.get('diagnostics') === '1'"),
    'The candidate must retain persistent motion control and its explicit diagnostics gate.',
  );
  requireCondition(
    /IsReleaseDiagnosticsEnabled\s*=\s*IsLocalDevelopmentHost\s*&&/.test(MainSource),
    'Release diagnostics must remain restricted to local development hosts.',
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
    DefaultAuthoredSystemIdentifier === AuthoredCampaignSystemIdentifiers[0],
    'The default system must be the first campaign chapter.',
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
    Credits.includes('None. The imported geometry'),
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
