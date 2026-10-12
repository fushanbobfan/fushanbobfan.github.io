import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addFood, removeFoodNear, feed, placeFoodLayout, FOOD_LAYOUTS } from '../src/food.js';
import { createTrail, totalTrail, sample } from '../src/trail.js';

test('feeding paints a disc of 13 cells per source', () => {
  const t = createTrail(30, 30);
  const foods = addFood([], 10, 10);
  feed(t, foods, 2, false);
  assert.equal(totalTrail(t), 26);
  assert.equal(sample(t, 10, 12, false), 2);
  assert.equal(sample(t, 12, 12, false), 0);
});

test('zero strength feeds nothing', () => {
  const t = createTrail(10, 10);
  feed(t, [{ x: 5, y: 5 }], 0, true);
  assert.equal(totalTrail(t), 0);
});

test('removal takes the nearest source within reach only', () => {
  const foods = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 0 }];
  assert.equal(removeFoodNear(foods, 11.2, 0, 3), true);
  assert.deepEqual(foods, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  assert.equal(removeFoodNear(foods, 5, 5, 2), false);
  assert.equal(foods.length, 2);
});

test('every layout lands inside the world', () => {
  for (const name of Object.keys(FOOD_LAYOUTS)) {
    for (const p of placeFoodLayout(name, 300, 200)) {
      assert.ok(p.x > 0 && p.x < 300 && p.y > 0 && p.y < 200, `${name} ${p.x},${p.y}`);
    }
  }
  assert.equal(placeFoodLayout('grid', 100, 100).length, 12);
  assert.deepEqual(placeFoodLayout('unknown', 100, 100), []);
});
