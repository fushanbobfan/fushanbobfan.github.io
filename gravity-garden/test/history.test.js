import test from "node:test";
import assert from "node:assert/strict";
import { createHistory, pushHistory, popHistory, canUndo } from "../src/history.js";

test("createHistory starts empty", () => {
  const history = createHistory(5);
  assert.equal(canUndo(history), false);
});

test("pushHistory then popHistory returns the pushed snapshot", () => {
  let history = createHistory(5);
  history = pushHistory(history, { value: 1 });
  const { snapshot, history: after } = popHistory(history);
  assert.deepEqual(snapshot, { value: 1 });
  assert.equal(canUndo(after), false);
});

test("popHistory on an empty history returns a null snapshot and an unchanged history", () => {
  const history = createHistory(5);
  const { snapshot, history: after } = popHistory(history);
  assert.equal(snapshot, null);
  assert.equal(canUndo(after), false);
});

test("popHistory returns snapshots in last-in-first-out order", () => {
  let history = createHistory(5);
  history = pushHistory(history, { value: 1 });
  history = pushHistory(history, { value: 2 });
  history = pushHistory(history, { value: 3 });

  let popped;
  ({ snapshot: popped, history } = popHistory(history));
  assert.deepEqual(popped, { value: 3 });
  ({ snapshot: popped, history } = popHistory(history));
  assert.deepEqual(popped, { value: 2 });
  ({ snapshot: popped, history } = popHistory(history));
  assert.deepEqual(popped, { value: 1 });
  assert.equal(canUndo(history), false);
});

test("pushHistory discards the oldest snapshot once maxSize is exceeded", () => {
  let history = createHistory(2);
  history = pushHistory(history, { value: 1 });
  history = pushHistory(history, { value: 2 });
  history = pushHistory(history, { value: 3 });

  let popped;
  ({ snapshot: popped, history } = popHistory(history));
  assert.deepEqual(popped, { value: 3 });
  ({ snapshot: popped, history } = popHistory(history));
  assert.deepEqual(popped, { value: 2 });
  assert.equal(canUndo(history), false);
});

test("pushHistory does not mutate the history passed in", () => {
  const history = createHistory(5);
  const after = pushHistory(history, { value: 1 });
  assert.equal(canUndo(history), false);
  assert.equal(canUndo(after), true);
});
