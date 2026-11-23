// Two more things a rolling shutter does: it leans anything that moves
// sideways, and it lights only a band of the frame when a flash fires during
// the readout. Plain functions; no DOM access.

import { rowTime } from './shutter.js';

// --- A pole passing by -------------------------------------------------------
//
// The frame spans [-1, 1] in both directions. A vertical pole crosses it from
// left to right in `cross` seconds and stands at the centre halfway through the
// readout, so on row i it is at x = v · (tᵢ − T/2) with v = 2 / cross.

export function poleX(row, rows, readout, cross) {
  return (2 / cross) * (rowTime(row, rows, readout) - readout / 2);
}

// Angle (radians) by which the photographed pole leans from vertical. The top
// row is read first, so the pole's foot is caught further along its path.
export function leanAngle(readout, cross) {
  return Math.atan(((2 / cross) * readout) / 2);
}

// RGBA photo of the passing pole, size × size, with the pole drawn half
// `halfWidth` wide around its position on each row.
export function photographPole({ size, readout, cross, halfWidth = 0.06 }, ss = 2) {
  const out = new Uint8ClampedArray(size * size * 4);
  const step = 2 / size;
  for (let row = 0; row < size; row++) {
    const x0 = poleX(row, size, readout, cross);
    for (let col = 0; col < size; col++) {
      let hit = 0;
      for (let b = 0; b < ss; b++) {
        const x = -1 + (col + (b + 0.5) / ss) * step;
        if (Math.abs(x - x0) <= halfWidth) hit++;
      }
      const c = hit / ss;
      const k = (row * size + col) * 4;
      out[k] = 223 + (43 - 223) * c;
      out[k + 1] = 233 + (47 - 233) * c;
      out[k + 2] = 241 + (54 - 241) * c;
      out[k + 3] = 255;
    }
  }
  return out;
}

// --- A flash during the readout ------------------------------------------------
//
// Row i collects light from tᵢ to tᵢ + E, where E is the exposure time. A flash
// lasting d seconds from tf lights each row by the share of the flash that falls
// inside its exposure.

export function flashShare(row, rows, { readout, exposure, flashAt, flash }) {
  const t0 = rowTime(row, rows, readout);
  const overlap = Math.min(t0 + exposure, flashAt + flash) - Math.max(t0, flashAt);
  return Math.max(0, overlap) / flash;
}

// Share of each row's light that comes from the flash, top to bottom.
export function flashProfile(rows, opts) {
  return Array.from({ length: rows }, (_, i) => flashShare(i, rows, opts));
}

// Fraction of the frame's rows that catch the whole flash, and the fraction
// that catch any of it.
export function flashCoverage(rows, opts) {
  const p = flashProfile(rows, opts);
  return {
    full: p.filter((v) => v >= 1 - 1e-9).length / rows,
    any: p.filter((v) => v > 1e-9).length / rows,
  };
}

// Every row is open at the same moment only when the exposure is longer than
// the readout; a flash fits inside that common window when the exposure is at
// least the readout plus the flash.
export function wholeFrameFlashExposure(readout, flash) {
  return readout + flash;
}
