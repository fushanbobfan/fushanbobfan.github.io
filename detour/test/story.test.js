import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headline, toggleEffect, effectText, trendText } from '../src/story.js';
import { sceneById } from '../src/scenes.js';

const braess = sceneById('braess');

test('the headline says what the link costs each driver', () => {
  assert.equal(headline(braess, new Set(), 4000), '4,000 drivers each take the fastest route they can, and every trip takes 65 min.');
  assert.equal(
    headline(braess, new Set(['AB']), 4000),
    '4,000 drivers each take the fastest route they can, and every trip takes 80 min. With this link closed it would be 65 min: the new road costs each driver 15 min.'
  );
  assert.match(headline(braess, new Set(), 0), /No drivers/);
});

test('with two links open the headline speaks of both', () => {
  const ladder = sceneById('ladder');
  assert.match(headline(ladder, new Set(['AB', 'DC']), 6000), /With every link closed it would be 123\.3 min: the new roads cost each driver 26\.7 min\.$/);
});

test('Pigou: the headline points at the better split instead', () => {
  assert.match(headline(sceneById('pigou'), new Set(), 6000), /could get the average down to 45 min\.$/);
});

test('toggle effects read both ways', () => {
  assert.equal(effectText(toggleEffect(braess, new Set(), 4000, 'AB')), 'Opening it would make every trip 80 min, 15 min slower.');
  assert.equal(effectText(toggleEffect(braess, new Set(['AB']), 2000, 'AB')), 'Closing it would make every trip 55 min, 15 min slower.');
  assert.equal(effectText(toggleEffect(braess, new Set(), 10000, 'AB')), 'Opening it would change nothing: trips stay at 95 min.');
});

test('trend text names the shaded range', () => {
  assert.match(trendText(braess, [[3000, 9000]]), /from about 3,000 to 9,000 drivers \(shaded\)/);
  assert.match(trendText(sceneById('pigou'), []), /solid/);
});
