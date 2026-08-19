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
  globalThis.window = globalThis;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
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
  }
});

test('CSP allows same-origin media and keeps third-party media closed', () => {
  const IndexHtml = readFileSync(resolve(Root, 'index.html'), 'utf8');
  assert.equal(IndexHtml.includes("media-src 'self'"), true);
  assert.equal(IndexHtml.includes("media-src 'none'"), false);
  assert.equal(/media-src[^"]*https:/.test(IndexHtml), false);
});
