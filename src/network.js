function assertWorldIdentifier(Value) {
  if (typeof Value !== 'string' || Value.length < 1 || Value.length > 96) {
    throw new Error('Relay world identifier is invalid.');
  }
}

export function getRelayLinkIdentifier(FirstWorldIdentifier, SecondWorldIdentifier) {
  assertWorldIdentifier(FirstWorldIdentifier);
  assertWorldIdentifier(SecondWorldIdentifier);
  if (FirstWorldIdentifier === SecondWorldIdentifier) {
    throw new Error('A relay link requires two distinct worlds.');
  }
  return [FirstWorldIdentifier, SecondWorldIdentifier].sort().join('::');
}

export function createRelayNetworkState(StartingWorldIdentifier) {
  assertWorldIdentifier(StartingWorldIdentifier);
  return {
    activeWorldIdentifiers: new Set([StartingWorldIdentifier]),
    suppressedWorldIdentifiers: new Set(),
    links: new Map(),
  };
}

/** Derives permanent relay state only from a resolved world-to-world traversal. */
export function connectRelayWorlds(
  NetworkState,
  OriginWorldIdentifier,
  DestinationWorldIdentifier,
) {
  const LinkIdentifier = getRelayLinkIdentifier(
    OriginWorldIdentifier,
    DestinationWorldIdentifier,
  );
  const DestinationActivated = !NetworkState.activeWorldIdentifiers.has(
    DestinationWorldIdentifier,
  );
  const DestinationReactivated = NetworkState.suppressedWorldIdentifiers.delete(
    DestinationWorldIdentifier,
  );
  NetworkState.activeWorldIdentifiers.add(OriginWorldIdentifier);
  NetworkState.activeWorldIdentifiers.add(DestinationWorldIdentifier);
  const ExistingLink = NetworkState.links.get(LinkIdentifier);
  if (ExistingLink) {
    return {
      created: false,
      destinationActivated: false,
      destinationReactivated: DestinationReactivated,
      link: ExistingLink,
    };
  }
  const Link = Object.freeze({
    id: LinkIdentifier,
    originWorldIdentifier: OriginWorldIdentifier,
    destinationWorldIdentifier: DestinationWorldIdentifier,
    sequenceIndex: NetworkState.links.size,
  });
  NetworkState.links.set(LinkIdentifier, Link);
  return {
    created: true,
    destinationActivated: DestinationActivated,
    destinationReactivated: DestinationReactivated,
    link: Link,
  };
}

export function listRelayLinks(NetworkState) {
  return [...NetworkState.links.values()];
}

export function isRelayWorldLive(NetworkState, WorldIdentifier) {
  return NetworkState.activeWorldIdentifiers.has(WorldIdentifier)
    && !NetworkState.suppressedWorldIdentifiers.has(WorldIdentifier);
}

export function isRelayLinkLive(NetworkState, Link) {
  return isRelayWorldLive(NetworkState, Link.originWorldIdentifier)
    && isRelayWorldLive(NetworkState, Link.destinationWorldIdentifier);
}

export function listLiveRelayLinks(NetworkState) {
  return listRelayLinks(NetworkState).filter((Link) => isRelayLinkLive(NetworkState, Link));
}

export function suppressRelayWorld(NetworkState, WorldIdentifier) {
  if (!NetworkState.activeWorldIdentifiers.has(WorldIdentifier)) return false;
  const PreviousSize = NetworkState.suppressedWorldIdentifiers.size;
  NetworkState.suppressedWorldIdentifiers.add(WorldIdentifier);
  return NetworkState.suppressedWorldIdentifiers.size !== PreviousSize;
}

export function countLiveRelayWorlds(NetworkState) {
  return [...NetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier),
  ).length;
}

export function getRelayDegree(NetworkState, WorldIdentifier) {
  return listLiveRelayLinks(NetworkState).filter((Link) => (
    Link.originWorldIdentifier === WorldIdentifier
    || Link.destinationWorldIdentifier === WorldIdentifier
  )).length;
}

export function listVulnerableRelayWorlds(NetworkState) {
  return [...NetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => getRelayDegree(NetworkState, WorldIdentifier) <= 1,
  ).filter((WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier));
}
