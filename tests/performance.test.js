import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SmoothSamplesBeforeUpgrade,
  advanceAdaptivePixelRatio,
  getViewportPixelRatioCap,
} from '../src/performance.js';

test('viewport pixel-ratio caps protect mobile fill rate', () => {
  assert.equal(getViewportPixelRatioCap(390, 844), 1.5);
  assert.equal(getViewportPixelRatioCap(844, 390), 1.5);
  assert.equal(getViewportPixelRatioCap(1280, 720), 2);
});

test('a slow visible sample immediately reduces render cost to a safe floor', () => {
  let QualityState = { cap: 2, smoothSamples: 3 };
  QualityState = advanceAdaptivePixelRatio(QualityState, {
    averageFrameSeconds: 1 / 20,
    deviceCap: 2,
    isVisible: true,
  });
  assert.deepEqual(QualityState, {
    cap: 1.75,
    smoothSamples: 0,
    action: 'degraded',
  });

  for (let SampleIndex = 0; SampleIndex < 8; SampleIndex += 1) {
    QualityState = advanceAdaptivePixelRatio(QualityState, {
      averageFrameSeconds: 1 / 20,
      deviceCap: 2,
      isVisible: true,
    });
  }
  assert.equal(QualityState.cap, 1);
  assert.equal(QualityState.action, 'minimum');
});

test('quality restores only after sustained smooth samples', () => {
  let QualityState = { cap: 1.25, smoothSamples: 0 };
  for (let SampleIndex = 1; SampleIndex < SmoothSamplesBeforeUpgrade; SampleIndex += 1) {
    QualityState = advanceAdaptivePixelRatio(QualityState, {
      averageFrameSeconds: 1 / 60,
      deviceCap: 2,
      isVisible: true,
    });
    assert.equal(QualityState.cap, 1.25);
    assert.equal(QualityState.action, 'recovering');
  }
  QualityState = advanceAdaptivePixelRatio(QualityState, {
    averageFrameSeconds: 1 / 60,
    deviceCap: 2,
    isVisible: true,
  });
  assert.deepEqual(QualityState, {
    cap: 1.5,
    smoothSamples: 0,
    action: 'restored',
  });
});

test('background and middling samples cannot change quality', () => {
  assert.deepEqual(
    advanceAdaptivePixelRatio(
      { cap: 1.5, smoothSamples: 2 },
      { averageFrameSeconds: 1 / 15, deviceCap: 2, isVisible: false },
    ),
    { cap: 1.5, smoothSamples: 0, action: 'steady' },
  );
  assert.deepEqual(
    advanceAdaptivePixelRatio(
      { cap: 1.5, smoothSamples: 2 },
      { averageFrameSeconds: 1 / 45, deviceCap: 2, isVisible: true },
    ),
    { cap: 1.5, smoothSamples: 0, action: 'steady' },
  );
});
