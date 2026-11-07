import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERNODE_PATCHES, NODE_DENSITY, advance, fibre, firePulse, isNode, makeCable, measureSpeed, sheathFactor, stepFor,
  stripInternode,
} from '../src/cable.js';

const span = (count, fraction) => Math.round((count * fraction) / INTERNODE_PATCHES) * INTERNODE_PATCHES;

function speeds(diameter, celsius = 18.5, stripped = 0) {
  const f = fibre(diameter, celsius);
  const dt = stepFor(celsius);
  const n = f.sheathed.count;
  const start = span(n, 0.5);
  return {
    bare: measureSpeed(f.bare, { dt }),
    sheathed: measureSpeed(f.sheathed, {
      dt,
      from: span(n, 0.2),
      to: span(n, 0.95),
      stripped: Array.from({ length: stripped }, (_, k) => start + k * INTERNODE_PATCHES + 1),
    }),
  };
}

test('both versions of a fibre cover the same stretch', () => {
  for (const d of [0.3, 1, 10, 200]) {
    const f = fibre(d);
    const bare = (f.bare.count - 1) * f.bare.dx;
    const sheathed = (f.sheathed.count - 1) * f.sheathed.dx;
    assert.ok(Math.abs(bare - f.length) < 1e-9);
    assert.ok(Math.abs(sheathed - f.length) / f.length < 0.03, `d ${d}: ${sheathed} vs ${f.length}`);
    assert.ok((f.sheathed.count - 1) / INTERNODE_PATCHES >= 20);
  }
});

test('nodes carry channels and the sheath carries none', () => {
  const cable = makeCable(fibre(10).sheathed);
  assert.ok(isNode(cable, 0) && isNode(cable, 10) && !isNode(cable, 5));
  assert.equal(cable.gNa[10], 120 * NODE_DENSITY);
  assert.equal(cable.gNa[5], 0);
  assert.ok(cable.cm[5] < cable.cm[10]);
});

test('a sheathed cable at rest does not move', () => {
  const cable = makeCable(fibre(10).sheathed);
  for (let i = 0; i < 2000; i++) advance(cable, 0.01);
  for (const v of cable.v) assert.ok(Math.abs(v + 65) < 0.01, `v ${v}`);
});

test('at 10 µm the sheath more than triples the speed', () => {
  const { bare, sheathed } = speeds(10);
  assert.ok(Math.abs(bare - 2.71) < 0.05, `bare ${bare}`);
  assert.ok(sheathed / bare > 3, `ratio ${sheathed / bare}`);
});

test('the sheath gains on the bare axon as fibres go from thin to 10 µm', () => {
  const ratio = (d) => {
    const s = speeds(d);
    return s.sheathed / s.bare;
  };
  const thin = ratio(0.3);
  assert.ok(thin > 1.2 && thin < 1.4, `0.3 µm ratio ${thin}`);
  assert.ok(ratio(1) > thin && ratio(10) > ratio(1));
});

test('wraps grow with the fibre', () => {
  assert.equal(sheathFactor(10), 100);
  assert.ok(sheathFactor(0.1) >= 2);
});

test('every fibre on the slider conducts, at every usual temperature', () => {
  for (const d of [0.3, 1, 10, 100, 200]) {
    for (const celsius of [6.3, 18.5]) {
      const s = speeds(d, celsius);
      assert.ok(s.bare > 0, `bare ${d} at ${celsius}`);
      assert.ok(s.sheathed > 0, `sheathed ${d} at ${celsius}`);
    }
  }
  for (const d of [0.5, 1, 10, 100]) assert.ok(speeds(d, 25).sheathed > 0, `sheathed ${d} at 25`);
});

test('stripping myelin slows the spike, and a fourth stretch in a row stops it', () => {
  const at = (k) => speeds(10, 18.5, k).sheathed;
  const whole = at(0);
  const one = at(1);
  const three = at(3);
  assert.ok(one < whole && three < one, `${whole} ${one} ${three}`);
  assert.ok(three > 0);
  assert.equal(at(4), null);
});

test('stripping keeps a cable at rest and returns the internode it found', () => {
  const cable = makeCable(fibre(10).sheathed);
  assert.equal(stripInternode(cable, 57), 50);
  assert.equal(cable.cm[55], 1);
  for (let i = 0; i < 1000; i++) advance(cable, 0.01);
  for (const v of cable.v) assert.ok(Math.abs(v + 65) < 0.01);
  assert.equal(stripInternode(makeCable(fibre(10).bare), 57), null);
});

test('at 10 µm and 34 degrees the bare axon fails while the sheathed one runs', () => {
  assert.ok(speeds(10, 33).bare > 0);
  const s = speeds(10, 34);
  assert.equal(s.bare, null);
  assert.ok(s.sheathed > 0);
});

test('a thick sheathed fibre fails earlier than a thin one when warmed', () => {
  assert.equal(speeds(100, 28).sheathed, null);
  assert.ok(speeds(10, 28).sheathed > 0);
});

test('a spike on a thin warm fibre keeps its height while staying under 0 mV', () => {
  const f = fibre(0.4, 25);
  const cable = makeCable(f.sheathed);
  firePulse(cable, 10);
  const peaks = new Float64Array(cable.count).fill(-200);
  while (cable.time < 30) {
    advance(cable, stepFor(25));
    for (let i = 0; i < cable.count; i++) peaks[i] = Math.max(peaks[i], cable.v[i]);
  }
  const quarter = peaks[Math.round(cable.count / 40) * 10];
  const end = peaks[Math.round((cable.count * 3) / 40) * 10];
  assert.ok(quarter < 0 && quarter > -20, `peak ${quarter}`);
  assert.ok(Math.abs(end - quarter) < 2, `${quarter} to ${end}`);
  assert.ok(speeds(0.4, 25).sheathed > 0);
});

test('a sheathed spike can be fired from the far end too', () => {
  const cable = makeCable(fibre(10).sheathed);
  firePulse(cable, cable.count - 11);
  let reached = false;
  while (cable.time < 6 && !reached) {
    advance(cable, 0.01);
    reached = cable.v[10] > 0;
  }
  assert.ok(reached);
});
