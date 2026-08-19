/**
 * Shared ranked-simulation constants.
 *
 * Live flight, trajectory prediction and replay validation must use these values
 * so a later extraction cannot silently fork the physics identity.
 */

export const FixedPhysicsStepHertz = 120;
export const FixedPhysicsStepSeconds = 1 / FixedPhysicsStepHertz;
export const RunnerRadius = 0.46;
export const SurfaceRestLift = 0.03;
export const LaunchClearancePadding = 2.4;
/** 0.8 s at 120 Hz. Tiny outer wells clear a 1.2 pad and get recaptured on the way out. */
export const LaunchIgnoreMinSteps = 96;

/** True once the Runner has both left the dock height and spent the launch grace. */
export function hasClearedLaunchOrigin({
  originRadius,
  originX,
  originY,
  originZ = 0,
  runnerX,
  runnerY,
  runnerZ = 0,
  seedRadius = RunnerRadius,
  elapsedSteps = 0,
} = {}) {
  if (!(elapsedSteps >= LaunchIgnoreMinSteps)) {
    return false;
  }
  if (!(originRadius > 0) || !(seedRadius > 0)) {
    return true;
  }
  const ClearDistance = originRadius + seedRadius + LaunchClearancePadding;
  const OffsetX = runnerX - originX;
  const OffsetY = runnerY - originY;
  const OffsetZ = runnerZ - originZ;
  return ((OffsetX * OffsetX) + (OffsetY * OffsetY) + (OffsetZ * OffsetZ))
    > (ClearDistance * ClearDistance);
}
export const StardustPickupRadius = 0.22;
export const StardustCollectionRadius = RunnerRadius + StardustPickupRadius;
export const StardustCollectionRadiusSquared = StardustCollectionRadius ** 2;
export const SurfaceOriginTolerance = 0.015;
export const DefaultLiberationValue = 1000;
export const MaximumValidatedFlightSteps = 15000;

/**
 * Relay-port precision landing bonuses. A landing inside the authored port arc
 * liberates the world; the inner third of the arc grades BULLSEYE.
 */
export const RelayPortBullseyeBonus = 500;
export const RelayPortCleanBonus = 200;
export const RelayPortBullseyeFraction = 1 / 3;

/**
 * Walking near an authored crust discovery banks this value once. Live play
 * only; ranked flight simulation never samples discoveries.
 */
export const DiscoveryScoreValue = 200;
export const DiscoveryCollectRadiusRadians = 0.36;
