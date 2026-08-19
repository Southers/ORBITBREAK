import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DefaultClampOffsetsRadians,
  LeftoverClampOffsetsRadians,
  createHostileEncounterState,
  getCutEndPoint,
  getCutHits,
  getCutMaxLength,
  getHostileEncounterAngularDistance,
  getHostileEncounterMoveDirection,
  getLeftoverHostileEncounter,
  getNearestClampCut,
  getNearestRemainingClamp,
  getPointToSegmentDistance,
  getRemainingClamps,
  resolveClampTap,
  resolveHostileCut,
} from '../src/encounter.js';

const BastionWorld = { position: { x: 0, y: 0, z: 0 }, radius: 2.8 };

test('clamps sit a short walk ahead of the landing, not stacked on one button', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
  });
  assert.equal(State.clamps.length, 3);
  assert.ok(State.clamps[0].surfaceAngle > 1.2);
  assert.ok(State.clamps[2].surfaceAngle - State.clamps[0].surfaceAngle > 0.7);
  assert.equal(getRemainingClamps(State).length, 3);
  assert.equal(getNearestRemainingClamp(State, 0).id, 0);
  assert.equal(getHostileEncounterMoveDirection(State, 0), 1);
  assert.ok(getHostileEncounterAngularDistance(State, 0) > 0.3);
});

test('surface guidance chooses the shortest signed path across the angle seam', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'command',
    runnerSurfaceAngle: Math.PI - 0.1,
    clampOffsetsRadians: [0.2],
  });
  assert.equal(getHostileEncounterMoveDirection(State, Math.PI - 0.1), 1);
  assert.equal(getHostileEncounterMoveDirection(State, -Math.PI + 0.2), -1);
  assert.equal(
    getHostileEncounterMoveDirection(State, State.clamps[0].surfaceAngle),
    0,
  );
});

test('a drag through one clamp shears only that clamp', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [0.4, 0.85, 1.3],
  });
  const Origin = { x: BastionWorld.radius + 0.49, y: 0 };
  const FirstClampAngle = State.clamps[0].surfaceAngle;
  const Pointer = {
    x: Math.cos(FirstClampAngle) * (BastionWorld.radius + 0.3),
    y: Math.sin(FirstClampAngle) * (BastionWorld.radius + 0.3),
  };
  const End = getCutEndPoint(Origin, Pointer, State.maxCutLength);
  const Hits = getCutHits(State, Origin, End, BastionWorld);
  assert.deepEqual(Hits.map((Hit) => Hit.id), [0]);
  const Resolved = resolveHostileCut(State, Origin, End, BastionWorld);
  assert.equal(Resolved.state.completed, false);
  assert.equal(getRemainingClamps(Resolved.state).length, 2);
  assert.equal(Resolved.state.clamps[0].remaining, false);
  assert.equal(Resolved.state.clamps[1].remaining, true);
});

test('a longer chord can take two clamps at once', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [0.35, 0.7, 1.4],
    maxCutLength: 3.4,
  });
  const Origin = {
    x: Math.cos(0.15) * (BastionWorld.radius + 0.49),
    y: Math.sin(0.15) * (BastionWorld.radius + 0.49),
  };
  const FarPointer = {
    x: Math.cos(0.9) * (BastionWorld.radius + 0.3),
    y: Math.sin(0.9) * (BastionWorld.radius + 0.3),
  };
  const End = getCutEndPoint(Origin, FarPointer, State.maxCutLength);
  const Resolved = resolveHostileCut(State, Origin, End, BastionWorld);
  assert.ok(Resolved.hitIds.length >= 2);
  assert.equal(Resolved.state.completed, false);
});

test('a miss does not spend the encounter or a launch', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
  });
  const Origin = { x: BastionWorld.radius + 0.49, y: 0 };
  const End = { x: Origin.x + 1.4, y: Origin.y - 1.4 };
  const Resolved = resolveHostileCut(State, Origin, End, BastionWorld);
  assert.equal(Resolved.state, State);
  assert.deepEqual(Resolved.hitIds, []);
});

test('Space toward the nearest clamp only hits if the ship can reach it', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [1.3],
    maxCutLength: 1.2,
  });
  const Origin = { x: BastionWorld.radius + 0.49, y: 0 };
  const AutoCut = getNearestClampCut(State, Origin, BastionWorld, 0);
  assert.ok(AutoCut);
  assert.equal(AutoCut.hits.length, 0);
  const CloseState = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0.35,
    clampOffsetsRadians: [0.08],
    maxCutLength: 1.2,
  });
  const CloseOrigin = {
    x: Math.cos(0.35) * (BastionWorld.radius + 0.49),
    y: Math.sin(0.35) * (BastionWorld.radius + 0.49),
  };
  const CloseCut = getNearestClampCut(CloseState, CloseOrigin, BastionWorld, 0.35);
  assert.equal(CloseCut.hits.length, 1);
});

test('cutting the last clamp completes the encounter', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'bastion',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [0.2],
  });
  const Origin = { x: BastionWorld.radius + 0.49, y: 0 };
  const Pointer = {
    x: Math.cos(State.clamps[0].surfaceAngle) * (BastionWorld.radius + 0.3),
    y: Math.sin(State.clamps[0].surfaceAngle) * (BastionWorld.radius + 0.3),
  };
  const End = getCutEndPoint(Origin, Pointer, State.maxCutLength);
  const Resolved = resolveHostileCut(State, Origin, End, BastionWorld);
  assert.equal(Resolved.state.completed, true);
  assert.equal(getRemainingClamps(Resolved.state).length, 0);
});

test('point-to-segment distance is zero on the line and positive off it', () => {
  assert.ok(getPointToSegmentDistance(
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ) < 1e-12);
  assert.ok(Math.abs(getPointToSegmentDistance(
    { x: 1, y: 1 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ) - 1) < 1e-12);
});

test('a drag from the disc centre still reaches an equatorial clamp', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'tide',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [0.55],
  });
  const Origin = { x: BastionWorld.position.x, y: BastionWorld.position.y };
  const Pointer = {
    x: Math.cos(State.clamps[0].surfaceAngle) * (BastionWorld.radius + 0.3),
    y: Math.sin(State.clamps[0].surfaceAngle) * (BastionWorld.radius + 0.3),
  };
  const End = getCutEndPoint(
    Origin,
    Pointer,
    getCutMaxLength(BastionWorld, State.maxCutLength),
  );
  assert.ok(getCutMaxLength(BastionWorld, State.maxCutLength) > BastionWorld.radius);
  const Hits = getCutHits(State, Origin, End, BastionWorld);
  assert.deepEqual(Hits.map((Hit) => Hit.id), [0]);
});

test('leftover Destroy is a single cage, not a Bastion cage', () => {
  const Leftover = getLeftoverHostileEncounter();
  const State = createHostileEncounterState({
    worldIdentifier: 'ember',
    runnerSurfaceAngle: 0,
    ...Leftover,
  });
  assert.equal(State.clamps.length, 1);
  assert.equal(Leftover.clampOffsetsRadians.length, 1);
  assert.equal(Leftover.clampOffsetsRadians[0], 1.5);
  assert.equal(DefaultClampOffsetsRadians[0], 1.5);
  assert.ok(LeftoverClampOffsetsRadians[0] >= 1.5);
});

test('tapping a cage shears only that clamp and a miss spends nothing', () => {
  const State = createHostileEncounterState({
    worldIdentifier: 'ember',
    runnerSurfaceAngle: 0,
    clampOffsetsRadians: [0.55],
  });
  const Miss = resolveClampTap(State, 4);
  assert.equal(Miss.state, State);
  assert.deepEqual(Miss.hitIds, []);
  const Hit = resolveClampTap(State, 0);
  assert.equal(Hit.state.completed, true);
  assert.deepEqual(Hit.hitIds, [0]);
  assert.equal(getRemainingClamps(Hit.state).length, 0);
});
