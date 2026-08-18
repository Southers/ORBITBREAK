export const QualityPresentationTiers = Object.freeze({
  high: 'high',
  balanced: 'balanced',
  degraded: 'degraded',
});

/** Opening cap: balanced look at 1.5x fill, never UnrealBloom, until frames prove they are smooth. */
export const DefaultAdaptivePixelRatioCap = 1.5;
/** Ceiling the adaptive budget may restore to on a proven-smooth desktop. */
export const MaximumAdaptivePixelRatioCap = 2;
/** Sample window before a hitch can drop bloom/nebula/pixel-ratio. */
export const AdaptiveSampleWindowSeconds = 0.75;

/** Maps the live pixel-ratio cap onto presentation cost: shadows, motes and sway. */
export function getAdaptivePresentationTier(cap) {
  if (!(cap > 1.25)) {
    return QualityPresentationTiers.degraded;
  }
  if (!(cap > 1.5)) {
    return QualityPresentationTiers.balanced;
  }
  return QualityPresentationTiers.high;
}

/**
 * Presentation-only knobs for one adaptive cap. Physics, scoring and replay never
 * read this. Bloom is high-only so a normal laptop starts smooth; a hitch drops
 * nebula and atmosphere shells on the next sample instead of waiting for 1.25.
 */
export function getAdaptivePresentationSettings(pixelRatioCap) {
  const cap = Number(pixelRatioCap);
  const tier = getAdaptivePresentationTier(cap);
  if (tier === QualityPresentationTiers.high) {
    return {
      pixelRatioCap: cap,
      tier,
      bloom: true,
      shadows: false,
      nebula: true,
      nebulaIntensityScale: 1,
      atmospheres: true,
      biomeMotion: true,
      starTwinkle: true,
      trailUpdates: true,
      stardustSpin: true,
      instanceStride: 1,
    };
  }
  if (tier === QualityPresentationTiers.balanced) {
    return {
      pixelRatioCap: cap,
      tier,
      bloom: false,
      shadows: false,
      nebula: true,
      nebulaIntensityScale: 0.48,
      atmospheres: true,
      biomeMotion: false,
      starTwinkle: false,
      trailUpdates: true,
      stardustSpin: false,
      instanceStride: 2,
    };
  }
  return {
    pixelRatioCap: cap,
    tier,
    bloom: false,
    shadows: false,
    nebula: false,
    nebulaIntensityScale: 0,
    atmospheres: false,
    biomeMotion: false,
    starTwinkle: false,
    trailUpdates: false,
    stardustSpin: false,
    instanceStride: 3,
  };
}

export const MinimumAdaptivePixelRatio = 1;
export const AdaptivePixelRatioStep = 0.25;
export const SlowFrameThresholdSeconds = 1 / 34;
export const SmoothFrameThresholdSeconds = 1 / 52;
export const SmoothSamplesBeforeUpgrade = 4;

/** Keeps portrait/mobile fill rate bounded before live performance sampling begins. */
export function getViewportPixelRatioCap(ViewportWidth, ViewportHeight) {
  const SmallestViewportDimension = Math.min(ViewportWidth, ViewportHeight);
  return SmallestViewportDimension <= 640 ? 1.25 : 1.5;
}

/**
 * Ceiling the adaptive *effects* budget may restore to. Actual framebuffer size
 * still uses `getViewportPixelRatioCap`, so a smooth desktop can re-enable bloom
 * at 1.5x pixels instead of climbing back to a 2x UnrealBloom fill.
 */
export function getAdaptiveDeviceCap(ViewportWidth, ViewportHeight) {
  const SmallestViewportDimension = Math.min(ViewportWidth, ViewportHeight);
  return SmallestViewportDimension <= 640
    ? DefaultAdaptivePixelRatioCap
    : MaximumAdaptivePixelRatioCap;
}

/**
 * Advances render quality using short samples. Slow samples reduce fill rate
 * and expensive look immediately; four clearly smooth samples restore one step
 * to avoid oscillation.
 */
export function advanceAdaptivePixelRatio(
  { cap, smoothSamples = 0 },
  {
    averageFrameSeconds,
    deviceCap,
    isVisible = true,
  },
) {
  const SafeDeviceCap = Number.isFinite(deviceCap)
    ? Math.max(MinimumAdaptivePixelRatio, deviceCap)
    : MinimumAdaptivePixelRatio;
  const SafeCap = Number.isFinite(cap)
    ? Math.min(SafeDeviceCap, Math.max(MinimumAdaptivePixelRatio, cap))
    : SafeDeviceCap;
  const SafeSmoothSamples = Number.isInteger(smoothSamples) && smoothSamples > 0
    ? smoothSamples
    : 0;

  if (!isVisible || !Number.isFinite(averageFrameSeconds) || averageFrameSeconds <= 0) {
    return { cap: SafeCap, smoothSamples: 0, action: 'steady' };
  }

  if (averageFrameSeconds > SlowFrameThresholdSeconds) {
    const NextCap = Math.max(MinimumAdaptivePixelRatio, SafeCap - AdaptivePixelRatioStep);
    return {
      cap: NextCap,
      smoothSamples: 0,
      action: NextCap < SafeCap ? 'degraded' : 'minimum',
    };
  }

  if (
    averageFrameSeconds < SmoothFrameThresholdSeconds
    && SafeCap < SafeDeviceCap
  ) {
    const NextSmoothSamples = SafeSmoothSamples + 1;
    if (NextSmoothSamples >= SmoothSamplesBeforeUpgrade) {
      return {
        cap: Math.min(SafeDeviceCap, SafeCap + AdaptivePixelRatioStep),
        smoothSamples: 0,
        action: 'restored',
      };
    }
    return { cap: SafeCap, smoothSamples: NextSmoothSamples, action: 'recovering' };
  }

  return { cap: SafeCap, smoothSamples: 0, action: 'steady' };
}
