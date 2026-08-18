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
export const LaunchClearancePadding = 0.35;
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
