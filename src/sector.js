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

/**
 * Command becomes reachable after a living neighbourhood plus further travel,
 * or after the authored restoration and shield gates. Cage smash alone does not
 * open it. Circuits still expose and weaken the Warden vessel.
 */
export function shouldOpenCommandWorldRoute({
  restorationUnlocked = false,
  liveWorldIdentifiers = [],
  innerClusterWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
  requiresShieldBreaks = false,
  wardenStatus = 'hidden',
} = {}) {
  const ShieldOpened = requiresShieldBreaks !== true || wardenStatus === 'exposed';
  if (restorationUnlocked === true && ShieldOpened) {
    return true;
  }
  const LiveIdentifiers = Array.isArray(liveWorldIdentifiers)
    ? liveWorldIdentifiers
    : [];
  return isInnerClusterLive(LiveIdentifiers, innerClusterWorldIdentifiers)
    && isFurtherReachLive(LiveIdentifiers, furtherReachWorldIdentifiers)
    && LiveIdentifiers.length >= 4;
}

/** True when any further-reach world currently holds a live relay. */
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

/** Full veil over Command and the further Reach until the inner cluster is live. */
export function getRangeVeilStrength(
  worldIdentifier,
  innerClusterLive,
  {
    furtherReachWorldIdentifiers = [],
    commandWorldIdentifier = 'worldheart',
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
    return 1;
  }
  return 0;
}

/** Reveal once the neighbourhood is alive and the Runner has landed further. */
export function getSectorWardenRevealFlag(
  liveWorldIdentifiers,
  innerClusterWorldIdentifiers,
  furtherReachWorldIdentifiers,
) {
  return isInnerClusterLive(liveWorldIdentifiers, innerClusterWorldIdentifiers)
    && isFurtherReachLive(liveWorldIdentifiers, furtherReachWorldIdentifiers);
}
