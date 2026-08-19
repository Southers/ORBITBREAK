/**
 * Authored crust discoveries. Presentation-only: walking near a landmark banks
 * once with a quiet toast. Ranked flight simulation never samples this file.
 */

import { DiscoveryCollectRadiusRadians, DiscoveryScoreValue } from './sim-constants.js?v=20260819-ob134';

function site(id, name, longitude, latitude) {
  return { id, name, longitude, latitude };
}

/**
 * Small authored sets on inhabited worlds. Coordinates match occupation sites
 * and crust landmarks already on the globe; shards stay empty.
 */
const DiscoveriesByWorldId = {
  meadow: [
    site('garden-relay', 'garden relay', -0.34, 0.16),
    site('rain-pond', 'rain pond', 2.11, -0.35),
    site('far-cottage', 'far cottage', 2.8, -0.42),
    site('polar-garden', 'polar garden', 1.2, 0.92),
  ],
  ember: [
    site('caldera-forge', 'caldera forge', 0.39, 0.62),
    site('lava-pool', 'lava pool', -1.38, -0.43),
    site('basalt-camp', 'basalt camp', -1.85, -0.48),
    site('polar-vent', 'polar vent', 1.5, 0.94),
  ],
  grove: [
    site('root-arch', 'root arch', -2.57, 0.18),
    site('moss-hollow', 'moss hollow', 0.62, -0.44),
    site('far-sapling', 'far sapling', -0.9, 0.88),
    site('joined-roots', 'joined roots', 2.4, 0.22),
  ],
  frost: [
    site('ice-arch', 'ice arch', -0.26, 0.74),
    site('frozen-lake', 'frozen lake', -2.08, 0.18),
    site('crystal-camp', 'crystal camp', -1.9, -0.42),
    site('polar-floe', 'polar floe', -1.72, 0.88),
  ],
  tide: [
    site('harbour-jetty', 'harbour jetty', 1.18, 0.18),
    site('wave-camp', 'wave camp', 1.37, -0.42),
    site('salt-pool', 'salt pool', 1.56, 0.88),
    site('far-dock', 'far dock', 1.75, -0.28),
  ],
  bastion: [
    site('watch-yard', 'watch yard', 0.08, 0.18),
    site('memory-rib', 'memory rib', 0.28, -0.42),
    site('polar-battery', 'polar battery', 0.48, 0.88),
    site('courier-gate', 'courier gate', 2.6, 0.2),
  ],
  spindle: [
    site('loom-arch', 'loom arch', 2.05, 0.18),
    site('route-bridge', 'route bridge', 2.28, -0.42),
    site('polar-spindle', 'polar spindle', 2.51, 0.88),
  ],
  quarry: [
    site('pit-kiln', 'pit kiln', -1.15, 0.18),
    site('ore-camp', 'ore camp', -0.92, -0.42),
    site('polar-stack', 'polar stack', -0.69, 0.88),
  ],
  mirage: [
    site('glass-crown', 'glass crown', 0.72, 0.18),
    site('mirror-camp', 'mirror camp', 0.94, -0.42),
    site('polar-shard', 'polar shard', 1.16, 0.88),
  ],
  relay: [
    site('signal-ring', 'signal ring', 0.07, 0.16),
    site('far-relay', 'far relay', 3.14, -0.42),
    site('polar-beacon', 'polar beacon', 1.2, 0.92),
  ],
  kiln: [
    site('exhaust-crown', 'exhaust crown', 2.8, 0.14),
    site('foundry-camp', 'foundry camp', 0.9, 0.22),
    site('polar-vent', 'polar vent', 1.5, 0.94),
  ],
  loom: [
    site('woven-arch', 'woven arch', -2.2, 0.18),
    site('far-loom', 'far loom', 0.62, -0.44),
    site('polar-thread', 'polar thread', -0.9, 0.88),
  ],
  shard: [
    site('crystal-crown', 'crystal crown', 0.72, 0.18),
    site('glass-camp', 'glass camp', 0.94, -0.42),
    site('polar-facet', 'polar facet', 1.16, 0.88),
  ],
  drift: [
    site('tide-arch', 'tide arch', 1.18, 0.18),
    site('salt-camp', 'salt camp', 1.37, -0.42),
    site('polar-reef', 'polar reef', 1.56, 0.88),
  ],
  vault: [
    site('memory-rib', 'memory rib', 0.08, 0.18),
    site('watch-yard', 'watch yard', 0.28, -0.42),
    site('polar-vault', 'polar vault', 0.48, 0.88),
  ],
  bower: [
    site('shelter-arch', 'shelter arch', 0.07, 0.16),
    site('lamp-camp', 'lamp camp', 3.14, -0.42),
    site('polar-bower', 'polar bower', 1.2, 0.92),
  ],
  lantern: [
    site('flower-lamp', 'flower lamp', 2.8, 0.14),
    site('glow-camp', 'glow camp', 0.9, 0.22),
    site('polar-lantern', 'polar lantern', 1.5, 0.94),
  ],
  canopy: [
    site('treetop-hall', 'treetop hall', -2.2, 0.18),
    site('root-camp', 'root camp', 0.62, -0.44),
    site('polar-crown', 'polar crown', -0.9, 0.88),
  ],
  crown: [
    site('petal-ring', 'petal ring', -0.58, 0.3),
    site('bloom-camp', 'bloom camp', 0.42, -0.38),
    site('polar-blossom', 'polar blossom', 0.08, 0.88),
  ],
  dew: [
    site('drop-arch', 'drop arch', -0.5, 0.4),
    site('mist-camp', 'mist camp', 0.5, -0.28),
    site('polar-dew', 'polar dew', -0.12, 0.88),
  ],
  nest: [
    site('woven-rib', 'woven rib', 0.08, 0.18),
    site('rest-camp', 'rest camp', 0.28, -0.42),
    site('polar-nest', 'polar nest', 0.48, 0.88),
  ],
  vigil: [
    site('watchtower', 'watchtower', -0.56, 0.3),
    site('flame-camp', 'flame camp', 0.58, -0.12),
    site('polar-vigil', 'polar vigil', 0.08, 0.88),
  ],
  pyre: [
    site('flame-crown', 'flame crown', -0.12, 0.66),
    site('ash-camp', 'ash camp', 0.3, -0.42),
    site('polar-pyre', 'polar pyre', -0.3, 0.88),
  ],
  hollow: [
    site('bell-arch', 'bell arch', 0, 0.18),
    site('quiet-camp', 'quiet camp', 1.57, -0.42),
    site('polar-hollow', 'polar hollow', 3.14, 0.88),
  ],
  beacon: [
    site('star-fin', 'star fin', -0.32, 0.58),
    site('ray-camp', 'ray camp', 0.34, -0.48),
    site('polar-beacon', 'polar beacon', -0.1, 0.88),
  ],
  umbra: [
    site('crescent-rib', 'crescent rib', 0, 0.18),
    site('shade-camp', 'shade camp', 2.09, -0.42),
    site('polar-umbra', 'polar umbra', 4.19, 0.88),
  ],
  lumen: [
    site('star-prism', 'star prism', -0.42, 0.34),
    site('halo-camp', 'halo camp', 0, -0.42),
    site('polar-lumen', 'polar lumen', 0.38, 0.88),
  ],
  confluence: [
    site('route-arch', 'route arch', 0, 0.18),
    site('braid-camp', 'braid camp', 1.57, -0.42),
    site('polar-confluence', 'polar confluence', 3.14, 0.88),
  ],
  kindle: [
    site('flame-ring', 'flame ring', 0, 0.66),
    site('ember-camp', 'ember camp', 0.38, -0.38),
    site('polar-kindle', 'polar kindle', -0.38, 0.88),
  ],
  memory: [
    site('shared-arch', 'shared arch', 0, 0.18),
    site('leaf-camp', 'leaf camp', 1.57, -0.42),
    site('polar-memory', 'polar memory', 3.14, 0.88),
  ],
  starwell: [
    site('route-ring', 'route ring', -0.55, 0.42),
    site('fin-camp', 'fin camp', 0.45, -0.38),
    site('polar-starwell', 'polar starwell', 0, 0.88),
  ],
  dawn: [
    site('dawn-petal', 'dawn petal', -0.2, 0.64),
    site('ray-camp', 'ray camp', 0.34, -0.44),
    site('polar-dawn', 'polar dawn', -0.28, 0.88),
  ],
  chorus: [
    site('prism-halo', 'prism halo', -0.4, 0.32),
    site('chord-camp', 'chord camp', 0, -0.42),
    site('polar-chorus', 'polar chorus', 0.38, 0.88),
  ],
};

function createDiscoveryState() {
  return {
    collectedIds: new Set(),
    pendingToast: null,
    pendingBank: [],
  };
}

let LiveDiscoveryState = createDiscoveryState();

export function getLiveDiscoveryState() {
  return LiveDiscoveryState;
}

export function resetLiveDiscoveryState() {
  LiveDiscoveryState = createDiscoveryState();
  return LiveDiscoveryState;
}

export function listWorldDiscoveries(worldId) {
  if (typeof worldId !== 'string' || worldId.length === 0) {
    return [];
  }
  const Discoveries = DiscoveriesByWorldId[worldId];
  return Discoveries ? Discoveries.map((Discovery) => ({ ...Discovery })) : [];
}

export function listDiscoveryWorldIdentifiers() {
  return Object.keys(DiscoveriesByWorldId);
}

export function getDiscoveryCollectKey(worldId, discoveryId) {
  return `${worldId}:${discoveryId}`;
}

export function formatWorldDisplayName(worldLabel) {
  const Label = typeof worldLabel === 'string' ? worldLabel.trim() : '';
  if (Label.length === 0) {
    return 'World';
  }
  return Label
    .toLowerCase()
    .split(/\s+/)
    .map((Word) => Word.charAt(0).toUpperCase() + Word.slice(1))
    .join(' ');
}

export function formatDiscoveryToast({
  worldLabel,
  foundCount,
  totalCount,
  name,
} = {}) {
  return `${formatWorldDisplayName(worldLabel)} ${foundCount}/${totalCount} · ${name}`;
}

export function getSurfaceDirection(longitude, latitude) {
  const CosLatitude = Math.cos(latitude);
  return {
    x: CosLatitude * Math.cos(longitude),
    y: CosLatitude * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

export function getAngularDistanceRadians(
  originX,
  originY,
  originZ,
  targetX,
  targetY,
  targetZ,
) {
  const OriginLength = Math.hypot(originX, originY, originZ);
  const TargetLength = Math.hypot(targetX, targetY, targetZ);
  if (OriginLength <= 1e-8 || TargetLength <= 1e-8) {
    return Math.PI;
  }
  const Dot = (
    ((originX / OriginLength) * (targetX / TargetLength))
    + ((originY / OriginLength) * (targetY / TargetLength))
    + ((originZ / OriginLength) * (targetZ / TargetLength))
  );
  return Math.acos(Math.min(1, Math.max(-1, Dot)));
}

export function findNearbyDiscovery({
  worldId,
  runnerX,
  runnerY,
  runnerZ,
  worldX,
  worldY,
  worldZ,
  collectedIds = new Set(),
  collectRadiusRadians = DiscoveryCollectRadiusRadians,
} = {}) {
  const Discoveries = DiscoveriesByWorldId[worldId];
  if (!Discoveries || Discoveries.length === 0) {
    return null;
  }
  const LocalX = runnerX - worldX;
  const LocalY = runnerY - worldY;
  const LocalZ = runnerZ - worldZ;
  for (const Discovery of Discoveries) {
    const CollectKey = getDiscoveryCollectKey(worldId, Discovery.id);
    if (collectedIds.has(CollectKey)) {
      continue;
    }
    const Direction = getSurfaceDirection(Discovery.longitude, Discovery.latitude);
    const Distance = getAngularDistanceRadians(
      LocalX,
      LocalY,
      LocalZ,
      Direction.x,
      Direction.y,
      Direction.z,
    );
    if (Distance <= collectRadiusRadians) {
      return { ...Discovery, collectKey: CollectKey };
    }
  }
  return null;
}

export function collectDiscovery(State, {
  worldId,
  worldLabel,
  discovery,
  points = DiscoveryScoreValue,
} = {}) {
  if (!State || !discovery?.collectKey) {
    return null;
  }
  if (State.collectedIds.has(discovery.collectKey)) {
    return null;
  }
  State.collectedIds.add(discovery.collectKey);
  const WorldDiscoveries = listWorldDiscoveries(worldId);
  const FoundCount = WorldDiscoveries.filter((Entry) => (
    State.collectedIds.has(getDiscoveryCollectKey(worldId, Entry.id))
  )).length;
  const Event = {
    worldId,
    discoveryId: discovery.id,
    collectKey: discovery.collectKey,
    name: discovery.name,
    points,
    foundCount: FoundCount,
    totalCount: WorldDiscoveries.length,
    toast: formatDiscoveryToast({
      worldLabel,
      foundCount: FoundCount,
      totalCount: WorldDiscoveries.length,
      name: discovery.name,
    }),
  };
  State.pendingToast = Event.toast;
  State.pendingBank.push(Event);
  return Event;
}

export function sampleLiveDiscoveries({
  gamePhase,
  worldId,
  worldLabel,
  runnerX,
  runnerY,
  runnerZ,
  worldX,
  worldY,
  worldZ,
} = {}) {
  if (gamePhase !== 'attached' && gamePhase !== 'restoring') {
    return null;
  }
  const Nearby = findNearbyDiscovery({
    worldId,
    runnerX,
    runnerY,
    runnerZ,
    worldX,
    worldY,
    worldZ,
    collectedIds: LiveDiscoveryState.collectedIds,
  });
  if (!Nearby) {
    return null;
  }
  return collectDiscovery(LiveDiscoveryState, {
    worldId,
    worldLabel,
    discovery: Nearby,
  });
}

export function consumePendingDiscoveryBank() {
  const Pending = LiveDiscoveryState.pendingBank;
  LiveDiscoveryState.pendingBank = [];
  return Pending;
}

export function consumePendingDiscoveryToast() {
  const Toast = LiveDiscoveryState.pendingToast;
  LiveDiscoveryState.pendingToast = null;
  return Toast;
}

export function getWorldDiscoveryProgress(worldId, collectedIds = LiveDiscoveryState.collectedIds) {
  const Discoveries = listWorldDiscoveries(worldId);
  if (Discoveries.length === 0) {
    return { foundCount: 0, totalCount: 0 };
  }
  const FoundCount = Discoveries.filter((Discovery) => (
    collectedIds.has(getDiscoveryCollectKey(worldId, Discovery.id))
  )).length;
  return { foundCount: FoundCount, totalCount: Discoveries.length };
}

export function isDiscoveryCollected(worldId, discoveryId, collectedIds = LiveDiscoveryState.collectedIds) {
  return collectedIds.has(getDiscoveryCollectKey(worldId, discoveryId));
}

export { DiscoveryCollectRadiusRadians, DiscoveryScoreValue };
