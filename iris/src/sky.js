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

// Stereographic projection centred on the direction (0, el0). It maps every
// circle on the sky to a circle on the page, so the bows keep their shape
// even at the edge of a wide view. Plane coordinates have y up.
export function project(az, el, el0) {
  const k = 2 / (1 + Math.sin(el0) * Math.sin(el) + Math.cos(el0) * Math.cos(el) * Math.cos(az));
  return [
    k * Math.cos(el) * Math.sin(az),
    k * (Math.cos(el0) * Math.sin(el) - Math.sin(el0) * Math.cos(el) * Math.cos(az)),
  ];
}

export function unproject(x, y, el0) {
  const rho = Math.hypot(x, y);
  if (rho < 1e-12) return [0, el0];
  const c = 2 * Math.atan(rho / 2);
  const sc = Math.sin(c);
  const cc = Math.cos(c);
  const el = Math.asin(Math.max(-1, Math.min(1, cc * Math.sin(el0) + (y * sc * Math.cos(el0)) / rho)));
  const az = Math.atan2(x * sc, rho * Math.cos(el0) * cc - y * Math.sin(el0) * sc);
  return [az, el];
}
