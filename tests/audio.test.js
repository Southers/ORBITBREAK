import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WorldseedAudio } from '../src/audio.js';

const Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createParam(InitialValue = 0) {
  return {
    value: InitialValue,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime() {},
  };
}

function createFakeHtmlAudioClass({ rejectPlay = false } = {}) {
  return class FakeHtmlAudio {
    static instances = [];

    constructor(src = '') {
      this.src = src;
      this.preload = 'none';
      this.muted = true;
      this.volume = 1;
      this.playsInline = false;
      this.currentTime = 0;
      this.playCount = 0;
      this.attributes = {};
      FakeHtmlAudio.instances.push(this);
    }

    setAttribute(Name, Value) {
      this.attributes[Name] = Value;
    }

    play() {
      this.playCount += 1;
      if (rejectPlay) {
        return Promise.reject(new Error('play rejected'));
      }
      return Promise.resolve();
    }
  };
}

function createFakeAudioContextClass() {
  return class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = { connect() { return this; } };
      this.resumeCount = 0;
      this.bufferSourceStartCount = 0;
    }

    resume() {
      this.resumeCount += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createGain() {
      return {
        gain: createParam(),
        connect(Next) { return Next ?? this; },
        disconnect() {},
      };
    }

    createDynamicsCompressor() {
      return {
        threshold: createParam(),
        knee: createParam(),
        ratio: createParam(),
        attack: createParam(),
        release: createParam(),
        connect(Next) { return Next ?? this; },
      };
    }

    createBuffer(_ChannelCount, Length) {
      return { getChannelData: () => new Float32Array(Length) };
    }

    createBufferSource() {
      const Context = this;
      return {
        buffer: null,
        loop: false,
        connect() { return this; },
        disconnect() {},
        start() { Context.bufferSourceStartCount += 1; },
        stop() {},
        addEventListener() {},
      };
    }

    createOscillator() {
      return {
        type: 'sine',
        frequency: createParam(),
        connect() { return this; },
        disconnect() {},
        start() {},
        stop() {},
        addEventListener() {},
      };
    }

    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: createParam(),
        Q: createParam(),
        connect() { return this; },
      };
    }

    decodeAudioData() {
      return Promise.resolve(null);
    }
  };
}

test('ensureStarted resumes a suspended context on first create', () => {
  const FakeAudioContext = createFakeAudioContextClass();
  const FakeAudio = createFakeHtmlAudioClass();
  globalThis.window = globalThis;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  globalThis.Audio = FakeAudio;
  const OriginalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const Sound = new WorldseedAudio();
    assert.equal(Sound.ensureStarted(), true);
    assert.equal(Sound.context.state, 'running');
    assert.ok(Sound.context.resumeCount >= 1);
    assert.ok(Sound.context.bufferSourceStartCount >= 1);
    Sound.context.state = 'suspended';
    assert.equal(Sound.ensureStarted(), true);
    assert.ok(Sound.context.resumeCount >= 2);
    assert.equal(Sound.context.state, 'running');
  } finally {
    globalThis.fetch = OriginalFetch;
    delete globalThis.Audio;
  }
});

test('ensureStarted plays a same-origin HTMLAudioElement in the gesture', () => {
  const FakeAudioContext = createFakeAudioContextClass();
  const FakeAudio = createFakeHtmlAudioClass();
  globalThis.window = globalThis;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  globalThis.Audio = FakeAudio;
  const OriginalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const Sound = new WorldseedAudio();
    assert.equal(Sound.ensureStarted(), true);
    assert.equal(FakeAudio.instances.length, 1);
    const UnlockElement = FakeAudio.instances[0];
    assert.equal(UnlockElement.playCount, 1);
    assert.equal(UnlockElement.preload, 'auto');
    assert.equal(UnlockElement.playsInline, true);
    assert.equal(UnlockElement.muted, false);
    assert.equal(UnlockElement.src.includes('assets/audio/'), true);
    assert.equal(UnlockElement.src.includes('sfx/ui-continue.mp3'), true);
    assert.equal(/^https?:\/\//.test(UnlockElement.src), false);
    assert.equal(UnlockElement.src.startsWith('./assets/audio/'), true);
    assert.equal(Sound.htmlUnlockElement, UnlockElement);
    Sound.context.state = 'running';
    assert.equal(Sound.ensureStarted(), true);
    assert.equal(FakeAudio.instances.length, 1);
    assert.equal(UnlockElement.playCount, 1);
    Sound.context.resume = function resumeAndStaySuspended() {
      this.resumeCount += 1;
      return Promise.resolve();
    };
    Sound.context.state = 'suspended';
    assert.equal(Sound.ensureStarted(), true);
    assert.equal(FakeAudio.instances.length, 1);
    assert.equal(UnlockElement.playCount, 2);
    Sound.context.state = 'running';
    assert.equal(Sound.playUiContinue(), true);
    assert.equal(UnlockElement.playCount, 3);
  } finally {
    globalThis.fetch = OriginalFetch;
    delete globalThis.Audio;
  }
});

test('HTML unlock play rejection falls back without throwing', async () => {
  const FakeAudioContext = createFakeAudioContextClass();
  const FakeAudio = createFakeHtmlAudioClass({ rejectPlay: true });
  globalThis.window = globalThis;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  globalThis.Audio = FakeAudio;
  const OriginalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const Sound = new WorldseedAudio();
    assert.equal(Sound.ensureStarted(), true);
    assert.equal(Sound.playUiContinue(), true);
    await Promise.resolve();
    assert.equal(FakeAudio.instances[0].playCount >= 1, true);
  } finally {
    globalThis.fetch = OriginalFetch;
    delete globalThis.Audio;
  }
});

test('Continue, Skip, How-to, canvas tap and Audio [M] call HTML unlock in the gesture', () => {
  const AudioSource = readFileSync(resolve(Root, 'src/audio.js'), 'utf8');
  const MainSource = readFileSync(resolve(Root, 'src/main.js'), 'utf8');
  const StorySource = readFileSync(resolve(Root, 'src/story-director.js'), 'utf8');
  const InputSource = readFileSync(resolve(Root, 'src/input-controller.js'), 'utf8');
  const IndexHtml = readFileSync(resolve(Root, 'index.html'), 'utf8');
  assert.equal(AudioSource.includes('playHtmlMediaUnlock()'), true);
  assert.equal(AudioSource.includes('new AudioConstructor('), true);
  assert.equal(AudioSource.includes('await this.htmlUnlockElement.play'), false);
  assert.equal(AudioSource.includes('await UnlockElement.play'), false);
  assert.equal(/async\s+ensureStarted\s*\(/.test(AudioSource), false);
  assert.equal(MainSource.includes('await WorldseedSound'), false);
  assert.equal(StorySource.includes('await WorldseedSound'), false);
  assert.equal(InputSource.includes('await WorldseedSound'), false);
  assert.equal(StorySource.includes('WorldseedSound.ensureStarted();'), true);
  assert.equal(StorySource.includes('WorldseedSound.playUiContinue();'), true);
  assert.equal(MainSource.includes('WorldseedSound.ensureStarted();'), true);
  assert.equal(MainSource.includes('WorldseedSound.playUiContinue();'), true);
  assert.equal(MainSource.includes('WorldseedSound.toggleMute()'), true);
  assert.equal(InputSource.includes('WorldseedSound.ensureStarted();'), true);
  assert.equal(IndexHtml.includes("media-src 'self'"), true);
  assert.equal(IndexHtml.includes("media-src 'none'"), false);
  assert.equal(/media-src[^;"]*https:/.test(IndexHtml), false);
  assert.equal(/media-src[^;"]*data:/.test(IndexHtml), false);
});

test('CSP allows same-origin media and keeps third-party media closed', () => {
  const IndexHtml = readFileSync(resolve(Root, 'index.html'), 'utf8');
  assert.equal(IndexHtml.includes("media-src 'self'"), true);
  assert.equal(IndexHtml.includes("media-src 'none'"), false);
  assert.equal(/media-src[^"]*https:/.test(IndexHtml), false);
});
