// Touches: a method rung with calls. A call changes the last change of a
// lead, so the bells reach a different lead head and the band goes on into
// rows the plain course never reaches.

import { applyChange, parseChange, rounds, rowString, sameRow, falseRows } from './changes.js';

// A calling lists what happens at each lead end, in ringers' shorthand:
// "-" or "b" a bob, "s" a single, "p" or "." a plain lead. Spaces are ignored.
export function parseCalling(text) {
  const out = [];
  for (const ch of text.replace(/\s+/g, '').toLowerCase()) {
    if (ch === '-' || ch === 'b') out.push('b');
    else if (ch === 's') out.push('s');
    else if (ch === 'p' || ch === '.') out.push('p');
    else throw new Error(`"${ch}" is not a call: use - for a bob, s for a single, p for a plain lead`);
  }
  return out;
}

export function callingString(calls) {
  return calls.map((c) => (c === 'b' ? '-' : c === 's' ? 's' : 'p')).join('');
}

// Change lists for one lead of each kind: plain, bob and single.
export function leadVariants(changes, callNotation, stage) {
  const variants = { p: changes };
  for (const kind of ['b', 's']) {
    const name = kind === 'b' ? 'bob' : 'single';
    if (callNotation?.[name]) {
      variants[kind] = changes.slice(0, -1).concat([parseChange(callNotation[name], stage)]);
    }
  }
  return variants;
}

// Ring the calling over and over until rounds comes back at a lead end, or
// the row limit is reached. Returns the rows, one entry per lead with its
// call, and whether the touch came round.
export function ringTouch(variants, calls, stage, maxRows = 5040) {
  if (calls.length === 0) throw new Error('the calling is empty');
  for (const c of calls) {
    if (!variants[c]) throw new Error(`this method has no ${c === 'b' ? 'bob' : 'single'}`);
  }
  const start = rounds(stage);
  const rows = [start];
  const leads = [];
  let row = start;
  for (let k = 0; ; k++) {
    const call = calls[k % calls.length];
    const lead = variants[call];
    if (rows.length - 1 + lead.length > maxRows) return { rows, leads, complete: false };
    for (const perm of lead) {
      row = applyChange(row, perm);
      rows.push(row);
    }
    leads.push({ call, end: rows.length - 1 });
    if (sameRow(row, start)) return { rows, leads, complete: true };
  }
}

export function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Summary a ringer would want: length, truth, whether it is an extent.
export function judgeTouch(touch, stage) {
  const changes = touch.rows.length - 1;
  const repeats = falseRows(touch.rows);
  return {
    changes,
    leads: touch.leads.length,
    complete: touch.complete,
    true: repeats.length === 0,
    repeats,
    extent: touch.complete && repeats.length === 0 && changes === factorial(stage),
  };
}

// Search for a calling that rings every row exactly once and comes back to
// rounds: an extent. Depth-first over lead ends, trying plain, bob and single
// in turn and backing off as soon as a lead would repeat a row. Work is done
// in slices so a page can keep drawing; call step() until done is true.
export function extentSearch(variants, stage, { order = ['p', 'b', 's'] } = {}) {
  const kinds = order.filter((k) => variants[k]);
  const target = factorial(stage);
  const leadLength = variants.p.length;
  const seen = new Set();
  const start = rounds(stage);
  seen.add(rowString(start));
  // stack frames: { head, choice, added: [row keys added by this lead] }
  const stack = [{ head: start, choice: -1, added: [] }];
  let nodes = 0;
  let found = null;
  let exhausted = target % leadLength !== 0;

  function tryLead(head, kind) {
    const added = [];
    let row = head;
    const lead = variants[kind];
    for (let i = 0; i < lead.length; i++) {
      row = applyChange(row, lead[i]);
      const key = rowString(row);
      const closing = i === lead.length - 1 && sameRow(row, start);
      if (closing) {
        if (seen.size === target) return { row, added, closed: true };
        break;
      }
      if (seen.has(key)) break;
      seen.add(key);
      added.push(key);
      if (i === lead.length - 1) return { row, added, closed: false };
    }
    for (const key of added) seen.delete(key);
    return null;
  }

  function step(budget = 20000) {
    while (!found && !exhausted && budget-- > 0) {
      const top = stack[stack.length - 1];
      top.choice += 1;
      if (top.choice >= kinds.length) {
        stack.pop();
        if (stack.length === 0) {
          exhausted = true;
          break;
        }
        for (const key of top.added) seen.delete(key);
        continue;
      }
      nodes += 1;
      const result = tryLead(top.head, kinds[top.choice]);
      if (!result) continue;
      if (result.closed) {
        found = stack.map((f) => kinds[f.choice]);
        break;
      }
      stack.push({ head: result.row, choice: -1, added: result.added });
    }
    return { done: Boolean(found) || exhausted, found, nodes, depth: stack.length - 1 };
  }

  return { step };
}
