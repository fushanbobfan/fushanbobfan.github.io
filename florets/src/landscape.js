// Packing across a window of divergence angles: the same head grown at each
// angle in turn, scored by its tightest squeeze. The peaks are very narrow
// (a few hundredths of a degree at the golden angle for 500 florets), so the
// window is sampled finely and filled in a slice at a time.

import { florets, packing } from './phyllo.js';

export function angleAt(i, from, to, samples) {
  return from + ((to - from) * i) / (samples - 1);
}

export function* landscapeSlices(count, from, to, samples = 501, slice = 25) {
  const values = new Float64Array(samples);
  for (let start = 0; start < samples; start += slice) {
    const end = Math.min(samples, start + slice);
    for (let i = start; i < end; i++) {
      values[i] = packing(florets(count, angleAt(i, from, to, samples) / 360));
    }
    yield { done: end, values };
  }
}

export function landscape(count, from, to, samples = 501) {
  let last = null;
  for (const part of landscapeSlices(count, from, to, samples)) last = part;
  return last.values;
}

export function peak(values, from, to) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return { deg: angleAt(best, from, to, values.length), value: values[best], index: best };
}
