import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// A renamed element would otherwise only fail when someone opened the page.
test('every id a page script asks for exists in the markup', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]));
  let asked = 0;
  for (const file of await readdir(new URL('../src/', import.meta.url))) {
    const js = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const [, id] of js.matchAll(/\$\('([\w-]+)'\)/g)) {
      asked++;
      assert.ok(ids.has(id), `${file} asks for missing #${id}`);
    }
    for (const [, id] of js.matchAll(/\{ id: '([\w-]+)', name:/g)) {
      asked++;
      assert.ok(ids.has(id), `${file} lists missing #${id}`);
      assert.ok(ids.has(`${id}-out`), `${file} lists missing #${id}-out`);
    }
  }
  assert.ok(asked > 10);
});

test('colours exist for both schemes', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const [light, dark] = css.split('@media (prefers-color-scheme: dark)');
  for (const name of ['paper', 'ink', 'muted', 'rule', 'accent', 'sodium', 'potassium', 'plug', 'closed', 'band']) {
    assert.ok(light.includes(`--${name}:`), `light --${name}`);
    assert.ok(dark.includes(`--${name}:`), `dark --${name}`);
  }
});
