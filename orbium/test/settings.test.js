import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize, toHash, fromHash, ruleOf } from '../src/settings.js';

test('an empty or broken input gives the defaults', () => {
  assert.deepEqual(normalize(), { ...DEFAULTS });
  assert.deepEqual(fromHash(''), { ...DEFAULTS });
  const s = normalize({ size: 300, mu: 'x', species: 'dragon', rings: '1,9', view: 'nope', palette: 'neon', scale: 9 });
  assert.equal(s.size, 256);
  assert.equal(s.mu, 0.15);
  assert.equal(s.species, 'orbium');
  assert.equal(s.rings, '1');
  assert.equal(s.view, 'cells');
  assert.equal(s.palette, 'ember');
  assert.equal(s.scale, 2);
});

test('settings survive a trip through the hash', () => {
  const s = normalize({ start: 'soup', species: 'kronium', scale: 3, size: 512, R: 54, T: 12, mu: 0.24, sigma: 0.029, rings: '1,1/3', seed: 99, view: 'growth', palette: 'lagoon' });
  const h = toHash(s);
  assert.ok(h.startsWith('#start=soup&'));
  assert.deepEqual(fromHash(h), s);
});

test('float noise is rounded off in links', () => {
  const h = toHash({ mu: 0.1 + 0.2 });
  assert.ok(h.includes('mu=0.3&'));
});

test('the rule carries parsed ring heights', () => {
  assert.deepEqual(ruleOf(normalize({ rings: '1/2,1' })).rings, [0.5, 1]);
  assert.equal(ruleOf(DEFAULTS).R, 26);
});
