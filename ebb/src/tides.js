// Tidal forces and the equilibrium tide. Pure functions, SI units unless a
// name says otherwise. Positions in the drawing plane are in Earth radii with
// the Earth's centre at the origin; a body sits at angle `angle` (radians,
// counterclockwise from +x) and distance `distance` (metres).

export const G = 6.674e-11;
export const EARTH_MASS = 5.9722e24;
export const EARTH_RADIUS = 6.371e6;
export const MOON_MASS = 7.342e22;
export const SUN_MASS = 1.98847e30;
export const MOON_MEAN_DISTANCE = 3.844e8;
export const MOON_PERIGEE = 3.633e8;
export const MOON_APOGEE = 4.055e8;
export const SUN_DISTANCE = 1.496e11;

export const moon = (angle = 0, distance = MOON_MEAN_DISTANCE) => ({ mass: MOON_MASS, distance, angle });
export const sun = (angle = 0, distance = SUN_DISTANCE) => ({ mass: SUN_MASS, distance, angle });

const bodyPosition = (b) => ({
  x: (b.distance / EARTH_RADIUS) * Math.cos(b.angle),
  y: (b.distance / EARTH_RADIUS) * Math.sin(b.angle),
});

// Gravitational acceleration (m/s^2) the body gives a point p (Earth radii).
export function pull(p, body) {
  const b = bodyPosition(body);
  const dx = (b.x - p.x) * EARTH_RADIUS;
  const dy = (b.y - p.y) * EARTH_RADIUS;
  const r = Math.hypot(dx, dy);
  const k = (G * body.mass) / (r * r * r);
  return { x: k * dx, y: k * dy };
}

// Tidal acceleration: the pull at p minus the pull at the Earth's centre.
// Subtracting the large numbers directly loses digits, so the difference is
// formed from the exact expression rearranged around the centre.
export function tidal(p, body) {
  const b = bodyPosition(body);
  const R = EARTH_RADIUS;
  const bx = b.x * R;
  const by = b.y * R;
  const dx = bx - p.x * R;
  const dy = by - p.y * R;
  const r = Math.hypot(dx, dy);
  const d = Math.hypot(bx, by);
  const gm = G * body.mass;
  const ir3 = 1 / (r * r * r);
  const id3 = 1 / (d * d * d);
  // gm*(dx*ir3 - bx*id3) = gm*(ir3 - id3)*bx - gm*ir3*p.x*R
  return {
    x: gm * ((ir3 - id3) * bx - ir3 * p.x * R),
    y: gm * ((ir3 - id3) * by - ir3 * p.y * R),
  };
}

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

export function tidalTotal(p, bodies) {
  return bodies.reduce((acc, b) => add(acc, tidal(p, b)), { x: 0, y: 0 });
}

// Leading-order tidal acceleration under the body: 2GMR/d^3.
export const tidalScale = (body) => (2 * G * body.mass * EARTH_RADIUS) / body.distance ** 3;

// Amplitude (m) of the equilibrium tide raised by a body on a rigid,
// ocean-covered Earth: (M/Me) R^4 / d^3. The surface stands at
// amplitude * (3 cos^2 z - 1) / 2 above the mean, z the angle from the body.
export const tideAmplitude = (body) => (body.mass / EARTH_MASS) * EARTH_RADIUS ** 4 / body.distance ** 3;

export function heightFromBody(z, body) {
  const c = Math.cos(z);
  return tideAmplitude(body) * (3 * c * c - 1) / 2;
}

// Height (m) at the point of the drawing plane at angle phi, every body in
// that same plane.
export const heightAt = (phi, bodies) => bodies.reduce((h, b) => h + heightFromBody(phi - b.angle, b), 0);

// High and low water around the equator of the drawing, sampled finely.
export function profile(bodies, samples = 720) {
  let high = -Infinity;
  let low = Infinity;
  let highAt = 0;
  let lowAt = 0;
  for (let i = 0; i < samples; i += 1) {
    const phi = (i / samples) * 2 * Math.PI;
    const h = heightAt(phi, bodies);
    if (h > high) { high = h; highAt = phi; }
    if (h < low) { low = h; lowAt = phi; }
  }
  return { high, low, range: high - low, highAt, lowAt };
}

// Ranges of the two tides acting alone, and of the two together when they
// line up (spring tide) and when they are at right angles (neap tide).
export function springNeap(moonDistance = MOON_MEAN_DISTANCE) {
  const lunar = 1.5 * tideAmplitude(moon(0, moonDistance));
  const solar = 1.5 * tideAmplitude(sun());
  return { lunar, solar, spring: lunar + solar, neap: Math.abs(lunar - solar), ratio: solar / lunar };
}
