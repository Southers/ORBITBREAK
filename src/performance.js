export const QualityPresentationTiers = Object.freeze({
  high: 'high',
  balanced: 'balanced',
  degraded: 'degraded',
});

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

export const MinimumAdaptivePixelRatio = 1;
export const AdaptivePixelRatioStep = 0.25;
export const SlowFrameThresholdSeconds = 1 / 34;
export const SmoothFrameThresholdSeconds = 1 / 52;
export const SmoothSamplesBeforeUpgrade = 4;

/** Keeps portrait/mobile fill rate bounded before live performance sampling begins. */
export function getViewportPixelRatioCap(ViewportWidth, ViewportHeight) {
  const SmallestViewportDimension = Math.min(ViewportWidth, ViewportHeight);
  return SmallestViewportDimension <= 640 ? 1.5 : 2;
}

/**
 * Advances render quality using two-second samples. Slow samples reduce fill rate
 * immediately; four clearly smooth samples restore one step to avoid oscillation.
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
