import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneById } from '../src/scenes.js';
import { isCausalPath, properTimeAlong } from '../src/worldlines.js';
import { boost, separation } from '../src/lorentz.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('every scene has events, a selection that points at them, and causal worldlines', () => {
  for (const s of SCENES) {
    assert.ok(s.events.length >= 2, s.id);
    for (const i of s.selected) assert.ok(i < s.events.length, s.id);
    for (const p of s.paths) assert.ok(isCausalPath(p.points), `${s.id} ${p.name}`);
    for (const b of s.bands) assert.ok(isCausalPath(b.back) && isCausalPath(b.front), `${s.id} ${b.name}`);
    for (const r of s.rays) close(Math.abs(r.to.x - r.from.x), r.to.t - r.from.t);
    for (const e of s.events) assert.ok(Math.abs(e.t) < 5 && Math.abs(e.x) < 5, `${s.id} event off the diagram`);
  }
});

test('the twins: 8 s at home, 6.4 s away, and the home clock jumps from 2.56 to 5.44 s at the turn', () => {
  const s = sceneById('twins');
  close(s.numbers.tHome, 8);
  close(s.numbers.tAway, 6.4);
  close(s.numbers.homeBefore, 2.56);
  close(s.numbers.homeAfter, 5.44);
  // the outbound frame's "now" through the turn really does meet the home line at 2.56 s on its clock
  const turn = s.events[1];
  const meet = { t: s.events[0].t + s.numbers.homeBefore, x: 0 };
  close(boost(meet, 0.6).t, boost(turn, 0.6).t);
  assert.match(s.story.join(' '), /8\.00 s.*6\.40 s/);
});

test('the barn: the ladder fits in the lab, and the order of the door events flips riding with it', () => {
  const s = sceneById('barn');
  close(s.numbers.ladderLab, 1.5);
  close(s.numbers.barnInLadder, 1.2);
  assert.ok(s.numbers.insideLab > 0);
  close(s.numbers.inLadder, -1.625);
  assert.equal(separation(s.events[0], s.events[1]), 'spacelike');
  // the door events lie on the bands' edges
  const [backIn, frontOut] = s.events;
  const ladder = s.bands[1];
  const xOn = (line, t) => line[0].x + ((t - line[0].t) / (line[1].t - line[0].t)) * (line[1].x - line[0].x);
  close(xOn(ladder.back, backIn.t), backIn.x);
  close(xOn(ladder.front, frontOut.t), frontOut.x);
});

test('lightning: simultaneous on the platform, the front strike 2 s earlier on the train', () => {
  const s = sceneById('lightning');
  close(s.numbers.inTrain, -2);
  assert.ok(s.numbers.passengerFront < s.numbers.platform && s.numbers.platform < s.numbers.passengerRear);
  close(s.events[0].t, s.events[1].t);
  assert.match(s.story.join(' '), /2\.00 s earlier/);
});

test('the twins\' worldlines meet at both ends', () => {
  const [home, away] = sceneById('twins').paths;
  assert.deepEqual(home.points[0], away.points[0]);
  assert.deepEqual(home.points.at(-1), away.points.at(-1));
  assert.ok(properTimeAlong(away.points) < properTimeAlong(home.points));
});

test('unknown scene ids fall back to the free scene', () => {
  assert.equal(sceneById('nope').id, 'free');
});
