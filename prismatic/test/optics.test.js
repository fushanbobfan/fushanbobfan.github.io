import test from 'node:test';
import assert from 'node:assert/strict';
import { vec, fromAngle } from '../src/geometry.js';
import {
  MATERIALS, refractiveIndex, reflect, refract, fresnel, criticalAngle, abbeNumber,
} from '../src/optics.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('reflection keeps the tangential component and flips the normal one', () => {
  const r = reflect(vec(Math.SQRT1_2, -Math.SQRT1_2), vec(0, 1));
  close(r.x, Math.SQRT1_2);
  close(r.y, Math.SQRT1_2);
});

test('refraction obeys Snell\'s law', () => {
  const normal = vec(0, 1);
  for (const deg of [0, 10, 30, 60, 85]) {
    const i = (deg * Math.PI) / 180;
    const d = vec(Math.sin(i), -Math.cos(i));
    const t = refract(d, normal, 1, 1.5);
    close(t.x * t.x + t.y * t.y, 1, 1e-12);
    close(1 * Math.sin(i), 1.5 * t.x, 1e-12);
    assert.ok(t.y < 0);
  }
});

test('refraction beyond the critical angle returns null', () => {
  const crit = criticalAngle(1.5, 1);
  close(crit, Math.asin(1 / 1.5));
  const inside = (a) => vec(Math.sin(a), -Math.cos(a));
  assert.notEqual(refract(inside(crit - 0.01), vec(0, 1), 1.5, 1), null);
  assert.equal(refract(inside(crit + 0.01), vec(0, 1), 1.5, 1), null);
  assert.equal(criticalAngle(1, 1.5), null);
});

test('Fresnel reflectance matches the normal-incidence formula and reaches one at grazing', () => {
  close(fresnel(1, 1, 1.5), ((1.5 - 1) / (1.5 + 1)) ** 2);
  close(fresnel(0, 1, 1.5), 1);
  assert.equal(fresnel(Math.cos(1.2), 1.5, 1), 1);
});

test('Fresnel reflectance vanishes for p-light at Brewster\'s angle, leaving half the s part', () => {
  const b = Math.atan(1.5);
  const cosi = Math.cos(b);
  const cost = Math.cos(Math.asin(Math.sin(b) / 1.5));
  const rs = (cosi - 1.5 * cost) / (cosi + 1.5 * cost);
  close(fresnel(cosi, 1, 1.5), (rs * rs) / 2);
});

test('glass disperses: blue light bends more than red, flint more than crown', () => {
  for (const m of Object.values(MATERIALS)) {
    assert.ok(refractiveIndex(m, 400) > refractiveIndex(m, 700));
  }
  close(refractiveIndex(MATERIALS.bk7, 587.6), 1.5046 + 0.0042 / 0.5876 ** 2);
  const spread = (m) => refractiveIndex(m, 400) - refractiveIndex(m, 700);
  assert.ok(spread(MATERIALS.sf10) > spread(MATERIALS.bk7));
});

test('refraction is reversible', () => {
  const d = fromAngle(-1.1);
  const n = vec(0, 1);
  const t = refract(d, n, 1, 1.52);
  const back = refract(vec(-t.x, -t.y), vec(0, -1), 1.52, 1);
  close(back.x, -d.x, 1e-12);
  close(back.y, -d.y, 1e-12);
});

test('Abbe numbers from the Cauchy fits land near the catalogue values', () => {
  // Catalogue values: N-BK7 64.17, SF10 28.41.
  assert.ok(Math.abs(abbeNumber(MATERIALS.bk7) - 64.17) < 1);
  assert.ok(Math.abs(abbeNumber(MATERIALS.sf10) - 28.41) < 2);
  const sorted = Object.values(MATERIALS).map(abbeNumber);
  assert.ok(sorted.every((v, i) => i === 0 || v < sorted[i - 1]), 'materials listed from least to most dispersive');
});
