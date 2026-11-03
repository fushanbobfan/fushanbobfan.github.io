import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANETS, J2000, julianDay, elementsAt, dateOf, solveKepler, heliocentric, geocentric, elongation,
  dailyMotion, siderealPeriod, synodicPeriod, stations, loops, inner, wrap180,
  earthCentredPath, closestApproach,
} from '../src/orbits.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const jd = (iso) => julianDay(new Date(iso));

test('Julian days round-trip through dates', () => {
  close(jd('2000-01-01T12:00:00Z'), J2000, 1e-9);
  close(julianDay(dateOf(2460000.25)), 2460000.25, 1e-6);
});

test("Kepler's equation is solved even for eccentric orbits", () => {
  for (const e of [0, 0.0167, 0.2056, 0.6, 0.95]) {
    for (let M = -3; M <= 3; M += 0.37) {
      const E = solveKepler(M, e);
      close(E - e * Math.sin(E), M, 1e-12, `e ${e} M ${M}`);
    }
  }
});

test('the planets keep their distances from the Sun within their eccentricities', () => {
  for (const p of [...PLANETS, 'earth']) {
    for (let t = jd('1990-01-01'); t < jd('2040-01-01'); t += 997) {
      const { x, y, z } = heliocentric(p, t);
      const r = Math.hypot(x, y, z);
      const { a, e } = elementsAt(p, t);
      assert.ok(r >= a * (1 - e) - 1e-9 && r <= a * (1 + e) + 1e-9, `${p} at ${t}: ${r}`);
    }
  }
});

test('the Earth is about 1 au from the Sun, nearest in early January', () => {
  const r = (iso) => { const g = heliocentric('earth', jd(iso)); return Math.hypot(g.x, g.y, g.z); };
  close(r('2025-01-04'), 0.9833, 0.0003, 'perihelion');
  close(r('2025-07-03'), 1.0167, 0.0003, 'aphelion');
});

test('periods follow from the mean motions', () => {
  close(siderealPeriod('mars') / 365.25, 1.881, 0.001);
  close(synodicPeriod('mars'), 780, 1);
  close(synodicPeriod('venus'), 584, 1);
  close(synodicPeriod('mercury'), 116, 1);
  close(synodicPeriod('jupiter'), 399, 1);
});

test('Mars backed up from 7 December 2024 to 24 February 2025, with opposition on 16 January', () => {
  const [loop] = loops('mars', jd('2024-09-01'), jd('2025-06-01'));
  close(loop.start, jd('2024-12-07T00:00Z'), 1.5, 'stationary, turning retrograde');
  close(loop.end, jd('2025-02-24T00:00Z'), 1.5, 'stationary, turning direct');
  close(loop.middle, jd('2025-01-16T02:00Z'), 1, 'opposition');
  close(Math.abs(elongation('mars', loop.middle)), 180, 2);
});

test('oppositions of Jupiter (10 January 2026) and Saturn (21 September 2025)', () => {
  const [j] = loops('jupiter', jd('2025-09-01'), jd('2026-06-01'));
  close(j.middle, jd('2026-01-10T08:00Z'), 1, 'Jupiter');
  const [s] = loops('saturn', jd('2025-05-01'), jd('2026-02-01'));
  close(s.middle, jd('2025-09-21T05:00Z'), 1, 'Saturn');
});

test('the planet moves backwards only between its stations', () => {
  const [loop] = loops('mars', jd('2024-09-01'), jd('2025-06-01'));
  assert.ok(dailyMotion('mars', loop.start - 3) > 0);
  assert.ok(dailyMotion('mars', loop.start + 3) < 0);
  assert.ok(dailyMotion('mars', loop.end - 3) < 0);
  assert.ok(dailyMotion('mars', loop.end + 3) > 0);
  close(dailyMotion('mars', loop.start), 0, 1e-6);
});

test('every planet loops once a synodic period, the outer ones at opposition, the inner at inferior conjunction', () => {
  const from = jd('2020-01-01'), to = jd('2032-01-01');
  for (const p of PLANETS) {
    const ls = loops(p, from, to);
    const span = to - from;
    const expected = span / synodicPeriod(p);
    assert.ok(Math.abs(ls.length - expected) <= 1.01, `${p}: ${ls.length} loops, ${expected.toFixed(1)} expected`);
    for (const l of ls) {
      const el = Math.abs(elongation(p, l.middle));
      if (inner(p)) {
        assert.ok(el < 6, `${p} middle elongation ${el}`);
        // inferior conjunction: nearer than the Sun
        assert.ok(geocentric(p, l.middle).dist < 1, `${p} in front of the Sun`);
      } else {
        close(el, 180, 3, `${p} opposition`);
      }
    }
    for (let k = 1; k < ls.length; k++) {
      close(ls[k].middle - ls[k - 1].middle, synodicPeriod(p), p === 'mercury' ? 25 : p === 'mars' ? 60 : 12, `${p} spacing`);
    }
  }
});

test('the outer the planet, the longer the loop and the shorter its arc', () => {
  const from = jd('2024-01-01'), to = jd('2027-01-01');
  const outer = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map((p) => loops(p, from, to)[0]);
  for (let i = 1; i < outer.length; i++) {
    assert.ok(outer[i].days > outer[i - 1].days, 'duration grows');
    assert.ok(outer[i].arc < outer[i - 1].arc, 'arc shrinks');
  }
});

test('stations alternate between turning back and turning forward', () => {
  const st = stations('venus', jd('2020-01-01'), jd('2030-01-01'));
  for (let i = 1; i < st.length; i++) assert.notEqual(st[i].kind, st[i - 1].kind);
});

test('longitudes wrap into (-180, 180]', () => {
  close(wrap180(359), -1, 1e-12);
  close(wrap180(181), -179, 1e-12);
  close(wrap180(-190), 170, 1e-12);
});

test('seen from the Earth, the planet sits at its position minus the Earth\'s', () => {
  for (const p of PLANETS) {
    const t = jd('2026-11-02');
    const g = geocentric(p, t), a = heliocentric(p, t), e = heliocentric('earth', t);
    close(g.x, a.x - e.x, 1e-12, p);
    close(g.y, a.y - e.y, 1e-12, p);
    const path = earthCentredPath(p, t - 10, t + 10, 5);
    assert.equal(path.length, 5);
    close(path[2].x, g.x, 1e-12);
  }
});

test('the planet comes closest to the Earth in the middle of its loop', () => {
  for (const p of ['mars', 'jupiter', 'saturn', 'venus']) {
    const [l] = loops(p, jd('2025-01-01'), jd('2028-01-01'));
    const near = closestApproach(p, l.start, l.end);
    close(near.jd, l.middle, 8, `${p} closest approach`);
    assert.ok(near.dist < geocentric(p, l.start).dist && near.dist < geocentric(p, l.end).dist);
  }
  // Mars was nearest on 12 January 2025, about 0.642 au away, four days before opposition
  const [mars] = loops('mars', jd('2024-09-01'), jd('2025-06-01'));
  const near = closestApproach('mars', mars.start, mars.end);
  close(near.jd, jd('2025-01-12'), 1.5, 'date');
  close(near.dist, 0.642, 0.002, 'distance');
});

test('in the Earth\'s frame the planet loops once a synodic period', () => {
  // the direction from the Earth turns back only during the loops
  const from = jd('2024-01-01'), to = from + 3 * 780;
  const path = earthCentredPath('mars', from, to, 1171);
  let backs = 0, prev = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const back = a.x * b.y - a.y * b.x < 0;
    if (back && !prev) backs++;
    prev = back;
  }
  assert.equal(backs, loops('mars', from, to).length);
});
