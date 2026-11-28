import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rpmLabel, angleLabel, pushLabel, seconds, perSecond, shapeLabel, describe, fallStory } from '../src/readout.js';
import { makeView, pathPoint, potentialCurve, potentialRange } from '../src/draw.js';
import { TOY, bodyAxes, thetaAccel, constants, turningPoints, classify, floorAngle, rpmToRad, steadyPrecession, effectivePotential } from '../src/top.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const deg = Math.PI / 180;

test('every element the script looks up by id is on the page', () => {
  const ids = new Set([...main.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size >= 15);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('every slider and preset starts inside the limits and on a step', () => {
  const ranges = {};
  for (const m of html.matchAll(/<input id="([\w-]+)" type="range" min="([-\d.]+)" max="([\d.]+)" step="([\d.]+)" value="([-\d.]+)">/g)) {
    const [min, max, step, value] = m.slice(2).map(Number);
    ranges[m[1]] = [min, max, step];
    assert.ok(value >= min && value <= max, m[1]);
  }
  assert.deepEqual(Object.keys(ranges).sort(), ['push', 'rpm', 'tilt']);
  let presets = 0;
  for (const m of html.matchAll(/<button type="button"((?: data-\w+="[-\d.]+")+)>([^<]+)</g)) {
    presets++;
    const data = Object.fromEntries([...m[1].matchAll(/data-(\w+)="([-\d.]+)"/g)].map((d) => [d[1], Number(d[2])]));
    for (const k of Object.keys(ranges)) {
      const [min, max, step] = ranges[k];
      assert.ok(data[k] >= min && data[k] <= max, `${m[2]}: ${k}`);
      const steps = (data[k] - min) / step;
      assert.ok(Math.abs(steps - Math.round(steps)) < 1e-9, `${m[2]}: ${k} on a step`);
    }
  }
  assert.equal(presets, 7);
  // The tilt slider stops short of the angle where the rim meets the table.
  assert.ok(ranges.tilt[1] * deg < floorAngle());
});

test('each preset shows the motion its name promises', () => {
  const expect = {
    'Let go from rest': 'cusps',
    'Steady cone': 'steady',
    'Pushed ahead': 'waves',
    'Pushed back': 'loops',
    'Too slow': 'falls',
    'Nearly upright, fast': 'cusps',
    'Nearly upright, slow': 'falls',
  };
  for (const m of html.matchAll(/<button type="button" data-rpm="([\d.]+)" data-tilt="([\d.]+)" data-push="([-\d.]+)">([^<]+)</g)) {
    const [rpm, tilt, push] = m.slice(1, 4).map(Number);
    const omega3 = rpmToRad(rpm);
    const sp = steadyPrecession(tilt * deg, omega3);
    const ref = sp ? sp.slow : TOY.mgl / (TOY.I3 * omega3);
    const c = constants({ theta: tilt * deg, phiDot: push * ref, omega3 });
    const tp = turningPoints(c);
    const got = tp.thetaMax >= floorAngle() ? 'falls' : classify(c, tp);
    assert.equal(got, expect[m[4]], m[4]);
  }
});

test('the page loads only relative files', () => {
  let checked = 0;
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    checked++;
    if (m[1].startsWith('https://github.com/')) continue;
    assert.ok(!m[1].startsWith('/') && !m[1].includes('://'), m[1]);
  }
  assert.ok(checked >= 3);
});

test('labels read naturally', () => {
  assert.equal(rpmLabel(2000), '2,000 rpm (33 turns a second)');
  assert.equal(rpmLabel(300), '300 rpm (5 turns a second)');
  assert.equal(rpmLabel(330), '330 rpm (5.5 turns a second)');
  assert.equal(angleLabel(25 * deg), '25°');
  assert.equal(angleLabel(3.2 * deg, 1), '3.2°');
  assert.equal(pushLabel(0), 'none: let go from rest');
  assert.equal(pushLabel(1), 'exactly the steady rate');
  assert.equal(pushLabel(1.8), '1.8 × the steady rate');
  assert.equal(pushLabel(-0.75), '0.75 × the steady rate, backwards');
  assert.equal(seconds(0.1436), '144 ms');
  assert.equal(seconds(1.396), '1.40 s');
  assert.equal(seconds(12.34), '12.3 s');
  assert.equal(seconds(Infinity), '—');
  assert.equal(perSecond(0.1436), '7.0 a second');
  assert.equal(perSecond(0.088), '11 a second');
  assert.equal(shapeLabel('loops', false), 'loops');
  assert.equal(shapeLabel('cusps', true), 'none: it falls over');
  assert.match(fallStory(0.115, floorAngle()), /115 ms .* 53°/);
});

test('the story matches the motion and shows narrow nods with a decimal', () => {
  const base = { tilt: 25 * deg, floor: floorAngle(), touches: false, push: 0, precessionPeriod: 1.4 };
  assert.match(describe({ ...base, kind: 'cusps', thetaMin: 25 * deg, thetaMax: 30 * deg }), /from 25° to 30°.*cusps/);
  assert.match(describe({ ...base, kind: 'cusps', thetaMin: 3 * deg, thetaMax: 3.2 * deg }), /from 3\.0° to 3\.2°/);
  assert.match(describe({ ...base, kind: 'waves', push: 2.5, rises: true, thetaMin: 0.0104 * deg, thetaMax: 17 * deg }), /between 0\.01° and 17°/);
  assert.match(describe({ ...base, kind: 'loops', thetaMin: 25 * deg, thetaMax: 34 * deg }), /backwards.*loops/);
  assert.match(describe({ ...base, kind: 'waves', push: 1.8, rises: true, thetaMin: 21 * deg, thetaMax: 25 * deg }), /1\.8 × the steady rate, the top first rises.*waves/);
  assert.match(describe({ ...base, kind: 'waves', push: 0.5, rises: false, thetaMin: 25 * deg, thetaMax: 27 * deg }), /first sinks.*waves/);
  assert.match(describe({ ...base, kind: 'steady', thetaMin: 25 * deg, thetaMax: 25 * deg }), /cone, once every 1\.40 s/);
  assert.match(describe({ ...base, touches: true, kind: 'cusps', thetaMin: 25 * deg, thetaMax: 83 * deg }), /With this spin and push.*out to 83°, and the rim hits the table at 53°/);
  assert.match(describe({ ...base, touches: true, kind: 'cusps', thetaMin: 25 * deg, thetaMax: Math.PI / 2 }), /beyond the horizontal/);
});

test('the body axes are orthonormal and the axle leans towards phi', () => {
  const { e1, e2, e3 } = bodyAxes(0.4, 1.1, 2.3);
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  for (const [p, q, want] of [[e1, e1, 1], [e2, e2, 1], [e3, e3, 1], [e1, e2, 0], [e1, e3, 0], [e2, e3, 0]]) {
    assert.ok(Math.abs(dot(p, q) - want) < 1e-12);
  }
  assert.ok(Math.abs(Math.acos(e3[2]) - 0.4) < 1e-12);
  assert.ok(Math.abs(Math.atan2(e3[1], e3[0]) - 1.1) < 1e-12);
  // Right-handed, so a positive spin turns e1 towards e2.
  const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  assert.ok(cross.every((v, i) => Math.abs(v - e3[i]) < 1e-12));
});

test('the camera keeps the tip in place and looks down from above', () => {
  const view = makeView(640, 440, 1000);
  const [x0, y0] = view.project([0, 0, 0]);
  const [, yUp] = view.project([0, 0, 0.01]);
  assert.ok(yUp < y0);
  assert.equal(x0, 320);
  assert.ok(Math.abs(Math.hypot(...view.toward) - 1) < 1e-12);
  assert.ok(view.toward[2] > 0);
  // A point straight along `toward` lands on the same pixel as the tip.
  const [xt, yt] = view.project(view.toward.map((v) => v * 0.01));
  assert.ok(Math.abs(xt - x0) < 1e-9 && Math.abs(yt - y0) < 1e-9);
});

test('the map puts tilt as distance from the centre', () => {
  const [x, y] = pathPoint(0, 0, 440, 1);
  assert.deepEqual([x, y], [220, 220]);
  const [xr] = pathPoint(0.5, 0, 440, 1);
  const [, yu] = pathPoint(0.5, Math.PI / 2, 440, 1);
  assert.ok(Math.abs(xr - 220 - (220 - 14) / 2) < 1e-9);
  assert.ok(Math.abs(220 - yu - (220 - 14) / 2) < 1e-9);
});

test('the potential curve is the effective potential and dips inside the band', () => {
  const c = constants({ theta: 25 * deg, phiDot: 0, omega3: rpmToRad(2000) });
  const tp = turningPoints(c);
  const pts = potentialCurve(c, tp);
  assert.ok(pts.every(([t, v]) => v === effectivePotential(t, c)));
  assert.ok(pts.every((p, i) => i === 0 || p[0] >= pts[i - 1][0]));
  const lowest = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
  assert.ok(lowest[0] > tp.thetaMin && lowest[0] < tp.thetaMax);
});

test('the energy chart range always runs upwards and contains the energy', () => {
  const omega = rpmToRad(2000);
  const steady = steadyPrecession(25 * deg, omega);
  for (const rel of [
    { theta: 25 * deg, phiDot: steady.slow, omega3: omega },
    { theta: 2 * deg, phiDot: 0, omega3: rpmToRad(5000) },
    { theta: 25 * deg, phiDot: 0, omega3: omega },
  ]) {
    const c = constants(rel);
    const tp = turningPoints(c);
    const E = 0.5 * c.top.I1 * c.alpha;
    const { ylo, yhi } = potentialRange(potentialCurve(c, tp), E, c.top.mgl);
    assert.ok(ylo < E && E < yhi);
    assert.ok(effectivePotential(0.5 * (tp.thetaMin + tp.thetaMax), c) >= ylo);
  }
});

test('the story says sinks or rises from the actual first motion', () => {
  // Pushed past both steady rates at 1,100 rpm the top sinks, though the push is above 1.
  const omega3 = rpmToRad(1100);
  const sp = steadyPrecession(25 * deg, omega3);
  const c = constants({ theta: 25 * deg, phiDot: 2.5 * sp.slow, omega3 });
  assert.ok(2.5 * sp.slow > sp.fast);
  assert.ok(thetaAccel(25 * deg, c) > 0);
  const c2 = constants({ theta: 25 * deg, phiDot: 1.8 * steadyPrecession(25 * deg, rpmToRad(2000)).slow, omega3: rpmToRad(2000) });
  assert.ok(thetaAccel(25 * deg, c2) < 0);
});
