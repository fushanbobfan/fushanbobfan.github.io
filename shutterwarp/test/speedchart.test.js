import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedChart, seenRpm, CHART } from '../src/speedchart.js';

const count = (s, re) => (s.match(re) || []).length;

test('the chart marks every standstill speed and the current speed, with no NaN', () => {
  const svg = speedChart({ blades: 3, fps: 30, rpm: 1100 });
  assert.equal(count(svg, /class="still"/g), 15); // 600, 1200, ... 9000
  assert.equal(count(svg, /class="here"/g), 1);
  assert.ok(!svg.includes('NaN'));
  assert.match(svg, /<desc id="speed-desc">[^<]*600, 1,200/);
  assert.match(svg, /At 1,100 rpm the video shows 100 rpm backwards\./);
});

test('the sawtooth starts a new piece at each jump and never draws a vertical line', () => {
  const svg = speedChart({ blades: 2, fps: 24, rpm: 0 });
  const d = svg.match(/class="saw" d="([^"]+)"/)[1];
  // The seen speed jumps just past 360, 1080, ... 8280 rpm: every 720 rpm from 360.
  // At 9000 rpm the turn is exactly half a spacing, which still counts as forwards.
  assert.equal(count(d, /M/g), 1 + 12);
  const pts = [...d.matchAll(/([ML])([\d.]+),([\d.]+)/g)].map((m) => ({ c: m[1], x: +m[2], y: +m[3] }));
  const span = CHART.h - CHART.top - CHART.bottom;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].c === 'L') assert.ok(Math.abs(pts[i].y - pts[i - 1].y) < span / 4);
  }
});

test('seen speeds are measured in the real direction', () => {
  assert.equal(seenRpm(590, 3, 30).toFixed(6), (-10).toFixed(6));
  assert.equal(seenRpm(100, 3, 30).toFixed(6), (100).toFixed(6));
  assert.match(speedChart({ blades: 3, fps: 30, rpm: 600 }), /the video shows standing still/);
});

test('the chart description agrees with the video readout at the edges', () => {
  assert.match(speedChart({ blades: 3, fps: 30, rpm: 300 }), /At 300 rpm the video shows 300 rpm, direction ambiguous\./);
  const none = speedChart({ blades: 1, fps: 240, rpm: 0 });
  assert.match(none, /Above zero it never seems to stand still in this range\. At 0 rpm the video shows standing still\./);
  assert.match(speedChart({ blades: 8, fps: 25, rpm: 187.5 }), /187\.5, 375/);
});
