import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenValue, valueToken, decode, encode } from '../src/rle.js';

test('tokens map onto 0..255', () => {
  assert.equal(tokenValue('.'), 0);
  assert.equal(tokenValue('b'), 0);
  assert.equal(tokenValue('A'), 1);
  assert.equal(tokenValue('X'), 24);
  assert.equal(tokenValue('pA'), 25);
  assert.equal(tokenValue('pX'), 48);
  assert.equal(tokenValue('qA'), 49);
  assert.equal(tokenValue('yO'), 255);
  assert.equal(tokenValue('o'), 255);
  for (let v = 0; v <= 255; v++) assert.equal(tokenValue(valueToken(v)), v);
  assert.throws(() => valueToken(256), RangeError);
});

test('decoding repeats tokens, pads short rows and skips rows', () => {
  const g = decode('2A.pA$$yO!');
  assert.equal(g.width, 4);
  assert.equal(g.height, 3);
  assert.deepEqual(Array.from(g.data, (v) => Math.round(v * 255)), [1, 1, 0, 25, 0, 0, 0, 0, 255, 0, 0, 0]);
  const skip = decode('A2$A!');
  assert.equal(skip.height, 3);
});

test('decoding ignores whitespace and stops at the end mark', () => {
  const g = decode('3B $\n 2C ! junk-after-end');
  assert.equal(g.width, 3);
  assert.equal(g.height, 2);
  assert.throws(() => decode('A#B'), SyntaxError);
});

test('encoding round-trips through decoding', () => {
  const text = '7.MD6.qL$6.pKqEqFURpApBRAqQ$5.VqTrSsBrOpXpWpTpWpUpCrQ!';
  const g = decode(text);
  assert.equal(encode(g), text);
  const again = decode(encode(g));
  assert.deepEqual(again, g);
});
