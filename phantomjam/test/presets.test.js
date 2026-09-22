import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_PRESET_ID, getPreset } from '../src/presets.js';
import { createRoad, step, deterministicFlow } from '../src/traffic.js';
import { createRng } from '../src/rng.js';

function settle(preset, cells, warm, measure, seed = 1) {
  const road = createRoad({ cells, density: preset.density, vmax: preset.vmax, slow: preset.slow, rng: createRng(seed) });
  for (let i = 0; i < warm; i++) step(road);
  let flow = 0;
  let speed = 0;
  let stoppedSteps = 0;
  for (let i = 0; i < measure; i++) {
    const s = step(road);
    flow += s.flow;
    speed += s.meanSpeed;
    if (s.stopped > 0) stoppedSteps += 1;
  }
  return { flow: flow / measure, meanSpeed: speed / measure, stoppedFraction: stoppedSteps / measure, road };
}

test('presets have unique ids, names, descriptions and sane parameters', () => {
  const ids = new Set(PRESETS.map((p) => p.id));
  assert.equal(ids.size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.name.length > 0);
    assert.ok(p.description.length > 20);
    assert.ok(p.density > 0 && p.density <= 1);
    assert.ok(Number.isInteger(p.vmax) && p.vmax >= 1 && p.vmax <= 9);
    assert.ok(p.slow >= 0 && p.slow <= 1);
  }
});

test('getPreset falls back to the default for unknown ids', () => {
  assert.equal(getPreset('free').id, 'free');
  assert.equal(getPreset('nope').id, DEFAULT_PRESET_ID);
  assert.equal(getPreset(undefined).id, DEFAULT_PRESET_ID);
});

test('free flow keeps almost everyone near the speed limit', () => {
  const p = getPreset('free');
  const r = settle(p, 300, 500, 500);
  assert.ok(r.meanSpeed > 0.9 * p.vmax, `mean speed ${r.meanSpeed}`);
});

test('phantom jams: mostly free traffic that still stalls somewhere much of the time', () => {
  const p = getPreset('phantom');
  const r = settle(p, 400, 1000, 2000);
  assert.ok(r.meanSpeed > 0.5 * p.vmax, `mean speed ${r.meanSpeed}`);
  assert.ok(r.stoppedFraction > 0.2, `stopped fraction ${r.stoppedFraction}`);
});

test('gridlock crawls', () => {
  const p = getPreset('gridlock');
  const r = settle(p, 300, 500, 500);
  assert.ok(r.meanSpeed < 0.6, `mean speed ${r.meanSpeed}`);
  assert.equal(r.stoppedFraction, 1);
});

test('clockwork drivers reproduce the deterministic triangle', () => {
  const p = getPreset('clockwork');
  const r = settle(p, 300, 1500, 300);
  assert.ok(Math.abs(r.flow - deterministicFlow(p.density, p.vmax)) < 0.01, `flow ${r.flow}`);
});

test('stop and go carries less flow than phantom jams despite twice the cars', () => {
  const a = settle(getPreset('phantom'), 400, 1000, 1500);
  const b = settle(getPreset('stopgo'), 400, 1000, 1500);
  assert.ok(b.flow < a.flow, `${b.flow} vs ${a.flow}`);
});

test('city street tolerates its density better than the highway would', () => {
  const city = getPreset('city');
  const r = settle(city, 300, 500, 500);
  const highway = settle({ ...city, vmax: 5 }, 300, 500, 500);
  assert.ok(r.meanSpeed / city.vmax > highway.meanSpeed / 5);
});
