import test from "node:test";
import assert from "node:assert/strict";
import {
  listSavedScenarioNames,
  saveScenarioToStorage,
  loadScenarioFromStorage,
  deleteScenarioFromStorage,
} from "../src/storage.js";

// A minimal in-memory stand-in for window.localStorage, implementing just the Storage
// methods storage.js actually uses, so these tests don't need a DOM/browser environment.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

test("a fresh storage has no saved scenarios", () => {
  assert.deepEqual(listSavedScenarioNames(fakeStorage()), []);
});

test("save -> load round-trips the scenario object", () => {
  const storage = fakeStorage();
  const scenario = { version: 1, G: 1, softening: 4, bodies: [], viewport: { panX: 0, panY: 0, zoom: 1 } };
  saveScenarioToStorage(storage, "my orbit", scenario);
  assert.deepEqual(loadScenarioFromStorage(storage, "my orbit"), scenario);
});

test("listSavedScenarioNames returns saved names sorted, unaffected by unrelated keys", () => {
  const storage = fakeStorage();
  storage.setItem("some-other-app:setting", "42");
  saveScenarioToStorage(storage, "zeta", {});
  saveScenarioToStorage(storage, "alpha", {});
  assert.deepEqual(listSavedScenarioNames(storage), ["alpha", "zeta"]);
});

test("saving under an existing name overwrites it rather than duplicating", () => {
  const storage = fakeStorage();
  saveScenarioToStorage(storage, "orbit", { G: 1 });
  saveScenarioToStorage(storage, "orbit", { G: 2 });
  assert.deepEqual(listSavedScenarioNames(storage), ["orbit"]);
  assert.deepEqual(loadScenarioFromStorage(storage, "orbit"), { G: 2 });
});

test("saving rejects an empty or whitespace-only name", () => {
  const storage = fakeStorage();
  assert.throws(() => saveScenarioToStorage(storage, "", {}), /must not be empty/);
  assert.throws(() => saveScenarioToStorage(storage, "   ", {}), /must not be empty/);
});

test("saving trims surrounding whitespace from the name", () => {
  const storage = fakeStorage();
  saveScenarioToStorage(storage, "  padded  ", { G: 1 });
  assert.deepEqual(listSavedScenarioNames(storage), ["padded"]);
});

test("loading a name that was never saved throws a descriptive error", () => {
  assert.throws(() => loadScenarioFromStorage(fakeStorage(), "nope"), /No saved scenario named "nope"/);
});

test("deleteScenarioFromStorage removes only the named save", () => {
  const storage = fakeStorage();
  saveScenarioToStorage(storage, "keep", { G: 1 });
  saveScenarioToStorage(storage, "drop", { G: 2 });
  deleteScenarioFromStorage(storage, "drop");
  assert.deepEqual(listSavedScenarioNames(storage), ["keep"]);
});

test("deleting a name that doesn't exist is a harmless no-op", () => {
  const storage = fakeStorage();
  assert.doesNotThrow(() => deleteScenarioFromStorage(storage, "nothing-here"));
});
