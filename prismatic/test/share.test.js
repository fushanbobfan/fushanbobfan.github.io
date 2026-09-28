import test from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, DEFAULTS } from '../src/elements.js';
import { encodeBench, decodeBench } from '../src/share.js';
import { PARAMS } from '../src/params.js';

const strip = ({ id, ...rest }) => rest;

test('every kind of element survives a round trip', () => {
  const bench = Object.keys(DEFAULTS).map((kind, i) => makeElement(kind, 10 * i + 0.25, 300 - i, i * 0.3));
  bench.find((el) => el.kind === 'beam').light = 'white';
  bench.find((el) => el.kind === 'concaveLens').material = 'sf10';
  const back = decodeBench(encodeBench(bench));
  assert.equal(back.length, bench.length);
  back.forEach((el, i) => {
    const orig = bench[i];
    assert.equal(el.kind, orig.kind);
    assert.ok(Math.abs(el.x - orig.x) <= 0.05 + 1e-9);
    assert.ok(Math.abs(el.y - orig.y) <= 0.05 + 1e-9);
    assert.ok(Math.abs(el.angle - orig.angle) < 0.002);
    for (const spec of PARAMS[el.kind]) assert.ok(Math.abs(el[spec.key] - orig[spec.key]) <= 0.05 + 1e-9);
    assert.equal(el.material, orig.material);
    assert.equal(el.light, orig.light);
    assert.notEqual(el.id, orig.id);
  });
});

test('links are URL-safe', () => {
  const code = encodeBench([makeElement('beam', 1, 2, 0, { light: 'white' })]);
  assert.match(code, /^v1\.[A-Za-z0-9_-]+$/);
});

test('an empty bench round-trips', () => {
  assert.deepEqual(decodeBench(encodeBench([])), []);
});

test('malformed or hostile input is rejected rather than half-loaded', () => {
  const enc = (items) => `v1.${Buffer.from(JSON.stringify(items)).toString('base64url')}`;
  assert.equal(decodeBench(''), null);
  assert.equal(decodeBench('v2.abc'), null);
  assert.equal(decodeBench('v1.%%%'), null);
  assert.equal(decodeBench(enc({ not: 'a list' })), null);
  assert.equal(decodeBench(enc([['wormhole', 0, 0, 0, {}]])), null);
  assert.equal(decodeBench(enc([['__proto__', 0, 0, 0, {}]])), null);
  assert.equal(decodeBench(enc([['prism', 'x', 0, 0, {}]])), null);
  assert.equal(decodeBench(enc(Array.from({ length: 201 }, () => ['laser', 0, 0, 0, {}]))), null);
});

test('out-of-range and unknown parameters are clamped or ignored', () => {
  const enc = (items) => `v1.${Buffer.from(JSON.stringify(items)).toString('base64url')}`;
  const [prism] = decodeBench(enc([['prism', 5, 5, 0, { apex: 9999, material: 'cheese', evil: 1 }]]));
  assert.equal(prism.apex, 120);
  assert.equal(prism.material, 'bk7');
  assert.equal(prism.evil, undefined);
  assert.deepEqual(strip(prism), strip({ ...makeElement('prism', 5, 5), apex: 120 }));
});
