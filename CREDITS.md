# ORBITBREAK Credits

## Project licence

ORBITBREAK source code, writing, original artwork and generated audio are
released under the repository's [MIT License](LICENSE), copyright 2026
Southers, unless a file or credit below says otherwise. Third-party works
retain their original copyright and licence terms.

## Runtime libraries

- [Three.js](https://threejs.org/) 0.179.1 — MIT License. The pinned runtime is vendored at `vendor/three.module.min.js` and `vendor/three.core.min.js`; its licence is at `vendor/THREE-LICENSE.txt`.
- Three.js 0.179.1 example addon modules (same MIT licence and release) are vendored unmodified under `vendor/postprocessing/` (`EffectComposer`, `RenderPass`, `ShaderPass`, `MaskPass`, `Pass`, `UnrealBloomPass`, `OutputPass`) and `vendor/shaders/` (`CopyShader`, `LuminosityHighPassShader`, `OutputShader`) for the bloom post pipeline.

## Source foundation

- Deterministic physics, authored-content infrastructure, procedural rendering, audio and initial tests were imported from [WORLDSEED](https://github.com/Southers/WORLDSEED) at public main commit `936da3d`. WORLDSEED and ORBITBREAK are by the same project owner, but remain independent repositories and games.

## External art and audio assets

Opening briefing portraits `assets/runner-portrait.jpg`, `assets/warden-portrait.jpg`, `assets/haven-portrait.jpg`, `assets/orbitbreaker-portrait.jpg`, `assets/ember-portrait.jpg`, `assets/grove-portrait.jpg`, `assets/tide-portrait.jpg`, `assets/frost-portrait.jpg`, `assets/bastion-portrait.jpg` and `assets/command-portrait.jpg` are original ORBITBREAK stills generated for this project during development. They are not third-party stock.

Sampled voice, SFX and music under `assets/audio/` are generated with [ElevenLabs](https://elevenlabs.io/) using two stock library voices (Daniel for the Warden broadcast, Charlie for the Runner and world replies). They are produced in GitHub Actions from `secrets.ELEVENLABS_API_KEY` and committed as static files. The playable Pages build never calls ElevenLabs. Until those files are present, procedural Web Audio remains the fallback. All other geometry, materials, particles, interface beds and in-engine tones are generated in code.

The project owner has confirmed that the committed generated media and their
inputs may be used commercially and sublicensed under the repository MIT
License. Provider names identify provenance and do not transfer provider
trademarks or service branding into the ORBITBREAK licence.

The ORBITBREAK Runner model, Stillness cages, liberation effects, orbit-mark SVG and all animation are built entirely from procedural Three.js primitives, shaders, SVG and CSS and introduce no external asset.

Add the creator, asset title, source URL and licence here before committing any external art, audio, font, shader or sound.

## Development

ORBITBREAK is an original design developed from the WORLDSEED technical foundation with AI-assisted development.
