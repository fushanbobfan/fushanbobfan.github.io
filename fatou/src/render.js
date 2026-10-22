// Turns samples into pixels. Pure functions over an RGBA byte buffer, so the
// same code draws the page and runs under the tests.

import {
  sample, inMainCardioid, inPeriod2Bulb,
  ESCAPED, SMOOTH, DISTANCE, PERIOD, STEPS, LAST_X, LAST_Y, SAMPLE_SIZE,
} from './dynamics.js';
import { lutIndex, periodColour } from './palette.js';
import { phaseOf } from './basin.js';

const DARK = [6, 6, 10];

// Colour for one sample record. `pixel` is the width of a pixel in the plane,
// which turns the distance estimate into a distance in pixels.
export function shadeSample(s, opts, pixel, rgb) {
  if (s[ESCAPED]) {
    const t = Math.sqrt(s[SMOOTH]) * opts.density * 0.12 + opts.offset;
    const i = 3 * lutIndex(t);
    let k = 1;
    if (opts.colouring === 'boundary') {
      // filaments thinner than a pixel show up as dark lines instead of noise
      k = Math.min(1, Math.sqrt(s[DISTANCE] / pixel / 2));
    }
    rgb[0] = opts.lut[i] * k;
    rgb[1] = opts.lut[i + 1] * k;
    rgb[2] = opts.lut[i + 2] * k;
    return rgb;
  }
  let c = DARK;
  if (opts.interior === 'phase' && opts.cycle && s[PERIOD] === opts.cycle.period) {
    c = periodColour(1 + phaseOf(opts.cycle.points, s[STEPS], s[LAST_X], s[LAST_Y]));
  } else if (opts.interior !== 'dark') {
    c = periodColour(s[PERIOD]);
  }
  rgb[0] = c[0];
  rgb[1] = c[1];
  rgb[2] = c[2];
  return rgb;
}

// Samples the parameter plane (opts.julia false) or the dynamical plane of
// f_c for c = opts.c (opts.julia true) at one point.
export function samplePoint(out, x, y, opts) {
  if (opts.julia) return sample(out, x, y, opts.c[0], opts.c[1], opts.maxIter, true);
  if (inMainCardioid(x, y) || inPeriod2Bulb(x, y)) {
    out[ESCAPED] = 0;
    out[SMOOTH] = 0;
    out[DISTANCE] = 0;
    out[PERIOD] = inPeriod2Bulb(x, y) ? 2 : 1;
    return out;
  }
  return sample(out, 0, 0, x, y, opts.maxIter, false);
}

// Fills rows [y0, y1) of the RGBA buffer. With step > 1 one sample is taken
// per step x step block and the whole block takes its colour, which gives a
// quick coarse picture to refine.
export function renderRows(img, width, height, view, opts, y0, y1, step = 1) {
  const out = new Float64Array(SAMPLE_SIZE);
  const rgb = [0, 0, 0];
  const left = view.cx - (width / 2) * view.scale;
  const top = view.cy + (height / 2) * view.scale;
  for (let y = y0; y < y1; y += step) {
    const im = top - (y + Math.min(step, height - y) / 2) * view.scale;
    const yEnd = Math.min(y + step, height);
    for (let x = 0; x < width; x += step) {
      const re = left + (x + Math.min(step, width - x) / 2) * view.scale;
      samplePoint(out, re, im, opts);
      shadeSample(out, opts, view.scale, rgb);
      const xEnd = Math.min(x + step, width);
      for (let yy = y; yy < yEnd; yy++) {
        let p = 4 * (yy * width + x);
        for (let xx = x; xx < xEnd; xx++) {
          img[p] = rgb[0];
          img[p + 1] = rgb[1];
          img[p + 2] = rgb[2];
          img[p + 3] = 255;
          p += 4;
        }
      }
    }
  }
}
