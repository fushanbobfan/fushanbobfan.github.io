import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, RATE_SLIDERS } from '../src/presets.js';
import { smallSwingPeriod } from '../src/model.js';

test('every preset sets rates inside the slider ranges', () => {
  for (const preset of PRESETS) {
    for (const s of RATE_SLIDERS) {
      const v = preset.params[s.key];
      assert.ok(v >= s.min && v <= s.max, `${preset.id}.${s.key} = ${v}`);
    }
    assert.ok(preset.starts.length >= 1 && preset.starts.length <= 6, preset.id);
    for (const [x, y] of preset.starts) assert.ok(x > 0 && y > 0, preset.id);
  }
});

test('preset ids are unique', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
});

test('the ten-year preset has small swings of about nine and a half years', () => {
  const p = PRESETS.find((q) => q.id === 'hare-lynx').params;
  const period = smallSwingPeriod(p);
  assert.ok(period > 9 && period < 10, String(period));
});
