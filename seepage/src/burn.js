// Burning: set fire to every open cell on the top row and let it spread one link per
// step through open links. The step at which a cell catches is its shortest-path
// ("chemical") distance from the top through the open grid.

import { downOpen, rightOpen, siteOpen } from './lattice.js';

// Returns { time, steps, crossed } where time[i] is the step at which site i catches
// fire (-1 if never), steps is the last step at which anything burned and crossed is
// the first step that reaches the bottom row (-1 if fire never gets across).
export function burn(lat, p) {
  const { size } = lat;
  const n = size * size;
  const time = new Int32Array(n).fill(-1);
  let front = [];
  for (let x = 0; x < size; x++) {
    if (siteOpen(lat, x, p)) {
      time[x] = 0;
      front.push(x);
    }
  }
  let step = 0;
  let crossed = -1;
  if (front.some((i) => i >= n - size)) crossed = 0;
  while (front.length) {
    const next = [];
    const t = step + 1;
    const light = (j) => {
      if (time[j] < 0) {
        time[j] = t;
        next.push(j);
        if (crossed < 0 && j >= n - size) crossed = t;
      }
    };
    for (const i of front) {
      const x = i % size;
      if (rightOpen(lat, i, p)) light(i + 1);
      if (downOpen(lat, i, p)) light(i + size);
      if (x > 0 && rightOpen(lat, i - 1, p)) light(i - 1);
      if (i >= size && downOpen(lat, i - size, p)) light(i - size);
    }
    if (!next.length) break;
    front = next;
    step = t;
  }
  return { time, steps: front.length ? step : 0, crossed };
}

// How many cells catch fire at each step: the width of the burning front.
export function frontSizes(time, steps) {
  const counts = new Array(steps + 1).fill(0);
  for (const t of time) if (t >= 0) counts[t]++;
  return counts;
}
