// Runs the page script against a small stand-in for the DOM: elements built
// from index.html, canvases that accept any drawing call, and animation
// frames driven by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function element(attrs = {}) {
  const listeners = {};
  const el = {
    ...attrs,
    textContent: '',
    dataset: attrs.dataset || {},
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatch(type) {
      for (const fn of listeners[type] || []) fn({ type, target: el });
    },
    click() {
      el.dispatch('click');
    },
    getContext() {
      const ctx = new Proxy({}, {
        get: (target, key) => (key in target ? target[key] : () => {}),
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      });
      return ctx;
    },
  };
  return el;
}

const byId = {};
for (const m of html.matchAll(/<(input|select|canvas|button|output|p|dd|span)\b([^>]*)\bid="([\w-]+)"([^>]*)>/g)) {
  const attrs = `${m[2]} ${m[4]}`;
  const get = (name) => (attrs.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];
  const el = element({ tag: m[1], id: m[3] });
  if (m[1] === 'input') Object.assign(el, { value: get('value'), min: get('min'), max: get('max') });
  if (m[1] === 'canvas') Object.assign(el, { width: Number(get('width')), height: Number(get('height')) });
  if (m[1] === 'select') {
    const block = html.slice(m.index, html.indexOf('</select>', m.index));
    const selected = block.match(/<option value="([^"]*)" selected>/) || block.match(/<option value="([^"]*)"/);
    el.value = selected[1];
  }
  byId[m[3]] = el;
}
const presets = [...html.matchAll(/<button type="button"((?: data-\w+="[-\d.]+")+)>([^<]+)</g)].map((m) =>
  element({ label: m[2], dataset: Object.fromEntries([...m[1].matchAll(/data-(\w+)="([-\d.]+)"/g)].map((d) => [d[1], d[2]])) }),
);

let frameCallback = null;
globalThis.document = {
  getElementById: (id) => byId[id],
  querySelectorAll: (sel) => (sel === 'button[data-rpm]' ? presets : []),
  documentElement: {},
};
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#000' });
globalThis.requestAnimationFrame = (fn) => {
  frameCallback = fn;
};

let clock = 0;
function frames(n, ms = 16) {
  for (let i = 0; i < n; i++) {
    clock += ms;
    frameCallback(clock);
  }
}
const text = (id) => byId[id].textContent;
const preset = (label) => presets.find((p) => p.label === label).click();
const spinNow = () => Number(text('r-now').match(/spin ([\d,]+) rpm/)[1].replace(/,/g, ''));
const timeNow = () => {
  const m = text('r-now').match(/^([\d.]+) (ms|s) after/);
  return Number(m[1]) / (m[2] === 'ms' ? 1000 : 1);
};

await import('../src/main.js');

test('the page starts with the standard top and runs', () => {
  assert.equal(text('r-critical'), '1,136 rpm or more');
  assert.equal(text('radius-value'), '3 cm');
  assert.equal(text('run'), 'Pause');
  frames(30);
  assert.ok(timeNow() > 0);
  assert.equal(spinNow(), 2000);
});

test('a shape preset rebuilds the top everywhere the page uses it', () => {
  preset('Flat and wide, 700 rpm');
  assert.equal(text('radius-value'), '4 cm');
  assert.equal(text('height-value'), '3 cm');
  assert.equal(text('r-critical'), '467 rpm or more');
  assert.equal(byId.tilt.max, '34');
  assert.equal(byId.tilt.value, '3');
  assert.match(text('shape-note'), /4 cm radius, 3 cm up/);
  frames(60);
  // Without friction the spin stays where it started, read with this top's I3.
  assert.equal(spinNow(), 700);
  assert.equal(text('status'), '');
});

test('the tall preset falls, and its fall reports its own spin', () => {
  preset('Tall and narrow, 3,000 rpm');
  assert.equal(text('r-critical'), '4,456 rpm or more');
  for (let i = 0; i < 400 && !text('status'); i++) frames(10);
  assert.match(text('status'), /rim hit the table .* 72° from upright and the spin at 3,000 rpm\./);
  assert.equal(text('run'), 'Play');
});

test('pause holds the time and play resumes it', () => {
  preset('Let go from rest');
  assert.equal(text('radius-value'), '3 cm');
  assert.equal(byId.tilt.max, '50');
  assert.equal(byId.tilt.value, '25');
  frames(20);
  byId.run.click();
  assert.equal(text('run'), 'Play');
  const held = text('r-now');
  frames(20);
  assert.equal(text('r-now'), held);
  byId.run.click();
  frames(20);
  assert.notEqual(text('r-now'), held);
});

test('changing the shape caps the tilt and keeps the run going', () => {
  byId.tilt.value = '50';
  byId.tilt.dispatch('input');
  byId.radius.value = '4';
  byId.radius.dispatch('input');
  byId.height.value = '3';
  byId.height.dispatch('input');
  assert.equal(byId.tilt.max, '34');
  assert.equal(byId.tilt.value, '34');
  assert.match(text('tilt-value'), /^34°$/);
  frames(10);
  assert.equal(text('run'), 'Pause');
});

test('a friction preset spins the top down at the set rate', () => {
  preset('Spinning down, upright');
  assert.equal(byId.speed.value, '1');
  assert.equal(byId.friction.value, '15');
  frames(125, 16);
  const t = timeNow();
  assert.ok(t > 1.9 && t < 2.1, `${t}`);
  // 3,000 rpm lasting 15 s loses 200 rpm a second.
  assert.ok(Math.abs(spinNow() - 3000 * (1 - t / 15)) <= 1, `${spinNow()} at ${t}`);
});
