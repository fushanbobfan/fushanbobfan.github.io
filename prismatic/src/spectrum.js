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

export function wavelengthToCss(nm, alpha = 1) {
  const [r, g, b] = wavelengthToRGB(nm).map((c) => Math.round(255 * c));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
