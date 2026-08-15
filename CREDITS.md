# ORBITBREAK Credits

## Runtime libraries

- [Three.js](https://threejs.org/) 0.179.1 — MIT License. The pinned runtime is vendored at `vendor/three.module.min.js` and `vendor/three.core.min.js`; its licence is at `vendor/THREE-LICENSE.txt`.

## Source foundation

- Deterministic physics, authored-content infrastructure, procedural rendering, audio and initial tests were imported from [WORLDSEED](https://github.com/Southers/WORLDSEED) at public main commit `936da3d`. WORLDSEED and ORBITBREAK are by the same project owner, but remain independent repositories and games.

## External art and audio assets

Opening briefing portraits `assets/runner-portrait.jpg`, `assets/warden-portrait.jpg`, `assets/haven-portrait.jpg`, `assets/orbitbreaker-portrait.jpg`, `assets/ember-portrait.jpg`, `assets/grove-portrait.jpg`, `assets/tide-portrait.jpg`, `assets/frost-portrait.jpg`, `assets/bastion-portrait.jpg` and `assets/command-portrait.jpg` are original ORBITBREAK stills generated for this project during development. They are not third-party stock. All other geometry, materials, particles, interface, music and sound effects are generated in code. Procedural audio uses the browser Web Audio API and contains no sampled or third-party source material.

The ORBITBREAK Runner model, Stillness cages, liberation effects, orbit-mark SVG and all animation are built entirely from procedural Three.js primitives, shaders, SVG and CSS and introduce no external asset.

Add the creator, asset title, source URL and licence here before committing any external art, audio, font, shader or sound.

## Development

ORBITBREAK is an original design developed from the WORLDSEED technical foundation with AI-assisted development.
