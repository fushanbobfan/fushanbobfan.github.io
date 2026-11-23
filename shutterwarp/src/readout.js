// Plain-language readouts for the page. No DOM access here.

import { turnDuringReadout } from './shutter.js';

export const WALL_SECONDS_PER_READOUT = 4;

const fmt = (x, digits = 0) =>
  x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function speedLabel(rpm) {
  const perSecond = rpm / 60;
  if (rpm === 0) return 'standing still';
  const turns = perSecond < 10 ? fmt(perSecond, 1) : fmt(perSecond);
  return `${fmt(rpm)} rpm (${turns} turns a second)`;
}

export function readoutLabel(seconds) {
  return `${fmt(seconds * 1000)} ms from top to bottom`;
}

export function turnLabel(degrees) {
  const turns = degrees / 360;
  if (degrees < 1) return 'less than a degree';
  if (degrees < 360) return `${fmt(degrees)}°`;
  return `${fmt(degrees)}° (${fmt(turns, turns < 10 ? 1 : 0)} turns)`;
}

// How far behind real time the animation runs, so one readout lasts a few seconds.
export function slowdown(readout) {
  return WALL_SECONDS_PER_READOUT / readout;
}

export function slowdownLabel(readout) {
  const s = slowdown(readout);
  return `${fmt(s, s < 10 ? 1 : 0)} times slower than life`;
}

// What the photo will look like, in a sentence. Exactly where pieces appear
// also depends on where the blades stand when the sweep starts.
export function verdict(prop, readout) {
  const deg = turnDuringReadout(prop, readout);
  if (deg < 3) return 'The blades barely move while the rows are captured, so they come out straight.';
  if (deg < 45) return 'The blades turn a little while the rows are captured, so they come out gently bent.';
  if (deg <= 360 + 1e-9) return 'The blades turn up to a full circle while the rows are captured: they come out curved and lopsided, and depending on where they start, a piece can come out detached from the hub.';
  return 'The propeller turns more than once while the rows are captured, so a blade can be caught several times on its way down the picture: expect curved pieces, often detached from the hub.';
}

export function rows(prop, readout) {
  return [
    ['Propeller', speedLabel(prop.rpm)],
    ['Sensor readout', readoutLabel(readout)],
    ['Turn during one readout', turnLabel(turnDuringReadout(prop, readout))],
    ['Animation', slowdownLabel(readout)],
  ];
}
