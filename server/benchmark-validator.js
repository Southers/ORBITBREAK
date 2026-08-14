import { performance } from 'node:perf_hooks';

import { validateSerializedReplay } from '../src/replay-validator.js';

const ReferenceReplay = JSON.stringify({
  v: 1,
  s: 'breaker-reach',
  c: 'breaker-reach-2',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [108, 'meadow', 18.288242289175088, 0.6416927119009118],
    [450, 'ember', 18.289101298583088, 0.6417249200732145],
    [790, 'grove', 18.18743573681574, 2.5679869775427595],
    [1130, 'tide', 11.983741479291645, 13.798477634983227],
  ],
});
const WarmupRuns = 20;
const MeasuredRuns = 200;
const Samples = [];

for (let RunIndex = 0; RunIndex < WarmupRuns + MeasuredRuns; RunIndex += 1) {
  const StartedAt = performance.now();
  const Validation = validateSerializedReplay(ReferenceReplay);
  const ElapsedMilliseconds = performance.now() - StartedAt;
  if (!Validation.valid || Validation.result.score !== 7000) {
    throw new Error(Validation.reason ?? 'Reference replay did not derive 7,000 points.');
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
