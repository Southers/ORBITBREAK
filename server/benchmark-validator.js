import { performance } from 'node:perf_hooks';

import { validateSerializedReplay } from '../src/replay-validator.js';

const ReferenceReplay = JSON.stringify({
  v: 2,
  s: 'breaker-reach',
  c: 'breaker-reach-5',
  p: 'orbitbreak-fixed-step-v1',
  h: 120,
  o: 1,
  l: [
    [0, 'meadow', -18.383711059475825, -9.29153176447292, 12.5, 0, null],
    [81, 'ember', -9.39128652337041, -9.582336791038667, 8.99174750423314, 8.683229630737465, null],
    [246, 'grove', 3.5196755693207544, -5.6697576825922, -12.5, -1.5308084989341915e-15, null],
    [582, 'meadow', -24.941610661576874, -10.468304421196311, 4.592425496802575e-16, 7.5, 612],
    [854, 'frost', -6.028288379931077, 6.744597165098799, 8.683229630737465, -8.99174750423314, null],
    [985, 'grove', 3.506030257999854, -2.350692592029089, 8.364132579485728, 9.289310318467429, null],
    [1119, 'tide', 15.074880278671033, 0.4940867834126872, 11.669755331215022, 4.4795993693162535, null],
  ],
});
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
