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
  }
  assert.ok(asked > 10);
});
