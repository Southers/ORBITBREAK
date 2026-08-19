/**
 * Authored-sector liveness helpers.
 *
 * Cluster membership lives on each system definition so ranked simulation never
 * imports presentation, and archived arenas can reveal the Warden on their own map.
 */

function requireIdentifierList(Identifiers, Label) {
  if (!Array.isArray(Identifiers)) {
    throw new Error(`${Label} requires an identifier list.`);
  }
  return Identifiers;
}

function toLiveSet(liveWorldIdentifiers) {
  if (!Array.isArray(liveWorldIdentifiers)) {
    throw new Error('Sector liveness requires live world identifiers.');
  }
  return new Set(liveWorldIdentifiers);
}

/** True when every inner-cluster world currently holds a live relay. */
export function isInnerClusterLive(
  liveWorldIdentifiers = [],
  innerClusterWorldIdentifiers = [],
) {
  const Live = toLiveSet(liveWorldIdentifiers);
  const InnerCluster = requireIdentifierList(
    innerClusterWorldIdentifiers,
    'Inner cluster check',
  );
  return InnerCluster.length > 0
    && InnerCluster.every((WorldIdentifier) => Live.has(WorldIdentifier));
}

/** True when any authored further-reach world currently holds a live relay. */
export function isFurtherReachLive(
  liveWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
) {
  const Live = toLiveSet(liveWorldIdentifiers);
  const FurtherReach = requireIdentifierList(
    furtherReachWorldIdentifiers,
    'Further reach check',
  );
  return FurtherReach.some((WorldIdentifier) => Live.has(WorldIdentifier));
}

/**
 * True once the Runner has a live relay beyond the inner neighbourhood.
 * Outposts such as Ledge, Cinder and Glasswing count even when they are not
 * on the authored veil list.
 */
export function hasTravelledFurther(
  liveWorldIdentifiers = [],
  innerClusterWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
  commandWorldIdentifier = 'worldheart',
) {
  if (isFurtherReachLive(liveWorldIdentifiers, furtherReachWorldIdentifiers)) {
    return true;
  }
  const InnerCluster = new Set(requireIdentifierList(
    innerClusterWorldIdentifiers,
    'Further travel check',
  ));
  return [...toLiveSet(liveWorldIdentifiers)].some((WorldIdentifier) => (
    WorldIdentifier !== commandWorldIdentifier
    && !InnerCluster.has(WorldIdentifier)
  ));
}

/**
 * Command becomes reachable after two inner worlds are live and the Runner has
 * travelled further, after the full neighbourhood plus further travel, or after
 * the authored restoration and shield gates. Cage smash or inner restores alone
 * do not open it. Circuits still expose and weaken the Warden vessel.
 *
 * A 6-world outer tour that left the neighbourhood still opens Command even if
 * the Warden has already silenced one inner world.
 */
export function shouldOpenCommandWorldRoute({
  restorationUnlocked = false,
  liveWorldIdentifiers = [],
  innerClusterWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
  requiresShieldBreaks = false,
  wardenStatus = 'hidden',
  commandWorldIdentifier = 'worldheart',
  currentWorldIdentifier = '',
} = {}) {
  const ShieldOpened = requiresShieldBreaks !== true || wardenStatus === 'exposed';
  if (restorationUnlocked === true && ShieldOpened) {
    return true;
  }
  const LiveIdentifiers = Array.isArray(liveWorldIdentifiers)
    ? liveWorldIdentifiers
    : [];
  const InnerCluster = requireIdentifierList(
    innerClusterWorldIdentifiers,
    'Inner cluster check',
  );
  const InnerSet = new Set(InnerCluster);
  const TravelledFurther = hasTravelledFurther(
    LiveIdentifiers,
    InnerCluster,
    furtherReachWorldIdentifiers,
    commandWorldIdentifier,
  );
  if (isInnerClusterLive(LiveIdentifiers, InnerCluster) && TravelledFurther) {
    return true;
  }
  const InnerLiveCount = LiveIdentifiers.filter(
    (WorldIdentifier) => InnerSet.has(WorldIdentifier),
  ).length;
  if (InnerLiveCount >= 2 && TravelledFurther) {
    return true;
  }
  const OuterLiveCount = LiveIdentifiers.filter((WorldIdentifier) => (
    WorldIdentifier !== commandWorldIdentifier
    && !InnerSet.has(WorldIdentifier)
  )).length;
  const CurrentIsOuter = typeof currentWorldIdentifier === 'string'
    && currentWorldIdentifier.length > 0
    && currentWorldIdentifier !== commandWorldIdentifier
    && !InnerSet.has(currentWorldIdentifier);
  if (InnerLiveCount >= 2 && CurrentIsOuter && LiveIdentifiers.length >= 5) {
    return true;
  }
  return InnerLiveCount >= 2
    && OuterLiveCount >= 2
    && LiveIdentifiers.length >= 6;
}

/** Full veil over Command and the further Reach until the inner cluster is live. */
export function getRangeVeilStrength(
  worldIdentifier,
  innerClusterLive,
  {
    furtherReachWorldIdentifiers = [],
    commandWorldIdentifier = 'worldheart',
    hasTravelledFurther = false,
  } = {},
) {
  if (typeof worldIdentifier !== 'string' || worldIdentifier.length < 1) {
    throw new Error('Range veil requires a world identifier.');
  }
  if (typeof innerClusterLive !== 'boolean') {
    throw new Error('Range veil requires an inner-cluster flag.');
  }
  if (innerClusterLive) {
    return 0;
  }
  const FurtherReach = requireIdentifierList(
    furtherReachWorldIdentifiers,
    'Range veil',
  );
  if (
    worldIdentifier === commandWorldIdentifier
    || FurtherReach.includes(worldIdentifier)
  ) {
    return hasTravelledFurther === true ? 0.42 : 1;
  }
  return 0;
}

/** Reveal once the neighbourhood is alive and the Runner has landed further. */
export function getSectorWardenRevealFlag(
  liveWorldIdentifiers,
  innerClusterWorldIdentifiers,
  furtherReachWorldIdentifiers,
  commandWorldIdentifier = 'worldheart',
) {
  return isInnerClusterLive(liveWorldIdentifiers, innerClusterWorldIdentifiers)
    && hasTravelledFurther(
      liveWorldIdentifiers,
      innerClusterWorldIdentifiers,
      furtherReachWorldIdentifiers,
      commandWorldIdentifier,
    );
}
