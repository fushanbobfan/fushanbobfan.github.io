// Sentences that say what the picture shows.

import { openRoads } from './network.js';
import { outcomes } from './equilibrium.js';
import { minutes, drivers } from './draw.js';
import { optionalRoads } from './scenes.js';

const same = (a, b) => Math.abs(a - b) < 0.05;

// What toggling one optional road would do to the equilibrium trip time.
export function toggleEffect(scene, open, demand, roadId) {
  const now = outcomes(scene, openRoads(scene, open), demand).equilibrium.perDriver;
  const next = new Set(open);
  if (next.has(roadId)) next.delete(roadId);
  else next.add(roadId);
  const then = outcomes(scene, openRoads(scene, next), demand).equilibrium.perDriver;
  return { now, then, opening: !open.has(roadId) };
}

export function effectText(effect) {
  const verb = effect.opening ? 'Opening it' : 'Closing it';
  if (same(effect.now, effect.then)) return `${verb} would change nothing: trips stay at ${minutes(effect.now)}.`;
  const diff = Math.abs(effect.then - effect.now);
  const way = effect.then > effect.now ? 'slower' : 'faster';
  return `${verb} would make every trip ${minutes(effect.then)}, ${minutes(diff)} ${way}.`;
}

export function headline(scene, open, demand) {
  if (demand <= 0) return 'No drivers on the road. Raise the number of drivers to see where they go.';
  const o = outcomes(scene, openRoads(scene, open), demand);
  const eq = o.equilibrium.perDriver;
  let text = `${drivers(demand)} drivers each take the fastest route they can, and every trip takes ${minutes(eq)}.`;
  const opts = optionalRoads(scene);
  const allClosed = outcomes(scene, openRoads(scene, new Set()), demand).equilibrium.perDriver;
  if (opts.length && open.size && eq > allClosed + 0.05) {
    text += ` With ${open.size === opts.length && opts.length > 1 ? 'every link' : open.size > 1 ? 'these links' : 'this link'} closed it would be ${minutes(allClosed)}: ${open.size > 1 ? 'the new roads cost' : 'the new road costs'} each driver ${minutes(eq - allClosed)}.`;
  } else if (!same(o.optimum.perDriver, eq)) {
    text += ` Splitting the same drivers differently could get the average down to ${minutes(o.optimum.perDriver)}.`;
  }
  return text;
}

export function trendText(scene, worse) {
  if (!optionalRoads(scene).length) {
    return 'Minutes per driver as traffic grows: everyone choosing for themselves (solid) against the best split (dashed). The gap opens once the narrow road is busy enough that its own drivers slow each other down.';
  }
  const range = worse.map(([a, b]) => `${drivers(a)} to ${drivers(b)}`).join(' and ');
  return worse.length
    ? `Minutes per driver as traffic grows, with every optional road closed and with every one open. Opening them makes trips slower from about ${range} drivers (shaded).`
    : 'Minutes per driver as traffic grows, with every optional road closed and with every one open. Here opening them never makes trips slower.';
}
