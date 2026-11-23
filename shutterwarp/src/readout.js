// Plain-language readouts for the page. No DOM access here.

import { turnDuringReadout } from './shutter.js';
import { frameTurn, apparentTurn, apparentRpm, standstillRpms, maxReadout } from './video.js';

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

// Readouts for the video section.
export function videoRows(prop, readout, fps) {
  const used = Math.min(readout, maxReadout(fps));
  const real = frameTurn(prop, fps);
  const seen = apparentTurn(prop, fps);
  const seenRpm = apparentRpm(prop, fps);
  const sameWay = Math.sign(seen) === Math.sign(real);
  let seenText;
  if (prop.rpm === 0) seenText = 'standing still';
  else if (seen === 0) seenText = 'standing still';
  else seenText = `${fmt(Math.abs(seenRpm))} rpm ${sameWay ? 'forwards' : 'backwards'}`;
  return [
    ['Frame rate', `${fps} frames a second`],
    ['Turn between frames', turnLabel(Math.abs(real))],
    ['Seen on video', seenText],
    ['Readout in each frame', used < readout
      ? `${fmt(used * 1000, 1)} ms, a whole frame: a sensor cannot take longer to read a frame than the time between frames`
      : readoutLabel(used)],
  ];
}

// The rpm nearest to `rpm` (within 0..maxRpm) at which the propeller seems to stand still.
export function nearestStandstill(rpm, blades, fps, maxRpm) {
  const list = standstillRpms(blades, fps, maxRpm);
  if (!list.length) return null;
  return list.reduce((best, s) => (Math.abs(s - rpm) < Math.abs(best - rpm) ? s : best));
}

// How the video is played back on the page.
export function playbackLabel(fps) {
  const shown = Math.min(fps, 30);
  return shown === fps
    ? `played at its own ${fps} frames a second`
    : `played at 30 frames a second, ${fmt(fps / 30, fps % 30 ? 1 : 0)} times slower than life`;
}
