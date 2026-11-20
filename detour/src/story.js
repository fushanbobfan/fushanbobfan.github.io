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

// What happened on one day of a replay.
// history: from learn(); names: route names; start: 'closed' | 'even'; settled: equilibrium minutes per driver.
export function dayText(history, day, names, start, settled) {
  const h = history[day];
  const used = h.flows.map((f, i) => i).filter((i) => h.flows[i] > 0.5);
  if (day === 0) {
    return start === 'closed'
      ? `Day 0: traffic as it had settled before the new roads opened, ${minutes(h.perDriver)} per driver. Overnight they open.`
      : `Day 0: drivers spread evenly over the routes, ${minutes(h.perDriver)} per driver on average.`;
  }
  // The fastest route counts empty ones too: an empty route that is quicker still draws drivers.
  const fastest = h.times.reduce((b, t, i) => (t < h.times[b] ? i : b), 0);
  const slowest = used.reduce((b, i) => (h.times[i] > h.times[b] ? i : b), used[0]);
  let text = `Day ${day}: ${minutes(h.perDriver)} per driver on average.`;
  if (h.times[slowest] - h.times[fastest] < 0.05) {
    text += ` Every route in use takes ${minutes(h.times[fastest])}, so nobody gains by switching.`;
  } else {
    text += ` ${names[fastest]} is fastest at ${minutes(h.times[fastest])} with ${drivers(h.flows[fastest])} drivers; ${names[slowest]} takes ${minutes(h.times[slowest])}, so some of its drivers will switch tomorrow.`;
  }
  if (day === history.length - 1 && h.times[slowest] - h.times[fastest] >= 0.05) {
    text += ` Still on its way to the equilibrium, ${minutes(settled)}.`;
  }
  return text;
}

// The line under the replay controls while the map shows the settled traffic.
export function replayPrompt(history, start, settled) {
  const from = minutes(history[0].perDriver);
  if (Math.abs(history[0].perDriver - settled) < 0.05) {
    return start === 'closed'
      ? `Opening these roads changes nothing here: trips stay at ${from}.`
      : `The even split is already the equilibrium here: ${from} per driver.`;
  }
  return `Press Replay to watch the drivers get from ${from} to ${minutes(settled)}, one morning at a time.`;
}

// The line under the map while it shows a day of the replay.
export function replayHeadline(history, day, settled) {
  return `Day ${day} of the replay: ${minutes(history[day].perDriver)} per driver on average. Once the traffic settles every trip takes ${minutes(settled)}.`;
}
