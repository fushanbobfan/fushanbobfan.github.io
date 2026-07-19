// Named scenario saves backed by a Storage-like object (window.localStorage in the
// browser). Kept DOM-free and storage-agnostic — every function takes the storage object
// as a parameter instead of reaching for `window.localStorage` itself — so the save/list/
// load/delete logic can be tested against a plain in-memory fake.

const KEY_PREFIX = "gravity-garden:scenario:";

function keyFor(name) {
  return KEY_PREFIX + name;
}

/**
 * Names of every scenario currently saved, sorted alphabetically. Scans all of storage's
 * keys rather than keeping a separate index, so entries added or removed by other code
 * (or a previous version of this module) are never missed or left stale.
 */
export function listSavedScenarioNames(storage) {
  const names = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(KEY_PREFIX)) {
      names.push(key.slice(KEY_PREFIX.length));
    }
  }
  return names.sort();
}

/**
 * Saves a scenario snapshot (as produced by scenario.js's serializeScenario) under a
 * name, overwriting any existing save with the same name.
 */
export function saveScenarioToStorage(storage, name, scenario) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Save name must not be empty.");
  }
  storage.setItem(keyFor(trimmed), JSON.stringify(scenario));
}

/**
 * Loads a previously saved scenario snapshot by name, ready to pass to scenario.js's
 * deserializeScenario for validation.
 */
export function loadScenarioFromStorage(storage, name) {
  const raw = storage.getItem(keyFor(name));
  if (raw === null) {
    throw new Error(`No saved scenario named "${name}".`);
  }
  return JSON.parse(raw);
}

export function deleteScenarioFromStorage(storage, name) {
  storage.removeItem(keyFor(name));
}
