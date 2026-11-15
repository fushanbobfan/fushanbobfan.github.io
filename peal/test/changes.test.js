import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChange, applyChange, expandNotation, leadChanges, plainCourse,
  falseRows, bellPath, rounds, rowString, bellFromChar, bellChar,
} from '../src/changes.js';
import { METHODS, methodById } from '../src/methods.js';

const ring = (row, token) => rowString(applyChange(row, parseChange(token, row.length)));

test('bell characters run 1-9, 0, E, T', () => {
  assert.equal(bellChar(10), '0');
  assert.equal(bellChar(12), 'T');
  assert.equal(bellFromChar('e'), 11);
  assert.throws(() => bellFromChar('Q'));
});

test('a cross swaps every pair', () => {
  assert.equal(ring(rounds(6), 'x'), '214365');
  assert.throws(() => parseChange('x', 5), /even/);
});

test('places stay put and the rest swap in pairs', () => {
  assert.equal(ring(rounds(6), '16'), '132546');
  assert.equal(ring(rounds(6), '14'), '132465');
  assert.equal(ring(rounds(5), '125'), '12435');
  assert.equal(ring(rounds(5), '3'), '21354');
});

test('places the notation leaves out are filled in', () => {
  // "1" on six: the sixth bell has no partner, so it lies behind.
  assert.equal(ring(rounds(6), '1'), '132546');
  // "4" on six: the third cannot swap with the fourth, so it makes thirds too.
  assert.equal(ring(rounds(6), '4'), '213465');
  // "5" on five: 12 and 34 swap.
  assert.equal(ring(rounds(5), '5'), '21435');
});

test('a place beyond the stage is refused', () => {
  assert.throws(() => parseChange('18', 6), /beyond/);
});

test('the comma form reflects each side', () => {
  assert.deepEqual(expandNotation('x16x16x16,12'),
    ['x', '16', 'x', '16', 'x', '16', 'x', '16', 'x', '16', 'x', '12']);
  assert.deepEqual(expandNotation('3,1.5.1.5.1'),
    ['3', '1', '5', '1', '5', '1', '5', '1', '5', '1']);
});

test('the ampersand form reflects and a plain list is read as written', () => {
  assert.deepEqual(expandNotation('&x1x1x1+2'), ['x', '1', 'x', '1', 'x', '1', 'x', '1', 'x', '1', 'x', '2']);
  assert.deepEqual(expandNotation('3.1.5'), ['3', '1', '5']);
  assert.deepEqual(expandNotation('-14-'), ['x', '14', 'x']);
});

// Published lengths and first lead heads of each method's plain course.
const KNOWN = {
  'plain-hunt-doubles': [10, 10, null],
  'plain-hunt-minor': [12, 12, null],
  'plain-bob-doubles': [10, 40, '13524'],
  'grandsire-doubles': [10, 30, '12534'],
  'stedman-doubles': [12, 60, '53412'],
  'plain-bob-minor': [12, 60, '135264'],
  'cambridge-surprise-minor': [24, 120, '156342'],
  'plain-bob-major': [16, 112, '13527486'],
  'grandsire-triples': [14, 70, '1253746'],
  'cambridge-surprise-major': [32, 224, '15738264'],
};

test('every method has the published lead length, course length and lead head', () => {
  assert.equal(METHODS.length, Object.keys(KNOWN).length);
  for (const m of METHODS) {
    const [leadLength, courseLength, leadHead] = KNOWN[m.id];
    const changes = leadChanges(m.notation, m.stage);
    assert.equal(changes.length, leadLength, m.name);
    const course = plainCourse(changes, m.stage);
    assert.ok(course.complete, m.name);
    assert.equal(course.rows.length - 1, courseLength, m.name);
    if (leadHead) assert.equal(rowString(course.leadHeads[1]), leadHead, m.name);
  }
});

test('every plain course is true: no row rung twice', () => {
  for (const m of METHODS) {
    const course = plainCourse(leadChanges(m.notation, m.stage), m.stage);
    assert.deepEqual(falseRows(course.rows), [], m.name);
  }
});

test('each change moves every bell at most one place', () => {
  for (const m of METHODS) {
    const { rows } = plainCourse(leadChanges(m.notation, m.stage), m.stage);
    for (let bell = 1; bell <= m.stage; bell++) {
      const path = bellPath(rows, bell);
      for (let i = 1; i < path.length; i++) assert.ok(Math.abs(path[i] - path[i - 1]) <= 1);
    }
  }
});

test('a hunt bell repeats its path every lead', () => {
  for (const m of METHODS.filter((x) => x.hunt)) {
    const changes = leadChanges(m.notation, m.stage);
    const { rows } = plainCourse(changes, m.stage);
    const path = bellPath(rows, m.hunt);
    const n = changes.length;
    for (let i = n; i < path.length; i++) assert.equal(path[i], path[i - n], m.name);
  }
});

test('repeated rows are reported with both positions', () => {
  const rows = [[1, 2, 3], [2, 1, 3], [1, 2, 3], [2, 1, 3], [1, 2, 3]];
  assert.deepEqual(falseRows(rows), [
    { row: '123', first: 0, again: 2 },
    { row: '213', first: 1, again: 3 },
  ]);
});

test('a course longer than the row limit is reported as unfinished', () => {
  const pb = methodById('plain-bob-minor');
  const course = plainCourse(leadChanges(pb.notation, pb.stage), pb.stage, 20);
  assert.equal(course.complete, false);
  assert.ok(course.rows.length <= 21 + 12);
});

test('an unknown method id falls back to the first method', () => {
  assert.equal(methodById('nope').id, METHODS[0].id);
});
