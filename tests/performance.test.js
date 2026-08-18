import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdaptiveSampleWindowSeconds,
  DefaultAdaptivePixelRatioCap,
  SmoothSamplesBeforeUpgrade,
  advanceAdaptivePixelRatio,
  getAdaptiveDeviceCap,
  getAdaptivePresentationSettings,
  getAdaptivePresentationTier,
  getViewportPixelRatioCap,
} from '../src/performance.js';

test('viewport pixel-ratio caps protect mobile fill rate', () => {
  assert.equal(getViewportPixelRatioCap(390, 844), 1.25);
  assert.equal(getViewportPixelRatioCap(844, 390), 1.25);
  assert.equal(getViewportPixelRatioCap(1280, 720), 1.5);
  assert.equal(getAdaptiveDeviceCap(390, 844), 1.5);
  assert.equal(getAdaptiveDeviceCap(1280, 720), 2);
});

test('default laptop quality skips bloom until frames stay smooth', () => {
  assert.equal(DefaultAdaptivePixelRatioCap, 1.5);
  assert.equal(AdaptiveSampleWindowSeconds, 0.75);
  const Balanced = getAdaptivePresentationSettings(DefaultAdaptivePixelRatioCap);
  assert.equal(Balanced.tier, 'balanced');
  assert.equal(Balanced.bloom, false);
  assert.equal(Balanced.shadows, false);
  assert.equal(Balanced.nebula, true);
  assert.equal(Balanced.biomeMotion, false);
  assert.equal(Balanced.stardustSpin, false);
  assert.equal(Balanced.instanceStride, 2);
  assert.equal(getAdaptivePresentationSettings(1.75).bloom, true);
  assert.equal(getAdaptivePresentationSettings(1.75).nebula, true);
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

test('a hitch from restored high quality drops bloom on the next sample', () => {
  const QualityState = advanceAdaptivePixelRatio(
    { cap: 1.75, smoothSamples: 2 },
    {
      averageFrameSeconds: 1 / 20,
      deviceCap: 2,
      isVisible: true,
    },
  );
  assert.equal(QualityState.cap, 1.5);
  assert.equal(getAdaptivePresentationSettings(QualityState.cap).bloom, false);
  assert.equal(getAdaptivePresentationSettings(QualityState.cap).nebula, true);
});

test('a hitch from the default cap disables nebula and atmosphere shells', () => {
  const QualityState = advanceAdaptivePixelRatio(
    { cap: DefaultAdaptivePixelRatioCap, smoothSamples: 0 },
    {
      averageFrameSeconds: 1 / 20,
      deviceCap: 2,
      isVisible: true,
    },
  );
  assert.equal(QualityState.cap, 1.25);
  const Settings = getAdaptivePresentationSettings(QualityState.cap);
  assert.equal(Settings.bloom, false);
  assert.equal(Settings.nebula, false);
  assert.equal(Settings.atmospheres, false);
  assert.equal(Settings.trailUpdates, false);
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

test('presentation tiers cut bloom and nebula before dropping below a readable floor', () => {
  assert.equal(getAdaptivePresentationTier(2), 'high');
  assert.equal(getAdaptivePresentationTier(1.5), 'balanced');
  assert.equal(getAdaptivePresentationTier(1.25), 'degraded');
  assert.equal(getAdaptivePresentationTier(1), 'degraded');
  assert.equal(getAdaptivePresentationSettings(2).bloom, true);
  assert.equal(getAdaptivePresentationSettings(2).shadows, false);
  assert.equal(getAdaptivePresentationSettings(1.5).bloom, false);
  assert.equal(getAdaptivePresentationSettings(1.25).nebula, false);
});
