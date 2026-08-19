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

export function getClampSite(ClampOrAngle) {
  if (Number.isFinite(ClampOrAngle)) {
    return { longitude: ClampOrAngle, latitude: 0 };
  }
  const Longitude = Number.isFinite(ClampOrAngle?.longitude)
    ? ClampOrAngle.longitude
    : ClampOrAngle?.surfaceAngle;
  const Latitude = Number.isFinite(ClampOrAngle?.latitude) ? ClampOrAngle.latitude : 0;
  if (!Number.isFinite(Longitude) || !Number.isFinite(Latitude)) {
    throw new Error('Clamp site requires a finite longitude and latitude.');
  }
  return { longitude: Longitude, latitude: Latitude };
}

export function getClampWorldPosition(World, ClampOrAngle) {
  const Site = getClampSite(ClampOrAngle);
  const Distance = World.radius + ClampSurfaceLift;
  const CosLatitude = Math.cos(Site.latitude);
  return {
    x: World.position.x + (CosLatitude * Math.cos(Site.longitude) * Distance),
    y: World.position.y + (CosLatitude * Math.sin(Site.longitude) * Distance),
    z: (World.position.z ?? 0) + (Math.sin(Site.latitude) * Distance),
  };
}

function clampSiteDirection(ClampOrAngle) {
  const Site = getClampSite(ClampOrAngle);
  const CosLatitude = Math.cos(Site.latitude);
  return {
    x: CosLatitude * Math.cos(Site.longitude),
    y: CosLatitude * Math.sin(Site.longitude),
    z: Math.sin(Site.latitude),
  };
}

function directionSeparationRadians(First, Second) {
  const Dot = (First.x * Second.x) + (First.y * Second.y) + (First.z * Second.z);
  return Math.acos(Math.max(-1, Math.min(1, Dot)));
}

export function createHostileEncounterState({
  worldIdentifier,
  runnerSurfaceAngle,
  clampOffsetsRadians = DefaultClampOffsetsRadians,
  cageSites = null,
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
  const Sites = Array.isArray(cageSites) && cageSites.length > 0
    ? cageSites.map((Site) => getClampSite(Site))
    : Offsets.map((Offset) => ({
      longitude: normalizeAngle(runnerSurfaceAngle + Offset),
      latitude: 0,
    }));
  return {
    worldIdentifier,
    clamps: Sites.map((Site, ClampIndex) => ({
      id: ClampIndex,
      surfaceAngle: Site.longitude,
      longitude: Site.longitude,
      latitude: Site.latitude,
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

export function getNearestRemainingClamp(State, RunnerSurfaceAngle, RunnerLatitude = 0) {
  let BestClamp = null;
  let BestDistance = Infinity;
  const RunnerDirection = clampSiteDirection({
    longitude: RunnerSurfaceAngle,
    latitude: RunnerLatitude,
  });
  for (const Clamp of getRemainingClamps(State)) {
    const Distance = directionSeparationRadians(RunnerDirection, clampSiteDirection(Clamp));
    if (Distance < BestDistance) {
      BestClamp = Clamp;
      BestDistance = Distance;
    }
  }
  return BestClamp;
}

export function getHostileEncounterAngularDistance(State, RunnerSurfaceAngle, RunnerLatitude = 0) {
  const NearestClamp = getNearestRemainingClamp(State, RunnerSurfaceAngle, RunnerLatitude);
  if (!NearestClamp) {
    return 0;
  }
  return directionSeparationRadians(
    clampSiteDirection({ longitude: RunnerSurfaceAngle, latitude: RunnerLatitude }),
    clampSiteDirection(NearestClamp),
  );
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
    const ClampPosition = getClampWorldPosition(World, Clamp);
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
  const ClampPosition = getClampWorldPosition(World, NearestClamp);
  const End = getCutEndPoint(Origin, ClampPosition, getCutMaxLength(World, State.maxCutLength));
  return {
    origin: Origin,
    end: End,
    hits: getCutHits(State, Origin, End, World),
  };
}
