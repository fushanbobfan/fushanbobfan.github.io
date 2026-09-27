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

// Common weight for a set of wavelengths so that, drawn on top of each other
// additively, their brightest colour channel just reaches full scale.
export function whiteShare(wavelengths) {
  const sum = [0, 0, 0];
  for (const wl of wavelengths) {
    const rgb = wavelengthToRGB(wl);
    for (let c = 0; c < 3; c++) sum[c] += rgb[c];
  }
  const peak = Math.max(...sum);
  return peak > 0 ? 1 / peak : 1;
}

export function wavelengthToCss(nm, alpha = 1) {
  const [r, g, b] = wavelengthToRGB(nm).map((c) => Math.round(255 * c));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
