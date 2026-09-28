import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, buildScene, sceneScale } from '../src/scenes.js';
import { trace } from '../src/tracer.js';
import { PARAMS } from '../src/params.js';

const brightestEscape = (segments) => segments
  .filter((s) => s.fate === 'escape')
  .reduce((a, b) => (b.intensity > a.intensity ? b : a));
const dir = (s) => {
  const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  return { x: (s.x2 - s.x1) / l, y: (s.y2 - s.y1) / l };
};

test('scene ids are unique and every scene has a name and a note', () => {
  const ids = SCENES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SCENES) assert.ok(s.name && s.note, s.id);
  assert.equal(buildScene('nope', 900, 600), null);
});

test('every scene fits the canvas, keeps parameters in range and traces within limits', () => {
  for (const [w, h] of [[900, 600], [360, 420], [1500, 700]]) {
    for (const s of SCENES) {
      const bench = buildScene(s.id, w, h);
      assert.ok(bench.length > 0);
      for (const el of bench) {
        assert.ok(el.x >= 0 && el.x <= w && el.y >= 0 && el.y <= h, `${s.id} ${el.kind} off canvas at ${w}x${h}`);
        for (const spec of PARAMS[el.kind]) {
          assert.ok(el[spec.key] >= spec.min && el[spec.key] <= spec.max, `${s.id} ${el.kind}.${spec.key}=${el[spec.key]}`);
        }
      }
      const { stats } = trace(bench);
      assert.equal(stats.truncated, false, s.id);
    }
  }
});

test('scenes shrink to fit a small canvas but never grow past their design size', () => {
  assert.equal(sceneScale(900, 600), 1);
  assert.equal(sceneScale(450, 600), 0.5);
  assert.equal(sceneScale(100, 100), 0.4);
  assert.equal(sceneScale(5000, 5000), 1);
});

test('the periscope sends the laser out parallel to how it came in, higher up', () => {
  const bench = buildScene('periscope', 900, 600);
  const { segments } = trace(bench);
  const out = brightestEscape(segments);
  const laser = bench.find((el) => el.kind === 'laser');
  assert.ok(Math.abs(dir(out).x - 1) < 1e-9);
  assert.ok(out.y1 < laser.y - 200);
  assert.ok(out.intensity > 0.8);
});

test('the light pipe carries most of the laser to the far end', () => {
  const bench = buildScene('pipe', 900, 600);
  const rod = bench.find((el) => el.kind === 'block');
  const { segments } = trace(bench);
  const out = brightestEscape(segments);
  assert.ok(Math.abs(out.x1 - (rod.x + rod.width / 2)) < 1e-6);
  assert.ok(out.intensity > 0.8);
  const bounces = segments.filter((s) => s.intensity > 0.5 && s.fate === 'glass').length;
  assert.ok(bounces >= 6, `${bounces} surface hits`);
});

test('in the whispering gallery a fixed share of the light stays trapped in the ball', () => {
  const bench = buildScene('gallery', 900, 600);
  const [ball, lamp] = bench;
  const { segments, stats } = trace(bench);
  // A ray from the lamp at distance d from the centre, leaving at angle phi to
  // the radius, meets every surface at incidence asin(d sin(phi) / R).
  const d = Math.hypot(lamp.x - ball.x, lamp.y - ball.y);
  const n = 1.72;
  const phis = Array.from({ length: lamp.count }, (_, i) => (2 * Math.PI * i) / lamp.count);
  const trapped = phis.filter((phi) => Math.abs(d * Math.sin(phi)) / ball.radius > 1 / n + 0.02).length;
  assert.ok(trapped > 10);
  assert.ok(stats.lost > 0.8 * trapped, `lost ${stats.lost} of ${trapped} trapped rays`);
  const inside = segments.filter((s) => s.fate === 'glass' && s.intensity > 0.9);
  for (const s of inside) {
    assert.ok(Math.hypot(s.x2 - ball.x, s.y2 - ball.y) < ball.radius + 1e-6);
  }
});
