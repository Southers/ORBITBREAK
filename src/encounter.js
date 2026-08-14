const FullCircleRadians = Math.PI * 2;

function normalizeAngle(AngleRadians) {
  return ((AngleRadians + Math.PI) % FullCircleRadians + FullCircleRadians) % FullCircleRadians
    - Math.PI;
}

export function createHostileEncounterState({
  worldIdentifier,
  runnerSurfaceAngle,
  pylonOffsetRadians = Math.PI / 6,
  pulseRangeRadians = 8 * (Math.PI / 180),
}) {
  if (typeof worldIdentifier !== 'string' || worldIdentifier.length < 1) {
    throw new Error('Hostile encounter requires a world identifier.');
  }
  if (!Number.isFinite(runnerSurfaceAngle) || !(pulseRangeRadians > 0)) {
    throw new Error('Hostile encounter angles must be finite and positive.');
  }
  return {
    worldIdentifier,
    pylonSurfaceAngle: normalizeAngle(runnerSurfaceAngle + pylonOffsetRadians),
    pulseRangeRadians,
    completed: false,
  };
}

export function getHostileEncounterAngularDistance(State, RunnerSurfaceAngle) {
  return Math.abs(normalizeAngle(State.pylonSurfaceAngle - RunnerSurfaceAngle));
}

export function isHostilePulseReady(State, RunnerSurfaceAngle) {
  return !State.completed
    && getHostileEncounterAngularDistance(State, RunnerSurfaceAngle) <= State.pulseRangeRadians;
}

export function resolveHostilePulse(State, RunnerSurfaceAngle) {
  if (!isHostilePulseReady(State, RunnerSurfaceAngle)) return State;
  return { ...State, completed: true };
}
