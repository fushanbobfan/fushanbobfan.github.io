// Video: a string of rolling-shutter photos taken at a fixed frame rate.
//
// Between two frames the propeller turns (rpm / 60) / fps of a turn. A
// propeller with n identical blades looks the same after 1/n of a turn, so the
// eye can only judge the turn modulo 360°/n and takes the smallest one: the
// wagon-wheel effect.

export const FRAME_RATES = [24, 25, 30, 50, 60, 120, 240];

// Degrees the propeller really turns from one frame to the next (signed).
export function frameTurn(prop, fps) {
  return prop.direction * (prop.rpm / 60 / fps) * 360;
}

// Degrees it seems to turn from one frame to the next: the real turn wrapped
// into (-180/n, 180/n].
export function apparentTurn(prop, fps) {
  const spacing = 360 / prop.blades;
  const real = frameTurn(prop, fps);
  let w = real - spacing * Math.round(real / spacing);
  if (w <= -spacing / 2) w += spacing;
  // Clean up rounding noise so an exact match reads as standing still.
  if (Math.abs(w) < 1e-9) w = 0;
  return w;
}

export function apparentRpm(prop, fps) {
  return (apparentTurn(prop, fps) / 360) * fps * 60;
}

// Rpm values (from 0 up to maxRpm) at which the propeller seems to stand
// still: one blade spacing, or a whole number of them, per frame.
export function standstillRpms(blades, fps, maxRpm) {
  const step = (fps * 60) / blades;
  const out = [];
  for (let k = 1; k * step <= maxRpm + 1e-9; k++) out.push(k * step);
  return out;
}

// The longest readout a sensor can have at this frame rate: one frame period.
export function maxReadout(fps) {
  return 1 / fps;
}

// How the motion looks on screen, in words.
export function motionVerdict(prop, fps) {
  const real = frameTurn(prop, fps);
  const seen = apparentTurn(prop, fps);
  const spacing = 360 / prop.blades;
  if (prop.rpm === 0) return 'The propeller is standing still.';
  if (seen === 0) {
    return 'The propeller turns exactly a whole number of blade spacings between frames, so on video it seems to hang still in the air, bent by the rolling shutter.';
  }
  const sameWay = Math.sign(seen) === Math.sign(real);
  const slow = Math.abs(seen) < spacing / 12;
  if (Math.abs(real) < spacing / 2) {
    return 'The propeller turns less than half a blade spacing between frames, so the video shows its true motion.';
  }
  if (sameWay) {
    return slow
      ? 'Just over a whole number of blade spacings between frames: on video the propeller creeps forwards, much slower than it really turns.'
      : 'More than half a blade spacing between frames: on video the propeller seems to turn forwards, at the wrong speed.';
  }
  return slow
    ? 'Just under a whole number of blade spacings between frames: on video the propeller seems to creep backwards.'
    : 'More than half a blade spacing between frames: on video the propeller seems to turn backwards.';
}
