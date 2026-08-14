/** Extracts compact route ideas from a verified schema-v2 replay without revealing trajectories. */
export function getReplayGhostWaypoints(Replay) {
  if (
    Replay?.schemaVersion < 2
    || Replay?.outcome !== 'complete'
    || !Array.isArray(Replay?.launches)
  ) {
    return [];
  }
  const Waypoints = [];
  for (const Launch of Replay.launches) {
    if (!Number.isFinite(Launch.originX) || !Number.isFinite(Launch.originY)) continue;
    const PreviousWaypoint = Waypoints.at(-1);
    if (
      PreviousWaypoint
      && Math.hypot(
        Launch.originX - PreviousWaypoint.x,
        Launch.originY - PreviousWaypoint.y,
      ) < 0.01
    ) {
      continue;
    }
    Waypoints.push({
      x: Launch.originX,
      y: Launch.originY,
      z: 0,
      originIdentifier: Launch.originIdentifier,
    });
  }
  return Waypoints;
}
