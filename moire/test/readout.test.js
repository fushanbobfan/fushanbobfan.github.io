import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayer } from '../src/gratings.js';
import { describe, fmt } from '../src/readout.js';

const deg = (d) => (d * Math.PI) / 180;

test('pixel counts read naturally', () => {
  assert.equal(fmt(12.345), '12.3');
  assert.equal(fmt(209.99), '210');
  assert.equal(fmt(Infinity), '∞');
});

test('line readout gives spacing, direction and how far fringes move', () => {
  const text = describe(makeLayer({ period: 10 }), makeLayer({ period: 10.5 }));
  assert.match(text, /every 210 px/);
  assert.match(text, /90\.0°/);
  assert.match(text, /move 20\.0 px/);
});

test('matching sheets and over-fine beats say so', () => {
  assert.match(describe(makeLayer(), makeLayer()), /no fringes/);
  assert.match(describe(makeLayer({ period: 8 }), makeLayer({ period: 8, angle: deg(50) })), /no broad fringes/);
  assert.match(describe(makeLayer({ kind: 'dots' }), makeLayer({ kind: 'dots' })), /no fringes/);
});

test('rings: concentric spacing, or hyperbolas between two centres', () => {
  assert.match(describe(makeLayer({ kind: 'rings', period: 10 }), makeLayer({ kind: 'rings', period: 11 })), /every 110 px/);
  assert.match(describe(makeLayer({ kind: 'rings' }), makeLayer({ kind: 'rings' })), /Drag the top sheet/);
  const two = describe(makeLayer({ kind: 'rings', period: 10 }), makeLayer({ kind: 'rings', period: 10, x: 80 }));
  assert.match(two, /80\.0 px apart\. 17 hyperbolic/);
});

test('mixed sheets get a qualitative account', () => {
  assert.match(describe(makeLayer({ kind: 'dots' }), makeLayer()), /dots over dots only/);
  assert.match(describe(makeLayer(), makeLayer({ kind: 'rings' })), /nearly parallel/);
});

test('a fine main beat hands over to a broad harmonic beat', () => {
  const text = describe(makeLayer({ period: 8, duty: 0.3 }), makeLayer({ period: 15.6, duty: 0.3 }));
  assert.match(text, /main beat repeats every 16\.4 px, too fine/);
  assert.match(text, /2 bars of the bottom sheet span about as far as 1 of the top/);
  assert.match(text, /every 312 px/);
  assert.match(text, /move 40\.0 px/);
  assert.match(text, /about 59% of a main beat's contrast/);
});

test('with half of each top period inked the second harmonic is gone', () => {
  const text = describe(makeLayer({ period: 8, duty: 0.3 }), makeLayer({ period: 15.6, duty: 0.5 }));
  assert.match(text, /no beat between the bars' harmonics up to the fourth is broad/);
});

test('unequal ring spacings are not called hyperbolas', () => {
  const text = describe(makeLayer({ kind: 'rings', period: 10 }), makeLayer({ kind: 'rings', period: 20, x: 80 }));
  assert.doesNotMatch(text, /hyperbolic fringes cross/);
  assert.match(text, /no longer hyperbolas/);
});
