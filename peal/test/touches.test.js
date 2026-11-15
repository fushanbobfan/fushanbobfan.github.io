import test from 'node:test';
import assert from 'node:assert/strict';
import { leadChanges, falseRows } from '../src/changes.js';
import { METHODS, methodById } from '../src/methods.js';
import {
  parseCalling, callingString, leadVariants, ringTouch, judgeTouch, extentSearch, factorial,
} from '../src/touches.js';

const variantsOf = (id) => {
  const m = methodById(id);
  return [leadVariants(leadChanges(m.notation, m.stage), m.calls, m.stage), m.stage];
};

test('callings read bobs, singles and plain leads in ringers shorthand', () => {
  assert.deepEqual(parseCalling('- s p .'), ['b', 's', 'p', 'p']);
  assert.deepEqual(parseCalling('BsP'), ['b', 's', 'p']);
  assert.equal(callingString(['p', 'b', 's']), 'p-s');
  assert.throws(() => parseCalling('pq'), /not a call/);
});

test('a call replaces only the last change of the lead', () => {
  const [v] = variantsOf('plain-bob-minor');
  assert.equal(v.b.length, v.p.length);
  assert.deepEqual(v.b.slice(0, -1), v.p.slice(0, -1));
  assert.notDeepEqual(v.b.at(-1), v.p.at(-1));
});

test('a plain calling rings the plain course', () => {
  for (const m of METHODS.filter((x) => x.calls)) {
    const [v, n] = variantsOf(m.id);
    const touch = ringTouch(v, ['p'], n);
    assert.ok(touch.complete);
    assert.equal(touch.leads.length * v.p.length, touch.rows.length - 1);
  }
});

test('ringing repeats the calling until rounds comes back at a lead end', () => {
  const [v, n] = variantsOf('plain-bob-minor');
  const touch = ringTouch(v, parseCalling('ppp-'), n);
  assert.ok(touch.complete);
  assert.equal(touch.rows.length - 1, 240);
  assert.deepEqual(touch.leads.slice(0, 4).map((l) => l.call), ['p', 'p', 'p', 'b']);
  assert.deepEqual(judgeTouch(touch, n).repeats, []);
});

test('the single in Cambridge Surprise Minor brings repeated rows', () => {
  const [v, n] = variantsOf('cambridge-surprise-minor');
  const verdict = judgeTouch(ringTouch(v, ['s'], n), n);
  assert.equal(verdict.true, false);
  assert.ok(verdict.repeats.length > 0);
});

test('a method without a single refuses a calling that needs one', () => {
  const m = methodById('grandsire-doubles');
  const v = leadVariants(leadChanges(m.notation, m.stage), m.calls, m.stage);
  assert.throws(() => ringTouch(v, ['s'], m.stage), /no single/);
});

test('a touch that has not come round by the row limit says so', () => {
  const [v, n] = variantsOf('plain-bob-major');
  const touch = ringTouch(v, ['p'], n, 50);
  assert.equal(touch.complete, false);
  assert.ok(touch.rows.length - 1 <= 50);
});

test('the search finds a true extent of Plain Bob Doubles and of the minor methods', () => {
  for (const id of ['plain-bob-doubles', 'plain-bob-minor', 'cambridge-surprise-minor']) {
    const [v, n] = variantsOf(id);
    const search = extentSearch(v, n);
    let r;
    do r = search.step(50000); while (!r.done);
    assert.ok(r.found, id);
    const touch = ringTouch(v, r.found, n);
    const verdict = judgeTouch(touch, n);
    assert.ok(verdict.extent, id);
    assert.equal(verdict.changes, factorial(n));
    assert.equal(touch.leads.length, r.found.length, 'the calling is rung once, not repeated');
    assert.deepEqual(falseRows(touch.rows), []);
  }
});

test('the search gives up at once when whole leads cannot make the extent', () => {
  // 11 changes a lead never divides 8! = 40320 rows evenly.
  const lead = leadChanges('x18x18x18,12', 8).slice(0, 11);
  assert.notEqual(factorial(8) % lead.length, 0);
  const r = extentSearch({ p: lead }, 8).step(10);
  assert.ok(r.done);
  assert.equal(r.found, null);
  assert.equal(r.nodes, 0);
});
