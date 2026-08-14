/**
 * Framework-free helpers for WORLDSEED's planet restoration wave.
 *
 * The render layer and prop animation both consume the same normalized spherical
 * distance convention: 0 is the impact point, 0.5 is the planet horizon and 1 is
 * the antipode. Keeping this math outside Three.js makes the signature effect
 * deterministic and testable.
 */

/**
 * Returns the normalized great-circle distance between two unit directions.
 *
 * @param {{x:number,y:number,z:number}} FirstDirection - First surface direction.
 * @param {{x:number,y:number,z:number}} SecondDirection - Second surface direction.
 * @returns {number} Great-circle distance divided by PI, in the range 0..1.
 */
export function calculateNormalizedSphericalDistance(FirstDirection, SecondDirection) {
  const FirstLength = Math.hypot(FirstDirection.x, FirstDirection.y, FirstDirection.z);
  const SecondLength = Math.hypot(SecondDirection.x, SecondDirection.y, SecondDirection.z);

  if (FirstLength < 0.000001 || SecondLength < 0.000001) {
    return 0;
  }

  const NormalizedDotProduct = (
    (FirstDirection.x * SecondDirection.x)
    + (FirstDirection.y * SecondDirection.y)
    + (FirstDirection.z * SecondDirection.z)
  ) / (FirstLength * SecondLength);
  const ClampedDotProduct = Math.max(-1, Math.min(1, NormalizedDotProduct));

  return Math.acos(ClampedDotProduct) / Math.PI;
}

/**
 * Applies a smooth acceleration/deceleration curve to raw restoration time.
 *
 * @param {number} LinearProgress - Raw progress in the range 0..1.
 * @returns {number} Smoothed wave position in the range 0..1.
 */
export function calculateRestorationWaveProgress(LinearProgress) {
  const ClampedProgress = Math.max(0, Math.min(1, LinearProgress));
  return ClampedProgress * ClampedProgress * (3 - (2 * ClampedProgress));
}

/**
 * Calculates how much a surface prop has grown after the wave passes it.
 *
 * @param {number} WaveProgress - Current normalized wave position.
 * @param {number} SurfaceDistance - Prop distance from the impact point.
 * @param {number} GrowthTrailWidth - Distance behind the wave used for growth.
 * @returns {number} Smoothed growth progress in the range 0..1.
 */
export function calculateStagedGrowthProgress(
  WaveProgress,
  SurfaceDistance,
  GrowthTrailWidth = 0.16,
) {
  const SafeTrailWidth = Math.max(GrowthTrailWidth, 0.000001);
  const LinearGrowth = Math.max(
    0,
    Math.min(1, (WaveProgress - SurfaceDistance) / SafeTrailWidth),
  );

  return 1 - Math.pow(1 - LinearGrowth, 3);
}
