// A small saved-designs list kept in the browser's localStorage. Entries hold
// the encoded design and palette only; thumbnails are redrawn from the design.

import { encodeDesign, decodeDesign } from './share.js';

export const MAX_ENTRIES = 24;

function readAll(storage, key) {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Drop anything that no longer decodes, e.g. after a hand edit.
    return parsed.filter((e) => e && typeof e.id === 'string' && decodeDesign(e.code));
  } catch {
    return [];
  }
}

function writeAll(storage, key, entries) {
  try {
    storage?.setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    // Private windows and full quotas throw; the gallery just stays in memory.
    return false;
  }
}

export function createGallery(storage, key = 'harmonograph.gallery', now = () => Date.now()) {
  let entries = readAll(storage, key);
  let counter = 0;

  return {
    list() {
      return entries.slice();
    },

    // Save a design, newest first. Saving an identical design and palette
    // moves the existing entry to the front instead of duplicating it.
    save(design, { paletteId = 'ink', name = '' } = {}) {
      const code = encodeDesign(design);
      const existing = entries.find((e) => e.code === code && e.paletteId === paletteId);
      const time = now();
      const entry = existing
        ? { ...existing, name: name || existing.name, savedAt: time }
        : { id: `${time.toString(36)}-${(counter++).toString(36)}`, code, paletteId, name: name || 'Untitled', savedAt: time };
      entries = [entry, ...entries.filter((e) => e !== existing)].slice(0, MAX_ENTRIES);
      const persisted = writeAll(storage, key, entries);
      return { entry, persisted };
    },

    remove(id) {
      const before = entries.length;
      entries = entries.filter((e) => e.id !== id);
      if (entries.length !== before) writeAll(storage, key, entries);
      return entries.length !== before;
    },

    design(id) {
      const entry = entries.find((e) => e.id === id);
      return entry ? decodeDesign(entry.code) : null;
    },
  };
}
