const FullCircleRadians = Math.PI * 2;

export const DefaultClampOffsetsRadians = Object.freeze([1.5, 2.05, 2.6]);
export const LeftoverClampOffsetsRadians = Object.freeze([1.5]);
export const DefaultCutHitRadius = 0.48;
export const DefaultMaxCutLength = 2.85;
export const ClampSurfaceLift = 0.3;

/** Default authored cuts must still reach an equatorial clamp from the landed ship. */
export function getCutMaxLength(World, ConfiguredMax = DefaultMaxCutLength) {
  const Configured = ConfiguredMax > 0 ? ConfiguredMax : DefaultMaxCutLength;
  if (!(World?.radius > 0) || Configured < DefaultMaxCutLength - 1e-6) {
    return Configured;
  }
  return Math.max(Configured, World.radius + ClampSurfaceLift + 1.35);
}

/** Fat cages on the rim need a swipe target wider than a hairline. */
export function getCutHitRadius(World, ConfiguredRadius = DefaultCutHitRadius) {
  const Configured = ConfiguredRadius > 0 ? ConfiguredRadius : DefaultCutHitRadius;
  if (!(World?.radius > 0)) {
    return Math.max(Configured, 0.85);
  }
  return Math.max(Configured, 0.85, World.radius * 0.28);
}

/** One leftover cage: teach Destroy after the first link, or recapture after the hunt starts. */
export function getLeftoverHostileEncounter() {
  return {
    clampOffsetsRadians: LeftoverClampOffsetsRadians,
    cutHitRadius: DefaultCutHitRadius,
    maxCutLength: DefaultMaxCutLength,
  };
}

/**
 * Occupied unrestored worlds always have a tappable rim cage. Authored
 * encounters win; leftover worlds get one cage once the first links exist.
 * Starting gardens stay free. Post-liberation can opt back in.
 */
export function getOccupiedWorldCageEncounter(world, {
  leftoverUnlocked = false,
  includeRestored = false,
} = {}) {
  if (!world) {
    return null;
  }
  if (world.initiallyRestored === true) {
    return null;
  }
  if (world.restored === true && includeRestored !== true) {
    return null;
  }
  if (world.hostileEncounter) {
    return {
      ...world.hostileEncounter,
      clampOffsetsRadians: [...world.hostileEncounter.clampOffsetsRadians],
    };
  }
  if (leftoverUnlocked !== true) {
    return null;
  }
  const HasOccupation = Boolean(world.occupation)
    || (Array.isArray(world.occupationSites) && world.occupationSites.length > 0)
    || (Array.isArray(world.occupationScarAngles) && world.occupationScarAngles.length > 0);
  if (!HasOccupation) {
    return null;
  }
  return getLeftoverHostileEncounter();
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
  const HitRadius = getCutHitRadius(World, State.cutHitRadius);
  return getRemainingClamps(State).filter((Clamp) => {
    const ClampPosition = getClampWorldPosition(World, Clamp.surfaceAngle);
    return getPointToSegmentDistance(ClampPosition, Origin, End) <= HitRadius;
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

/** Tap/swipe the cage itself. Misses do not spend a launch. */
export function resolveClampTap(State, ClampId) {
  if (State.completed) {
    return { state: State, hitIds: [] };
  }
  const Target = State.clamps.find((Clamp) => Clamp.id === ClampId && Clamp.remaining);
  if (!Target) {
    return { state: State, hitIds: [] };
  }
  const NextClamps = State.clamps.map((Clamp) => (
    Clamp.id === ClampId ? { ...Clamp, remaining: false } : Clamp
  ));
  return {
    state: {
      ...State,
      clamps: NextClamps,
      completed: NextClamps.every((Clamp) => !Clamp.remaining),
    },
    hitIds: [ClampId],
  };
}

/** Keyboard/Space shortcut: a cut from the ship toward the nearest remaining clamp. */
export function getNearestClampCut(State, Origin, World, RunnerSurfaceAngle) {
  const NearestClamp = getNearestRemainingClamp(State, RunnerSurfaceAngle);
  if (!NearestClamp) return null;
  const ClampPosition = getClampWorldPosition(World, NearestClamp.surfaceAngle);
  const End = getCutEndPoint(Origin, ClampPosition, getCutMaxLength(World, State.maxCutLength));
  return {
    origin: Origin,
    end: End,
    hits: getCutHits(State, Origin, End, World),
  };
}
