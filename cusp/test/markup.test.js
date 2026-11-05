import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A renamed element would otherwise only fail when someone opened the page.
test('every id the page script asks for exists in the markup', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]));
  const asked = [...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(asked.length > 5);
  for (const id of asked) assert.ok(ids.has(id), `missing #${id}`);
  for (const key of ['a', 'l', 's']) {
    assert.ok(ids.has(key));
    assert.ok(ids.has(`${key}-out`));
  }
});
