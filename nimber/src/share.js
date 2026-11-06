// The pile game as a link: #h=3,4,5&m=1&c=1 (piles, misère, computer first).

export const MAX_PILES = 6;
export const MAX_STONES = 15;

export function formatPiles({ heaps, misere, first }) {
  const p = new URLSearchParams();
  p.set('h', heaps.join(','));
  if (misere) p.set('m', '1');
  if (first === 'computer') p.set('c', '1');
  return p.toString().replaceAll('%2C', ',');
}

export function parsePiles(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = p.get('h');
  if (!raw || !/^\d+(,\d+)*$/.test(raw)) return null;
  const heaps = raw.split(',').map(Number);
  if (heaps.length > MAX_PILES || heaps.some((h) => h > MAX_STONES) || !heaps.some((h) => h > 0)) {
    return null;
  }
  return { heaps, misere: p.get('m') === '1', first: p.get('c') === '1' ? 'computer' : 'you' };
}
