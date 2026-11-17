import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSheet, decodeState, encodeSheet, encodeState } from '../src/permalink.js';

const sheet = (props) => ({ kind: 'lines', period: 8, angleDeg: 0, duty: 0.5, dx: 0, dy: 0, ...props });

test('a view survives the round trip through a link', () => {
  const state = {
    scene: 'two-centres',
    sheets: [sheet({ kind: 'rings', period: 10, dx: -40 }), sheet({ kind: 'dots', period: 9.25, angleDeg: 173.4, duty: 0.35, dx: 12.5, dy: -3 })],
    blur: true,
    predict: false,
    tint: true,
  };
  const hash = encodeState(state);
  assert.deepEqual(decodeState(`#${hash}`), state);
});

test('links stay short and readable', () => {
  const hash = encodeState({ scene: 'turned', sheets: [sheet(), sheet({ angleDeg: 5 })], blur: false, predict: true, tint: false });
  assert.equal(hash, 's=turned&a=l,8,0,0.5,0,0&b=l,8,5,0.5,0,0&v=p');
});

test('sheet values are rounded to what the controls can set', () => {
  const text = encodeSheet(sheet({ period: 10.4999, angleDeg: -0.123, duty: 0.333, dx: 1.06 }));
  assert.equal(text, 'l,10.5,-0.12,0.33,1.1,0');
});

test('out-of-range values are clamped', () => {
  const s = decodeSheet('d,500,1,5,99999,-99999');
  assert.equal(s.period, 30);
  assert.equal(s.duty, 0.9);
  assert.equal(s.dx, 4000);
  assert.equal(s.dy, -4000);
});

test('malformed links fall back to nothing', () => {
  assert.equal(decodeSheet('x,8,0,0.5,0,0'), null);
  assert.equal(decodeSheet('l,8,0,0.5,0'), null);
  assert.equal(decodeSheet('l,eight,0,0.5,0,0'), null);
  assert.equal(decodeSheet('l,8,0,0.5,0,Infinity'), null);
  const state = decodeState('#s=turned&a=l,8,0,0.5,0,0&b=nonsense');
  assert.equal(state.sheets, null);
  assert.equal(state.scene, 'turned');
  assert.deepEqual(decodeState(''), { scene: null, sheets: null, blur: false, predict: false, tint: false });
});

test('angles beyond a whole turn fold back without changing the pattern', () => {
  assert.equal(decodeSheet('l,8,365,0.5,0,0').angleDeg, 5);
  assert.equal(decodeSheet('l,8,-270,0.5,0,0').angleDeg, 90);
  assert.ok(Math.abs(decodeSheet('l,8,1e300,0.5,0,0').angleDeg) <= 180);
});

test('the offsets the page allows all survive a link', () => {
  for (const dx of [-4000, -3999.9, 0, 3999.9, 4000]) {
    assert.equal(decodeSheet(encodeSheet(sheet({ dx }))).dx, dx);
  }
});
