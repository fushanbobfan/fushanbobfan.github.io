import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAir, temperature } from '../src/air.js';
import { viewRows, viewAngles } from '../src/view.js';
import { foldChart, foldPaths, foldPoint, profileChart } from '../src/charts.js';

const scene = { eye: 1.2, distance: 300 };

function chartFor(airOpts, sc = scene) {
  const air = makeAir(airOpts);
  const rows = viewRows(air, sc, 160);
  return { air, rows, svg: foldChart(rows, viewAngles(air, sc), sc) };
}

const numbers = (svg) => [...svg.matchAll(/\s(?:x|y|cx|cy|x1|x2|y1|y2|width|height)="([^"]*)"/g)].map((m) => Number(m[1]));

test('over a hot road the chart shows a fold with an upside-down stretch below it', () => {
  const { rows, svg } = chartFor({});
  const fold = foldPoint(rows);
  assert.ok(fold);
  assert.ok(fold.zAtBoard > 0.03 && fold.zAtBoard < 0.2, fold.zAtBoard);
  assert.match(svg, /class="curve upright"/);
  assert.match(svg, /class="curve inverted"/);
  assert.match(svg, /fold: nothing below \d+ cm is seen/);
  assert.match(svg, /falls to \d+ cm and then rises again/);
  assert.match(svg, />0\.20° below</);
  assert.doesNotMatch(svg, />-/);
  for (const v of numbers(svg)) assert.ok(Number.isFinite(v));
});

test('without heating the chart has one upright curve and no fold', () => {
  const { rows, svg } = chartFor({ surface: 30, air: 30 });
  assert.equal(foldPoint(rows), null);
  assert.doesNotMatch(svg, /inverted/);
  assert.doesNotMatch(svg, /fold:/);
  assert.match(svg, /falls steadily/);
  // Rays that end on the road before the board are marked at the edge.
  assert.match(svg, /class="road"/);
});

test('the curve breaks where rays end on the road and joins upright to inverted at the fold', () => {
  const rows = [
    { angle: 3, zAtBoard: 2, turned: false },
    { angle: 2, zAtBoard: 1, turned: false },
    { angle: 1, zAtBoard: 0.5, turned: false },
    { angle: 0, zAtBoard: 0.7, turned: true },
    { angle: -1, zAtBoard: 0.9, turned: true },
    { angle: -2, zAtBoard: null, turned: false },
    { angle: -3, zAtBoard: 0.4, turned: false },
    { angle: -4, zAtBoard: 0.3, turned: false },
  ];
  const id = (v) => v;
  const paths = foldPaths(rows, id, id, 2.5);
  assert.deepEqual(paths, [
    ['curve upright', 'M2.0,3.0L1.0,2.0L0.5,1.0'],
    ['curve inverted', 'M0.5,1.0L0.7,0.0L0.9,-1.0'],
    ['curve upright', 'M0.4,-3.0L0.3,-4.0'],
  ]);
  // Points off the right of the chart break the curve too.
  assert.deepEqual(foldPaths(rows.slice(0, 3), id, id, 1.5), [['curve upright', 'M1.0,2.0L0.5,1.0']]);
});

test('a fold above the board says the board has sunk, and stays on the chart', () => {
  const sc = { eye: 0.3, distance: 1500 };
  const { rows, svg } = chartFor({ surface: 75, air: 0, layer: 0.5 }, sc);
  const fold = foldPoint(rows);
  assert.ok(fold.zAtBoard > 10, fold.zAtBoard);
  assert.match(svg, /sunk out of sight/);
  assert.doesNotMatch(svg, /upside-down copy/);
  const cx = Number(svg.match(/class="mark" cx="([\d.]+)"/)[1]);
  assert.ok(cx > 0 && cx < 640, cx);
  assert.match(svg, /class="curve inverted"/);
  const ticks = [...svg.matchAll(/text-anchor="middle">(\d+(?:\.\d)?)</g)].map((m) => Number(m[1]));
  assert.ok(ticks.length >= 3 && ticks.length <= 8, ticks.join());
});

test('angle labels survive a wide view: a tall eye close to the board', () => {
  const { svg } = chartFor({ surface: 30, air: 30 }, { eye: 3, distance: 50 });
  assert.doesNotMatch(svg, /NaN/);
  assert.match(svg, />eye level</);
  const labels = [...svg.matchAll(/>(\d+(?:\.\d+)?)° (?:above|below)</g)];
  assert.ok(labels.length >= 2 && labels.length <= 8, labels.length);
});

test('the temperature profile runs from the road value to the air value', () => {
  const air = makeAir({ surface: 55, air: 30, layer: 0.1 });
  const svg = profileChart(air, scene);
  const d = svg.match(/class="temp" d="([^"]+)"/)[1];
  const pts = [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(pts.length, 121);
  // Hotter is further right, and the curve moves left as it climbs.
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i][0] <= pts[i - 1][0] + 1e-9);
    assert.ok(pts[i][1] < pts[i - 1][1]);
  }
  assert.ok(temperature(air, 0.8) < 30.01);
  assert.match(svg, /two-thirds of the change happens in the lowest 10 cm and 95% within 30 cm/);
  // 8 layers is 80 cm, below the eye at 1.2 m.
  assert.match(svg, /eye at 1\.2 m, above the chart/);
  assert.match(profileChart(makeAir({ layer: 0.5 }), scene), /class="eye"/);
  assert.match(profileChart(makeAir({ surface: 10, air: 25 }), scene), /warms towards 25 °C/);
  assert.match(profileChart(makeAir({ surface: 25, air: 25 }), scene), /nothing bends/);
});
