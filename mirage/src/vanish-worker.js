// Finds where the board's upside-down copy vanishes off the main thread, so
// the page stays responsive while a few dozen pictures are traced.

import { makeAir } from './air.js';
import { copyVanishes } from './drive.js';

self.onmessage = (e) => {
  const { key, surface, air, layer, eye } = e.data;
  const value = copyVanishes(makeAir({ surface, air, layer }), eye);
  self.postMessage({ key, value });
};
