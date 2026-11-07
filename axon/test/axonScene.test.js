import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAMETER_HIGH, DIAMETER_LOW, advanceScene, crossingTime, describeSpeeds, diameterFromSlider, fireAt, fireEnds, isQuiet,
  makeScene, patchAt, sceneSpeeds, sliderFromDiameter, stripNext, voltageColour,
} from '../src/axonScene.js';

test('the diameter slider spans its range and finds its way back', () => {
  assert.equal(diameterFromSlider(0), DIAMETER_LOW);
  assert.equal(diameterFromSlider(100), DIAMETER_HIGH);
  for (const d of [0.3, 1, 10, 200]) {
    assert.ok(Math.abs(diameterFromSlider(sliderFromDiameter(d)) - d) <= 0.02 * d, `d ${d}`);
  }
});

test('positions map to patches inside the cable', () => {
  const scene = makeScene(10, 18.5);
  const { bare, sheathed } = scene.tracks;
  assert.equal(patchAt(bare, 0, scene.length), 0);
  assert.equal(patchAt(bare, 1, scene.length), bare.count - 1);
  assert.equal(patchAt(sheathed, 2, scene.length), sheathed.count - 1);
});

test('a scene starts quiet, wakes when fired, and goes quiet again', () => {
  const scene = makeScene(10, 18.5);
  assert.equal(isQuiet(scene), true);
  fireEnds(scene, { left: true });
  assert.equal(isQuiet(scene), false);
  advanceScene(scene, 200);
  assert.equal(isQuiet(scene), false);
  advanceScene(scene, 3000);
  assert.equal(isQuiet(scene), true);
});

test('firing on the sheathed track lands on a node', () => {
  const scene = makeScene(10, 18.5);
  fireAt(scene, 'sheathed', 0.33);
  const [pulse] = scene.tracks.sheathed.pulses;
  assert.equal((pulse.from + pulse.to) / 2 % 10, 0);
});

test('the sheath wins the race to the far end', () => {
  const scene = makeScene(10, 18.5);
  fireEnds(scene, { left: true });
  const { bare, sheathed } = scene.tracks;
  const farBare = bare.count - 10;
  const farSheath = sheathed.count - 11;
  let bareTime = null;
  let sheathTime = null;
  while (bare.time < 12 && bareTime === null) {
    advanceScene(scene, 5);
    if (sheathTime === null && sheathed.v[farSheath] > 0) sheathTime = sheathed.time;
    if (bareTime === null && bare.v[farBare] > 0) bareTime = bare.time;
  }
  assert.ok(sheathTime !== null && bareTime !== null);
  assert.ok(sheathTime < bareTime / 2.5, `${sheathTime} vs ${bareTime}`);
});

test('stripping grows from the middle and is counted in the speeds', () => {
  const scene = makeScene(10, 18.5);
  const before = sceneSpeeds(scene);
  assert.equal(stripNext(scene), true);
  assert.equal(stripNext(scene), true);
  assert.equal(scene.stripped.length, 2);
  assert.equal(scene.stripped[1] - scene.stripped[0], 10);
  const after = sceneSpeeds(scene);
  assert.equal(after.bare, before.bare);
  assert.ok(after.sheathed < before.sheathed);
  stripNext(scene);
  stripNext(scene);
  assert.equal(sceneSpeeds(scene).sheathed, null);
});

test('stripping stops at the end of the fibre', () => {
  const scene = makeScene(10, 18.5);
  let guard = 0;
  while (stripNext(scene) && guard < 1000) guard++;
  assert.ok(guard > 0 && guard < 1000);
});

test('the pace falls back on the square-root law when nothing conducts', () => {
  const scene = makeScene(10, 18.5);
  assert.ok(Math.abs(crossingTime(scene, 2.7) - (scene.length / 2.7) * 10) < 1e-9);
  assert.ok(crossingTime(scene, null) > 0);
});

test('the sentence names blocked spikes and the speed-up', () => {
  assert.equal(describeSpeeds({ bare: 2.71, sheathed: 8.91 }, 0), 'Bare axon: 2.7 m/s. With myelin: 8.9 m/s. The sheath makes it 3.3 times as fast.');
  const blocked = describeSpeeds({ bare: 2.71, sheathed: null }, 4);
  assert.match(blocked, /With myelin: no spike gets through/);
  assert.match(blocked, /4 stretches of myelin stripped/);
  assert.doesNotMatch(blocked, /times as fast/);
  assert.match(describeSpeeds({ bare: 2.7, sheathed: 6.9 }, 1), /1 stretch of myelin/);
});

test('colours run from dark at rest to pale at the peak', () => {
  const brightness = (v) => voltageColour(v).reduce((a, b) => a + b);
  assert.ok(brightness(-65) < brightness(-40));
  assert.ok(brightness(-40) < brightness(0));
  assert.ok(brightness(0) < brightness(40));
  assert.deepEqual(voltageColour(100), voltageColour(40));
  assert.deepEqual(voltageColour(-200), voltageColour(-90));
});
