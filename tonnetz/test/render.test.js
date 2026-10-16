import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triad } from '../src/chords.js';
import { createView } from '../src/view.js';
import { draw, emphasis, visibleRange } from '../src/render.js';

function recorder() {
  const texts = [];
  const fills = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'fillText') return (s, x, y) => texts.push({ s, x, y });
      if (prop === 'fill') return () => fills.push(target.fillStyle);
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, texts, fills };
}

const base = (extra = {}) => ({
  view: createView(0.75, -0.4, 90), w: 640, h: 420, spelling: 'auto', labels: 'both', theme: 'dark', ...extra,
});

test('the visible range covers the canvas corners', () => {
  const r = visibleRange(createView(0, 0, 100), 800, 600);
  assert.ok(r.q0 < -4 && r.q1 > 4 && r.r0 < -3 && r.r1 > 3);
});

test('emphasis ranks the current triangle, its copies, the hover and the rest', () => {
  const cur = { q: 0, r: 0, up: true };
  const st = { current: cur, currentTriad: triad(0, 'M'), hover: { q: 0, r: 0, up: false } };
  assert.equal(emphasis(cur, triad(0, 'M'), st), 1);
  assert.equal(emphasis({ q: 12, r: 0, up: true }, triad(0, 'M'), st), 0.55);
  assert.equal(emphasis({ q: 0, r: 0, up: false }, triad(4, 'm'), st), 0.3);
  assert.equal(emphasis({ q: 1, r: 0, up: true }, triad(7, 'M'), st), 0.07);
});

test('labels follow the label mode and spelling', () => {
  const both = recorder();
  draw(both.ctx, base());
  const names = new Set(both.texts.map((t) => t.s));
  assert.ok(names.has('C') && names.has('Em') && names.has('Bb'));

  const notes = recorder();
  draw(notes.ctx, base({ labels: 'notes' }));
  assert.ok(!notes.texts.some((t) => t.s === 'Em'));

  const sharps = recorder();
  draw(sharps.ctx, base({ spelling: 'sharps' }));
  assert.ok(sharps.texts.some((t) => t.s === 'A#'));
});

test('sounding notes are lit and a path draws without errors', () => {
  const rec = recorder();
  const path = [{ q: 0, r: 0, up: true }, { q: 0, r: 0, up: false }, { q: 1, r: 0, up: true }];
  draw(rec.ctx, base({ sounding: [7, 11, 2], path, pathHead: 2, current: path[2], currentTriad: triad(7, 'M'), theme: 'light' }));
  assert.ok(rec.fills.includes('#c27c00'));
});
