// How big each dot is drawn. Even dots carry tone by spacing alone. Tone dots
// also grow with the ink in their cell: a dot's area equals the ink its cell
// holds (times `scale` squared), so the inked fraction of the page matches the
// picture's mean density, apart from any overlap.

export const DOT_MODES = ['even', 'tone'];

export function dotRadii(stats, count, { mode = 'even', radius = 1, scale = 1, min = 0 } = {}, out) {
  const r = out && out.length === count ? out : new Float64Array(count);
  for (let i = 0; i < count; i++) {
    r[i] = mode === 'tone' ? Math.max(min, scale * Math.sqrt(stats.mass[i] / Math.PI)) : radius;
  }
  return r;
}

// Inked area over page area, counting overlapping dots twice.
export function coverage(radii, count, width, height) {
  let a = 0;
  for (let i = 0; i < count; i++) a += Math.PI * radii[i] * radii[i];
  return a / (width * height);
}

// Even-dot radius that would ink the same share of the page as the picture's
// mean density, a sensible starting size for the even mode.
export function evenRadiusFor(meanDensity, count, width, height) {
  if (count <= 0) return 0;
  return Math.sqrt((meanDensity * width * height) / (count * Math.PI));
}
