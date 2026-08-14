import { performance } from 'node:perf_hooks';

import { validateSerializedReplay } from '../src/replay-validator.js';

const ReferenceReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-4',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [0, 'meadow', -20.169758592649977, -9.726411328046426, 17.089583142026537, 0.5967813936127666, 5],
    [45, 'ember', -13.45741319496786, -9.475808784347384, 18.2388825930985, 0.6369158148206426, null],
    [144, 'grove', 2.172876907139826, -4.235567739034147, -18.205543917241794, -1.2730556458302782, null],
    [301, 'meadow', -20.8933747416002, -7.742904631196904, 11.235821924693264, 14.381196253322678, null],
    [422, 'frost', -5.550710296381496, 5.539544938575729, 11.235821924693267, -14.381196253322672, null],
    [507, 'grove', 1.4600000000000004, -6, 14.478698460315043, 11.109896079409152, null],
  ],
});
const WarmupRuns = 20;
const MeasuredRuns = 200;
const Samples = [];

for (let RunIndex = 0; RunIndex < WarmupRuns + MeasuredRuns; RunIndex += 1) {
  const StartedAt = performance.now();
  const Validation = validateSerializedReplay(ReferenceReplay);
  const ElapsedMilliseconds = performance.now() - StartedAt;
  if (!Validation.valid || Validation.result.score !== 11650) {
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
