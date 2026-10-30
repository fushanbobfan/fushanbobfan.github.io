// Where the bows stand in the sky. Directions are given by azimuth, measured
// from the azimuth of the antisolar point, and elevation above the horizon.
// With the sun at elevation h, the antisolar point is h below the horizon.

export function antisolarAngle(az, el, sunEl) {
  const c = -Math.sin(el) * Math.sin(sunEl) + Math.cos(el) * Math.cos(sunEl) * Math.cos(az);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

// Elevation of the top of a bow of angular radius alpha; negative means the
// whole bow is below the horizon.
export function bowTop(alpha, sunEl) {
  return alpha - sunEl;
}

// Half the angular width along the horizon of the part of the bow above it,
// or 0 when none of it is up.
export function bowSpan(alpha, sunEl) {
  if (alpha <= sunEl) return 0;
  return Math.acos(Math.min(1, Math.cos(alpha) / Math.cos(sunEl)));
}
