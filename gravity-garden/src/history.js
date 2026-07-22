// A small bounded undo stack of opaque snapshots, kept DOM-free like the rest of the
// simulation logic. What a "snapshot" contains is the caller's business (main.js uses
// scenario.js's serializeScenario output); this module only owns the stack discipline —
// last-in-first-out, capped at maxSize so undo history can't grow without bound over a
// long session.

export function createHistory(maxSize) {
  return { stack: [], maxSize };
}

export function canUndo(history) {
  return history.stack.length > 0;
}

export function pushHistory(history, snapshot) {
  const stack = [...history.stack, snapshot];
  if (stack.length > history.maxSize) stack.shift();
  return { ...history, stack };
}

/**
 * Returns `{ snapshot, history }`: the most recently pushed snapshot (or `null` if the
 * history is empty) and the history with that entry removed.
 */
export function popHistory(history) {
  if (history.stack.length === 0) return { snapshot: null, history };
  const snapshot = history.stack[history.stack.length - 1];
  return { snapshot, history: { ...history, stack: history.stack.slice(0, -1) } };
}
