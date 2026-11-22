import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moon, sun, pull, tidal, tidalTotal, tidalScale, tideAmplitude, heightFromBody, heightAt,
  profile, springNeap, MOON_PERIGEE, MOON_APOGEE, G, MOON_MASS, EARTH_RADIUS, MOON_MEAN_DISTANCE,
} from '../src/tides.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the lunar equilibrium tide stands about 36 cm high and 18 cm low', () => {
  const m = moon();
  near(tideAmplitude(m), 0.357, 0.003, 'amplitude');
  near(heightFromBody(0, m), 0.357, 0.003, 'under the Moon');
  near(heightFromBody(Math.PI, m), 0.357, 0.003, 'opposite the Moon');
  near(heightFromBody(Math.PI / 2, m), -0.178, 0.002, 'at right angles');
  near(profile([m]).range, 0.535, 0.005, 'range');
});

test('the Sun raises a tide a little under half the Moon\'s', () => {
  const s = springNeap();
  near(s.ratio, 0.46, 0.01, 'ratio');
  near(s.solar, 0.246, 0.004, 'solar range');
  near(s.spring, 0.78, 0.01, 'spring');
  near(s.neap, 0.29, 0.01, 'neap');
});

test('aligned and crossed bodies give the spring and neap ranges', () => {
  const s = springNeap();
  near(profile([moon(0), sun(0)]).range, s.spring, 1e-3, 'new moon');
  near(profile([moon(0), sun(Math.PI)]).range, s.spring, 1e-3, 'full moon');
  near(profile([moon(0), sun(Math.PI / 2)]).range, s.neap, 1e-3, 'quarter');
});

test('perigee and apogee change the lunar tide by the cube of the distance', () => {
  const p = tideAmplitude(moon(0, MOON_PERIGEE));
  const a = tideAmplitude(moon(0, MOON_APOGEE));
  near(p / a, (MOON_APOGEE / MOON_PERIGEE) ** 3, 1e-9);
  assert.ok(p / a > 1.35 && p / a < 1.45);
});

test('the exact tidal pull under the Moon matches 2GMR/d^3 to leading order', () => {
  const m = moon();
  const t = tidal({ x: 1, y: 0 }, m);
  const lead = tidalScale(m);
  near(lead, 1.1e-6, 0.02e-6, 'leading order');
  // The next term adds 3R/(2d), about 2.5 percent.
  near(t.x / lead, 1 + 1.5 * EARTH_RADIUS / MOON_MEAN_DISTANCE, 0.002, 'near side');
  near(t.y, 0, 1e-15);
});

test('the far side is pushed away from the Moon and the sides squeezed inward at half strength', () => {
  const m = moon();
  const lead = tidalScale(m);
  const far = tidal({ x: -1, y: 0 }, m);
  assert.ok(far.x < 0);
  near(-far.x / lead, 1, 0.03, 'far side');
  const side = tidal({ x: 0, y: 1 }, m);
  assert.ok(side.y < 0);
  near(-side.y / lead, 0.5, 0.01, 'side');
  near(tidal({ x: 0, y: 0 }, m).x, 0, 1e-20, 'centre');
});

test('the tidal pull equals the difference of the two pulls', () => {
  const m = moon(0.7, MOON_PERIGEE);
  for (const p of [{ x: 0.3, y: -0.8 }, { x: -1, y: 0.2 }, { x: 0.9, y: 0.4 }]) {
    const a = pull(p, m);
    const c = pull({ x: 0, y: 0 }, m);
    const t = tidal(p, m);
    near(t.x, a.x - c.x, 1e-12);
    near(t.y, a.y - c.y, 1e-12);
  }
  near(Math.hypot(...Object.values(pull({ x: 0, y: 0 }, moon()))), G * MOON_MASS / MOON_MEAN_DISTANCE ** 2, 1e-12);
});

test('the bulges follow the Moon round', () => {
  for (const angle of [0, 1, 2.5, 4]) {
    const pr = profile([moon(angle)], 3600);
    const off = Math.abs(Math.sin(pr.highAt - angle));
    assert.ok(off < 0.01, `high water ${pr.highAt} for Moon at ${angle}`);
    near(Math.abs(Math.cos(pr.lowAt - angle)), 0, 0.01);
  }
  const both = tidalTotal({ x: 1, y: 0 }, [moon(0), sun(0)]);
  near(both.x, tidal({ x: 1, y: 0 }, moon(0)).x + tidal({ x: 1, y: 0 }, sun(0)).x, 1e-20);
});

test('the tide moves water around without adding any', () => {
  // Over the whole sphere (3cos^2 z - 1)/2 averages to zero.
  const m = moon();
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i += 1) {
    const z = ((i + 0.5) / n) * Math.PI;
    sum += heightFromBody(z, m) * Math.sin(z) * (Math.PI / n);
  }
  near(sum, 0, 1e-6);
  near(heightAt(0.3, []), 0, 0);
});
