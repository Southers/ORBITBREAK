const FullCircleRadians = Math.PI * 2;

export const DefaultClampOffsetsRadians = Object.freeze([0.4, 0.85, 1.3]);
export const LeftoverClampOffsetsRadians = Object.freeze([0.55]);
export const DefaultCutHitRadius = 0.48;
export const DefaultMaxCutLength = 2.85;
export const ClampSurfaceLift = 0.3;

/** One leftover cage: teach Destroy after the first link, or recapture after the hunt starts. */
export function getLeftoverHostileEncounter() {
  return {
    clampOffsetsRadians: LeftoverClampOffsetsRadians,
    cutHitRadius: DefaultCutHitRadius,
    maxCutLength: DefaultMaxCutLength,
  };
}

function normalizeAngle(AngleRadians) {
  return ((AngleRadians + Math.PI) % FullCircleRadians + FullCircleRadians) % FullCircleRadians
    - Math.PI;
}

export function getPointToSegmentDistance(Point, Start, End) {
  const SegmentX = End.x - Start.x;
  const SegmentY = End.y - Start.y;
  const SegmentLengthSquared = (SegmentX * SegmentX) + (SegmentY * SegmentY);
  if (SegmentLengthSquared <= 1e-12) {
    return Math.hypot(Point.x - Start.x, Point.y - Start.y);
  }
  const Projection = Math.min(
    1,
    Math.max(
      0,
      (
        ((Point.x - Start.x) * SegmentX) + ((Point.y - Start.y) * SegmentY)
      ) / SegmentLengthSquared,
    ),
  );
  return Math.hypot(
    Point.x - (Start.x + (SegmentX * Projection)),
    Point.y - (Start.y + (SegmentY * Projection)),
  );
}

/** Caps a drag from the ship so a cut stays a short lash, not a map-wide snipe. */
export function getCutEndPoint(Origin, Pointer, MaxCutLength = DefaultMaxCutLength) {
  const DeltaX = Pointer.x - Origin.x;
  const DeltaY = Pointer.y - Origin.y;
  const Distance = Math.hypot(DeltaX, DeltaY);
  if (!(Distance > 0) || !(MaxCutLength > 0)) {
    return { x: Origin.x, y: Origin.y };
  }
  const Scale = Math.min(1, MaxCutLength / Distance);
  return {
    x: Origin.x + (DeltaX * Scale),
    y: Origin.y + (DeltaY * Scale),
  };
}

export function getClampWorldPosition(World, AngleRadians) {
  const Distance = World.radius + ClampSurfaceLift;
  return {
    x: World.position.x + (Math.cos(AngleRadians) * Distance),
    y: World.position.y + (Math.sin(AngleRadians) * Distance),
  };
}

export function createHostileEncounterState({
  worldIdentifier,
  runnerSurfaceAngle,
  clampOffsetsRadians = DefaultClampOffsetsRadians,
  cutHitRadius = DefaultCutHitRadius,
  maxCutLength = DefaultMaxCutLength,
}) {
  if (typeof worldIdentifier !== 'string' || worldIdentifier.length < 1) {
    throw new Error('Hostile encounter requires a world identifier.');
  }
  if (!Number.isFinite(runnerSurfaceAngle)) {
    throw new Error('Hostile encounter angles must be finite.');
  }
  const Offsets = Array.isArray(clampOffsetsRadians) && clampOffsetsRadians.length > 0
    ? clampOffsetsRadians
    : DefaultClampOffsetsRadians;
  if (
    Offsets.some((Offset) => !Number.isFinite(Offset))
    || !(cutHitRadius > 0)
    || !(maxCutLength > 0)
  ) {
    throw new Error('Hostile encounter cuts require finite clamp offsets and positive reach.');
  }
  return {
    worldIdentifier,
    clamps: Offsets.map((Offset, ClampIndex) => ({
      id: ClampIndex,
      surfaceAngle: normalizeAngle(runnerSurfaceAngle + Offset),
      remaining: true,
    })),
    cutHitRadius,
    maxCutLength,
    completed: false,
  };
}

export function getRemainingClamps(State) {
  return State.clamps.filter((Clamp) => Clamp.remaining);
}

export function getNearestRemainingClamp(State, RunnerSurfaceAngle) {
  let BestClamp = null;
  let BestDistance = Infinity;
  for (const Clamp of getRemainingClamps(State)) {
    const Distance = Math.abs(normalizeAngle(Clamp.surfaceAngle - RunnerSurfaceAngle));
    if (Distance < BestDistance) {
      BestClamp = Clamp;
      BestDistance = Distance;
    }
  }
  return BestClamp;
}

export function getHostileEncounterAngularDistance(State, RunnerSurfaceAngle) {
  const NearestClamp = getNearestRemainingClamp(State, RunnerSurfaceAngle);
  return NearestClamp
    ? Math.abs(normalizeAngle(NearestClamp.surfaceAngle - RunnerSurfaceAngle))
    : 0;
}

/** Returns the shortest signed surface direction toward the nearest remaining clamp. */
export function getHostileEncounterMoveDirection(State, RunnerSurfaceAngle) {
  const NearestClamp = getNearestRemainingClamp(State, RunnerSurfaceAngle);
  if (!NearestClamp) return 0;
  return Math.sign(normalizeAngle(NearestClamp.surfaceAngle - RunnerSurfaceAngle));
}

export function getCutHits(State, Origin, End, World) {
  if (!World?.position || !(World.radius > 0)) return [];
  return getRemainingClamps(State).filter((Clamp) => {
    const ClampPosition = getClampWorldPosition(World, Clamp.surfaceAngle);
    return getPointToSegmentDistance(ClampPosition, Origin, End) <= State.cutHitRadius;
  });
}

export function resolveHostileCut(State, Origin, End, World) {
  if (State.completed) {
    return { state: State, hitIds: [] };
  }
  const Hits = getCutHits(State, Origin, End, World);
  if (Hits.length < 1) {
    return { state: State, hitIds: [] };
  }
  const HitIds = new Set(Hits.map((Hit) => Hit.id));
  const NextClamps = State.clamps.map((Clamp) => (
    HitIds.has(Clamp.id) ? { ...Clamp, remaining: false } : Clamp
  ));
  return {
    state: {
      ...State,
      clamps: NextClamps,
      completed: NextClamps.every((Clamp) => !Clamp.remaining),
    },
    hitIds: Hits.map((Hit) => Hit.id),
  };
}

/** Keyboard/Space shortcut: a cut from the ship toward the nearest remaining clamp. */
export function getNearestClampCut(State, Origin, World, RunnerSurfaceAngle) {
  const NearestClamp = getNearestRemainingClamp(State, RunnerSurfaceAngle);
  if (!NearestClamp) return null;
  const ClampPosition = getClampWorldPosition(World, NearestClamp.surfaceAngle);
  const End = getCutEndPoint(Origin, ClampPosition, State.maxCutLength);
  return {
    origin: Origin,
    end: End,
    hits: getCutHits(State, Origin, End, World),
  };
}
