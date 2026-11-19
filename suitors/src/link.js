// Editing preference lists, and carrying them in the address so a set of lists can be shared.
import { validatePrefs } from './matching.js';
import { MIN_PEOPLE, MAX_PEOPLE } from './scenes.js';

// Move one name on one list `delta` places (negative = towards first choice), clamped to the list.
export function moveChoice(prefs, side, row, pos, delta) {
  const list = prefs[side][row].slice();
  const to = Math.max(0, Math.min(list.length - 1, pos + delta));
  if (to === pos) return { prefs, pos };
  const [who] = list.splice(pos, 1);
  list.splice(to, 0, who);
  const sideLists = prefs[side].map((l, i) => (i === row ? list : l));
  return { prefs: { ...prefs, [side]: sideLists }, pos: to };
}

// Lists as digits, one list per group, groups joined by dots: left "012.102", right likewise.
export function encodeLink({ prefs, proposer, mode }) {
  const pack = (lists) => lists.map((l) => l.join('')).join('.');
  const params = new URLSearchParams();
  params.set('L', pack(prefs.left));
  params.set('R', pack(prefs.right));
  params.set('p', proposer);
  if (mode && mode !== 'watch') params.set('m', mode);
  return params.toString();
}

// Returns null for anything that does not describe valid lists, so a bad link falls back to the default page.
export function decodeLink(fragment) {
  const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
  const unpack = (s) => (s && /^[0-9.]+$/.test(s) ? s.split('.').map((g) => [...g].map(Number)) : null);
  const left = unpack(params.get('L'));
  const right = unpack(params.get('R'));
  if (!left || !right) return null;
  const prefs = { left, right };
  try {
    const n = validatePrefs(prefs);
    if (n < MIN_PEOPLE || n > MAX_PEOPLE) return null;
  } catch {
    return null;
  }
  const proposer = params.get('p') === 'right' ? 'right' : 'left';
  const mode = ['watch', 'hand', 'edit'].includes(params.get('m')) ? params.get('m') : 'watch';
  return { prefs, proposer, mode };
}
