import { performance } from 'node:perf_hooks';

import { validateSerializedReplay } from '../src/replay-validator.js';
import { loadReplayFixture } from '../tests/fixtures/load-fixture.js';

const ReferenceReplay = JSON.stringify(loadReplayFixture('breaker-reach-complete.v2.json'));
const WarmupRuns = 20;
const MeasuredRuns = 200;
const Samples = [];

for (let RunIndex = 0; RunIndex < WarmupRuns + MeasuredRuns; RunIndex += 1) {
  const StartedAt = performance.now();
  const Validation = validateSerializedReplay(ReferenceReplay);
  const ElapsedMilliseconds = performance.now() - StartedAt;
  if (!Validation.valid || Validation.result.score !== 10900) {
    throw new Error(Validation.reason ?? 'Reference replay did not derive 10,900 points.');
  }
  if (RunIndex >= WarmupRuns) {
    Samples.push(ElapsedMilliseconds);
  }
}

Samples.sort((First, Second) => First - Second);
const Mean = Samples.reduce((Total, Sample) => Total + Sample, 0) / Samples.length;
const Percentile = (Fraction) => Samples[Math.min(
  Samples.length - 1,
  Math.floor(Samples.length * Fraction),
)];

console.log(JSON.stringify({
  runtime: process.version,
  measuredRuns: Samples.length,
  minimumMilliseconds: Samples[0],
  medianMilliseconds: Percentile(0.5),
  p95Milliseconds: Percentile(0.95),
  maximumMilliseconds: Samples.at(-1),
  meanMilliseconds: Mean,
}, null, 2));
