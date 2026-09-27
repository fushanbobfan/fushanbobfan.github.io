// Approximate display colour of monochromatic light, after Dan Bruton's
// piecewise-linear fit to the visible spectrum, with intensity rolled off at
// both ends where the eye is less sensitive.

export const VISIBLE = { min: 380, max: 750 };

export function wavelengthToRGB(nm) {
  if (!(nm >= VISIBLE.min && nm <= VISIBLE.max)) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = (440 - nm) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
  } else if (nm <= 750) {
    r = 1;
  }
  let f = 0;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm >= 420 && nm <= 700) f = 1;
  else if (nm > 700 && nm <= 750) f = 0.3 + (0.7 * (750 - nm)) / 50;
  return [r * f, g * f, b * f];
}

// Wavelengths standing in for white light: the centres of `count` equal bands
// across the part of the spectrum the colour map shows at full strength.
export const WHITE_BAND = { min: 400, max: 700 };

export function spectrumSamples(count) {
  const n = Math.max(1, Math.round(count));
  const width = (WHITE_BAND.max - WHITE_BAND.min) / n;
  return Array.from({ length: n }, (_, i) => Math.round(WHITE_BAND.min + width * (i + 0.5)));
}

// Per-wavelength weights for a set of samples so that, drawn on top of each
// other additively, they add up to a neutral white: each weight is nudged
// until the red, green and blue sums agree, then all are scaled so the sums
// reach full scale.
export function whiteWeights(wavelengths) {
  const rgbs = wavelengths.map(wavelengthToRGB);
  const w = rgbs.map(() => 1);
  const sums = () => [0, 1, 2].map((c) => rgbs.reduce((t, rgb, i) => t + w[i] * rgb[c], 0));
  for (let iter = 0; iter < 200; iter++) {
    const t = sums();
    rgbs.forEach((rgb, i) => {
      const total = rgb[0] + rgb[1] + rgb[2];
      if (total > 0) w[i] *= total / (rgb[0] * t[0] + rgb[1] * t[1] + rgb[2] * t[2]);
    });
  }
  const peak = Math.max(...sums());
  return peak > 0 ? w.map((x) => x / peak) : w;
}

export function wavelengthToCss(nm, alpha = 1) {
  const [r, g, b] = wavelengthToRGB(nm).map((c) => Math.round(255 * c));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
