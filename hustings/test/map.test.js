import test from 'node:test';
import assert from 'node:assert/strict';
import { voterCloud } from '../src/voters.js';
import { METHODS } from '../src/methods.js';
import { createMap, fillAll, fillRows, shares, condorcetMisses } from '../src/map.js';

const cloud = voterCloud(101, 1);

function build(candidates, res = 24, spread = 0.12) {
  return fillAll(createMap({ res, candidates, cloud, spread, methods: METHODS }));
}

test('with two candidates every rule splits the map at the perpendicular bisector', () => {
  const map = build([{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }]);
  for (let m = 0; m < METHODS.length; m++) {
    for (let y = 0; y < map.res; y++) {
      for (let x = 0; x < map.res; x++) {
        const cx = (x + 0.5) / map.res;
        // Very close to the line the symmetric cloud can tie; skip those cells.
        if (Math.abs(cx - 0.5) < 0.03) continue;
        assert.equal(map.winners[m][y * map.res + x], cx < 0.5 ? 0 : 1, `${METHODS[m].id} at ${x},${y}`);
      }
    }
    const [a, b] = shares(map, m);
    assert.ok(Math.abs(a - b) < 0.1, METHODS[m].id);
  }
});

test('a candidate standing in the middle of the cloud wins there under every rule', () => {
  const map = build([{ x: 0.5, y: 0.5 }, { x: 0.15, y: 0.2 }, { x: 0.85, y: 0.25 }, { x: 0.5, y: 0.9 }]);
  const centre = Math.floor(map.res / 2) * map.res + Math.floor(map.res / 2);
  for (let m = 0; m < METHODS.length; m++) assert.equal(map.winners[m][centre], 0, METHODS[m].id);
  assert.equal(map.condorcet[centre], 0);
});

test('a clone splits the plurality vote but not the Condorcet vote', () => {
  // A and its twin A' share the left side one above the other; B stands alone on the right.
  // The split only matters where the cloud straddles the line between the twins,
  // so look along the middle row.
  const res = 40;
  const map = build([{ x: 0.3, y: 0.47 }, { x: 0.3, y: 0.53 }, { x: 0.7, y: 0.5 }], res, 0.2);
  const plural = METHODS.findIndex((m) => m.id === 'plurality');
  const minimax = METHODS.findIndex((m) => m.id === 'minimax');
  const row = res / 2;
  const bCells = (m) => map.winners[m].slice(row * res, (row + 1) * res).filter((w) => w === 2).length;
  assert.ok(bCells(plural) >= bCells(minimax) + 2, `${bCells(plural)} vs ${bCells(minimax)}`);
  assert.ok(condorcetMisses(map, plural) > 0);
  assert.equal(condorcetMisses(map, minimax), 0);
});

test('rows filled in pieces match a map filled at once', () => {
  const cands = [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 }, { x: 0.8, y: 0.2 }];
  const whole = build(cands, 16);
  const parts = createMap({ res: 16, candidates: cands, cloud, spread: 0.12, methods: METHODS });
  for (let y = 0; y < 16; y += 3) fillRows(parts, y, y + 3);
  assert.equal(parts.done, 16);
  for (let m = 0; m < METHODS.length; m++) assert.deepEqual(parts.winners[m], whole.winners[m]);
  assert.deepEqual(parts.condorcet, whole.condorcet);
});
