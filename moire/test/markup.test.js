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
    // Per-sheet controls are looked up as `name-${k}` for both sheets.
    for (const [, head, tail] of js.matchAll(/\$\(`([\w-]+)\$\{k\}([\w-]*)`\)/g)) {
      for (const k of [0, 1]) {
        asked++;
        assert.ok(ids.has(`${head}${k}${tail}`), `${file} asks for missing #${head}${k}${tail}`);
      }
    }
  }
  assert.ok(asked > 20, `only ${asked} lookups found`);
});

test('every output names the input it reports', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, id, target] of html.matchAll(/<output id="([\w-]+)" for="([\w-]+)"/g)) {
    assert.equal(id, `${target}-out`);
    assert.match(html, new RegExp(`id="${target}"`));
  }
});
