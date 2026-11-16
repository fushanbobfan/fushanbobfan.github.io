import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeView, toView, fromView, frameToView, frameGrid, frameAxes, simultaneityLine,
  invariantHyperbola, pick, labelFor,
} from '../src/diagram.js';
import { boost } from '../src/lorentz.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('the view maps the origin to the centre and t up the canvas', () => {
  const v = makeView(600, 5);
  assert.deepEqual(v.toCanvas({ t: 0, x: 0 }), [300, 300]);
  assert.deepEqual(v.toCanvas({ t: 5, x: -5 }), [0, 0]);
  const back = v.fromCanvas(450, 120);
  const again = v.toCanvas(back);
  close(again[0], 450);
  close(again[1], 120);
});

test('toView and fromView undo each other', () => {
  const e = { t: 1.5, x: -2 };
  const back = fromView(toView(e, 0.7), 0.7);
  close(back.t, e.t);
  close(back.x, e.x);
});

test('a frame viewed from itself draws its axes upright and level', () => {
  const ax = frameAxes(0.6, 0.6, 3);
  close(ax.time[0].x, 0);
  close(ax.time[1].x, 0);
  close(ax.space[0].t, 0);
  close(ax.space[1].t, 0);
  close(ax.velocity, 0);
});

test('a moving frame tilts its time axis by its speed and its space axis by the same slope', () => {
  const ax = frameAxes(0.5, 0, 2);
  const [p, q] = ax.time;
  close((q.x - p.x) / (q.t - p.t), 0.5);
  const [r, s] = ax.space;
  close((s.t - r.t) / (s.x - r.x), 0.5);
});

test('grid lines keep their meaning in any view', () => {
  const lines = frameGrid(0.4, -0.3, 5);
  const place = lines.find((l) => l.kind === 'place' && l.value === 2);
  const moment = lines.find((l) => l.kind === 'moment' && l.value === -1);
  const inFrame = (p) => boost(fromView(p, -0.3), 0.4);
  close(inFrame(place.a).x, 2);
  close(inFrame(place.b).x, 2);
  close(inFrame(moment.a).t, -1);
  close(inFrame(moment.b).t, -1);
});

test('frameToView with equal frames leaves points alone', () => {
  const p = frameToView({ t: 1, x: 2 }, 0.3, 0.3);
  close(p.t, 1);
  close(p.x, 2);
});

test('simultaneity lines pass through the event and hold that frame\'s time fixed', () => {
  const e = { t: 1, x: 1 };
  const [a, b] = simultaneityLine(e, 0.5, 0, 4);
  close(boost(a, 0.5).t, boost(e, 0.5).t);
  close(boost(b, 0.5).t, boost(e, 0.5).t);
  // the event lies on the segment between a and b
  const frac = (e.x - a.x) / (b.x - a.x);
  close(a.t + frac * (b.t - a.t), e.t);
});

test('hyperbola points have the stated interval from the origin', () => {
  for (const s2 of [1, 4, -1, -9]) {
    for (const branch of invariantHyperbola(s2, 6)) {
      for (const p of branch) close(p.t * p.t - p.x * p.x, s2, 1e-9);
    }
  }
});

test('pick finds the drawn event under the pointer', () => {
  const v = makeView(600, 5);
  const events = [{ t: 0, x: 0 }, { t: 2, x: 1 }];
  const [px, py] = v.toCanvas(toView(events[1], 0.5));
  assert.equal(pick(events, 0.5, v, px + 3, py - 2), 1);
  assert.equal(pick(events, 0.5, v, 5, 5), -1);
});

test('events are labelled A, B, C...', () => {
  assert.equal(labelFor(0), 'A');
  assert.equal(labelFor(2), 'C');
});
