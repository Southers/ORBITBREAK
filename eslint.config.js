import js from '@eslint/js';

// Browser-shell layer: allowed to touch the DOM, window and Three.js.
// Everything else in src/ stays framework-free so the ranked simulation is portable.
const BrowserShellFiles = [
  'src/main.js',
  'src/audio.js',
  'src/environment.js',
  'src/world-geometry.js',
  'src/living-world-visuals.js',
  'src/warden-visuals.js',
  'src/player-visuals.js',
  'src/hud.js',
  'src/story-director.js',
  'src/aim-preview.js',
  'src/landing-director.js',
  'src/camera-controller.js',
  'src/input-controller.js',
  'src/hostile-surface.js',
  'src/scanner.js',
  'src/route-presentation.js',
  'src/records-ui.js',
  'src/frame-visuals.js',
  'src/restoration-visuals.js',
  'src/leaderboard-client.js',
  'src/preferences.js',
  'src/performance.js',
];

const RankedSimulationFiles = [
  'src/physics.js',
  'src/run.js',
  'src/campaign.js',
  'src/network.js',
  'src/warden.js',
  'src/scoring.js',
  'src/encounter.js',
  'src/replay.js',
  'src/replay-playback.js',
  'src/replay-validator.js',
  'src/restoration.js',
  'src/records.js',
  'src/ghost.js',
  'src/content.js',
  'src/content/**/*.js',
  'src/sector.js',
  'src/sim-constants.js',
  'src/flight-resolver.js',
];

export default [
  {
    ignores: ['vendor/**', 'node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    ...js.configs.recommended,
    files: [
      'src/sector.js',
      'src/sim-constants.js',
      'src/flight-resolver.js',
      'tests/sector.test.js',
      'tests/flight-resolver.test.js',
      'tests/fixtures/load-fixture.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.js'],
    ignores: BrowserShellFiles,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message: 'DOM access stays in the browser-shell modules.',
        },
        {
          name: 'window',
          message: 'Window access stays in the browser-shell modules.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message: 'Three.js stays in the browser-shell modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: RankedSimulationFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message: 'Ranked simulation must stay framework-free.',
            },
          ],
          patterns: [
            {
              group: ['**/presentation.js', './presentation.js'],
              message: 'Ranked simulation must not import presentation.',
            },
            {
              group: ['**/audio.js', './audio.js', '**/main.js', './main.js'],
              message: 'Ranked simulation must not import the browser shell.',
            },
          ],
        },
      ],
    },
  },
];
