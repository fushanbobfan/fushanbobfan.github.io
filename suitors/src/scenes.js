import { seededRandom } from './rng.js';

export const LEFT_NAMES = ['Ada', 'Ben', 'Cass', 'Dev', 'Esme', 'Finn', 'Gil', 'Hana'];
export const RIGHT_NAMES = ['Ivo', 'June', 'Kai', 'Lena', 'Milo', 'Nell', 'Otto', 'Pia'];

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 8;

function shuffled(n, rand) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

const range = (n) => Array.from({ length: n }, (_, i) => i);
const rotate = (n, start) => range(n).map((k) => (start + k) % n);

export const SCENES = [
  {
    id: 'random',
    name: 'Shuffled tastes',
    blurb: 'Every list is shuffled at random. Deal again for a new set.',
    make(n, seed) {
      const rand = seededRandom(seed);
      return {
        left: range(n).map(() => shuffled(n, rand)),
        right: range(n).map(() => shuffled(n, rand)),
      };
    },
  },
  {
    id: 'agree',
    name: 'Everyone agrees',
    blurb: 'Both sides rank the other side in the same order. The top pair matches, then the next, and there is only one stable matching.',
    make(n) {
      return { left: range(n).map(() => range(n)), right: range(n).map(() => range(n)) };
    },
  },
  {
    id: 'cyclic',
    name: 'Opposed tastes',
    blurb: 'Each person on the left has a different favourite, and that favourite likes someone else best. Who proposes decides which side gets its favourites.',
    make(n) {
      return {
        left: range(n).map((i) => rotate(n, i)),
        right: range(n).map((j) => rotate(n, (j + 1) % n)),
      };
    },
  },
  {
    id: 'rivals',
    name: 'One favourite',
    blurb: 'The whole left side ranks the right side in the same order, so every proposer starts at the same door.',
    make(n, seed) {
      const rand = seededRandom(seed);
      const order = shuffled(n, rand);
      return {
        left: range(n).map(() => order.slice()),
        right: range(n).map(() => shuffled(n, rand)),
      };
    },
  },
];

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}
