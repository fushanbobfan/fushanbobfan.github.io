// Bookkeeping for which events are selected or held, kept apart from the page so it can be tested.

// Select event i: it becomes the most recent of at most two selections.
export function selectIndex(selected, i) {
  const next = selected.filter((k) => k !== i);
  next.push(i);
  if (next.length > 2) next.shift();
  return next;
}

// After removing event i, shift every later index down and drop references to i.
// A drag on the removed event ends; a drag on a later event follows it to its new index.
export function afterRemoval({ selected, drag }, i) {
  const shift = (k) => (k > i ? k - 1 : k);
  return {
    selected: selected.filter((k) => k !== i).map(shift),
    drag: !drag || drag.index === i ? null : { ...drag, index: shift(drag.index) },
  };
}

// Which event-list row should hold focus once row i is gone: the row now in its place,
// else the one before it, else none (-1).
export function focusAfterRemoval(count, i) {
  if (count === 0) return -1;
  return Math.min(i, count - 1);
}
