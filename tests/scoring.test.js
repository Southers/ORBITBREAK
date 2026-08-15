import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCompletionBonus,
  addCircuitBonus,
  addVictoryBonus,
  bankFlightScore,
  createScoreState,
  getSlingshotBand,
  getSlingshotBandRadii,
  predictSlingshotEvents,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from '../src/scoring.js';

const TestBody = {
  id: 'giant',
  label: 'GIANT',
  position: { x: 0, y: 0, z: 0 },
  radius: 3,
  gravitationalParameter: 100,
  slingshotValue: 500,
};
const RunnerRadius = 0.46;

function positionAtClearance(Clearance, Y = 0) {
  return {
    x: TestBody.radius + RunnerRadius + Clearance,
    y: Y,
    z: 0,
  };
}

test('slingshot rings sit on the same clearances that score a pass', () => {
  const Band = getSlingshotBand(TestBody);
  const Radii = getSlingshotBandRadii(TestBody, RunnerRadius);
  assert.equal(Radii.assistRadius, TestBody.radius + RunnerRadius + Band.outerClearance);
  assert.equal(Radii.deepRadius, TestBody.radius + RunnerRadius + Band.deepClearance);
  assert.equal(Radii.razorRadius, TestBody.radius + RunnerRadius + Band.razorClearance);
  assert.throws(() => getSlingshotBandRadii(TestBody, 0), /runner radius/);
});

test('a slingshot scores only after entering and exiting the influence band', () => {
  const ScoreState = createScoreState();
  const Band = getSlingshotBand(TestBody);

  assert.deepEqual(sampleSlingshotBodies(
    ScoreState,
    positionAtClearance(Band.outerClearance + 0.1),
    [TestBody],
    { runnerRadius: RunnerRadius },
  ), []);
  assert.deepEqual(sampleSlingshotBodies(
    ScoreState,
    positionAtClearance(Band.outerClearance - 0.1),
    [TestBody],
    { runnerRadius: RunnerRadius },
  ), []);

  const [Event] = sampleSlingshotBodies(
    ScoreState,
    positionAtClearance(Band.outerClearance + 0.1),
    [TestBody],
    { runnerRadius: RunnerRadius },
  );
  assert.equal(Event.tier, 'assist');
  assert.equal(Event.points, 500);
  assert.equal(ScoreState.flightScore, 500);
});

test('deeper passes award readable tier multipliers', () => {
  const Band = getSlingshotBand(TestBody);
  for (const [Clearance, ExpectedTier, ExpectedPoints] of [
    [Band.deepClearance * 0.9, 'deep', 1000],
    [Band.razorClearance * 0.9, 'razor', 1500],
  ]) {
    const ScoreState = createScoreState();
    sampleSlingshotBodies(
      ScoreState,
      positionAtClearance(Clearance),
      [TestBody],
      { runnerRadius: RunnerRadius },
    );
    const [Event] = sampleSlingshotBodies(
      ScoreState,
      positionAtClearance(Band.outerClearance + 0.1),
      [TestBody],
      { runnerRadius: RunnerRadius },
    );
    assert.equal(Event.tier, ExpectedTier);
    assert.equal(Event.points, ExpectedPoints);
  }
});

test('distinct bodies build a chain while the same body cannot be farmed twice', () => {
  const SecondBody = {
    ...TestBody,
    id: 'moon',
    label: 'MOON',
    position: { x: 12, y: 0, z: 0 },
    slingshotValue: 300,
  };
  const ScoreState = createScoreState();
  const Band = getSlingshotBand(TestBody);

  sampleSlingshotBodies(ScoreState, positionAtClearance(Band.deepClearance * 0.9), [TestBody], { runnerRadius: RunnerRadius });
  const [FirstEvent] = sampleSlingshotBodies(ScoreState, positionAtClearance(Band.outerClearance + 0.1), [TestBody], { runnerRadius: RunnerRadius });
  sampleSlingshotBodies(
    ScoreState,
    { x: 12 + TestBody.radius + RunnerRadius + (Band.deepClearance * 0.9), y: 0, z: 0 },
    [SecondBody],
    { runnerRadius: RunnerRadius },
  );
  const [SecondEvent] = sampleSlingshotBodies(
    ScoreState,
    { x: 12 + TestBody.radius + RunnerRadius + Band.outerClearance + 0.1, y: 0, z: 0 },
    [SecondBody],
    { runnerRadius: RunnerRadius },
  );

  assert.equal(FirstEvent.chainMultiplier, 1);
  assert.equal(SecondEvent.chainMultiplier, 2);
  assert.equal(SecondEvent.points, 1200);
  assert.deepEqual(sampleSlingshotBodies(ScoreState, positionAtClearance(0.3), [TestBody], { runnerRadius: RunnerRadius }), []);
});

test('landing banks a flight and a miss rolls its unbanked value back', () => {
  const ScoreState = createScoreState();
  ScoreState.flightScore = 1200;
  ScoreState.chainCount = 2;

  assert.deepEqual(bankFlightScore(ScoreState, { landingBonus: 1000 }), {
    flightPoints: 1200,
    landingBonus: 1000,
    bankedPoints: 2200,
    totalScore: 2200,
  });
  ScoreState.flightScore = 900;
  assert.equal(rollbackFlightScore(ScoreState), 900);
  assert.equal(ScoreState.bankedScore, 2200);
  assert.equal(ScoreState.bankedSlingshotScore, 1200);
  assert.equal(ScoreState.liberationScore, 1000);
  assert.equal(ScoreState.networkScore, 1000);
  assert.equal(addCompletionBonus(ScoreState, 3), 3000);
  assert.equal(ScoreState.bankedScore, 5200);
  assert.equal(ScoreState.completionBonus, 3000);
  assert.equal(
    ScoreState.bankedSlingshotScore
      + ScoreState.liberationScore
      + ScoreState.completionBonus,
    ScoreState.bankedScore,
  );
});

test('network circuits and remaining pursuit distance form distinct ranked categories', () => {
  const ScoreState = createScoreState();
  bankFlightScore(ScoreState, { landingBonus: 1400 });
  assert.equal(addCircuitBonus(ScoreState, 1250), 1250);
  assert.equal(addVictoryBonus(ScoreState, 3), 3000);

  assert.equal(ScoreState.networkScore, 2650);
  assert.equal(ScoreState.liberationScore, 1400);
  assert.equal(ScoreState.circuitScore, 1250);
  assert.equal(ScoreState.victoryScore, 3000);
  assert.equal(ScoreState.bankedScore, 5650);
});

test('prediction uses the same pass sampling contract as live fixed steps', () => {
  const Band = getSlingshotBand(TestBody);
  const Points = [
    positionAtClearance(Band.outerClearance + 0.2),
    positionAtClearance(Band.deepClearance * 0.8),
    positionAtClearance(Band.outerClearance + 0.2),
  ];
  const PredictedEvents = predictSlingshotEvents(Points, [TestBody], {
    runnerRadius: RunnerRadius,
  });
  const LiveState = createScoreState();
  const LiveEvents = Points.flatMap((Point) => sampleSlingshotBodies(
    LiveState,
    Point,
    [TestBody],
    { runnerRadius: RunnerRadius },
  ));

  assert.deepEqual(PredictedEvents, LiveEvents);
});

