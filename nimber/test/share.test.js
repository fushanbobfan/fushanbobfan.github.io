import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPiles, formatQueen, formatRows, parsePiles, parseQueen, parseRows,
} from '../src/share.js';

test('a queen game survives a round trip through its link', () => {
  const game = { square: [9, 13], size: 16, first: 'computer' };
  assert.equal(formatQueen(game), 'q=9,13&s=16&c=1');
  assert.deepEqual(parseQueen(`#${formatQueen(game)}`), game);
});

test('bad queen links are ignored', () => {
  for (const hash of ['', '#q=1,2', '#q=0,0&s=16', '#q=20,1&s=16', '#q=a,b&s=16', '#q=1,2&s=5', '#q=1,2&s=99']) {
    assert.equal(parseQueen(hash), null, hash);
  }
});

test('a row game survives a round trip through its link', () => {
  const game = { game: 'chess', length: 21, first: 'computer' };
  assert.equal(formatRows(game), 'r=chess&n=21&c=1');
  assert.deepEqual(parseRows(`#${formatRows(game)}`), game);
});

test('bad row links are ignored', () => {
  for (const hash of ['', '#r=kayles', '#r=nope&n=5', '#r=kayles&n=1', '#r=kayles&n=99', '#r=kayles&n=x']) {
    assert.equal(parseRows(hash), null, hash);
  }
});

test('a pile game survives a round trip through its link', () => {
  for (const game of [
    { heaps: [3, 4, 5], misere: false, first: 'you' },
    { heaps: [1, 15, 7, 2], misere: true, first: 'computer' },
  ]) {
    assert.deepEqual(parsePiles(`#${formatPiles(game)}`), game);
  }
});

test('the link stays readable', () => {
  assert.equal(formatPiles({ heaps: [3, 4, 5], misere: true, first: 'you' }), 'h=3,4,5&m=1');
});

test('bad links are ignored', () => {
  for (const hash of ['', '#', '#h=', '#h=a,b', '#h=0,0', '#h=99', '#h=1,1,1,1,1,1,1', '#h=-1,2']) {
    assert.equal(parsePiles(hash), null, hash);
  }
});
