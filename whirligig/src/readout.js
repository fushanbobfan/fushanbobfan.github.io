// Words and numbers for the page. No DOM here, so all of it is testable.

const deg = 180 / Math.PI;

export function rpmLabel(rpm) {
  const perSecond = rpm / 60;
  const each = perSecond >= 10 ? Math.round(perSecond) : Number(perSecond.toFixed(1));
  return `${rpm.toLocaleString('en-US')} rpm (${each} turns a second)`;
}

export function angleLabel(rad, digits = 0) {
  return `${(rad * deg).toFixed(digits)}°`;
}

export function pushLabel(k) {
  if (k === 0) return 'none: let go from rest';
  if (k === 1) return 'exactly the steady rate';
  const size = Math.abs(k).toFixed(2).replace(/0$/, '');
  return k > 0 ? `${size} × the steady rate` : `${size} × the steady rate, backwards`;
}

export function seconds(t) {
  if (!Number.isFinite(t)) return '—';
  if (t < 1) return `${(t * 1000).toFixed(0)} ms`;
  if (t < 10) return `${t.toFixed(2)} s`;
  return `${t.toFixed(1)} s`;
}

export function perSecond(t) {
  const n = 1 / t;
  return n >= 10 ? `${Math.round(n)} a second` : `${n.toFixed(1)} a second`;
}

export function speedLabel(f) {
  if (f === 1) return 'real time';
  return `${Math.round(1 / f)} times slower than real time`;
}

const SHAPES = {
  steady: 'a circle',
  waves: 'waves',
  cusps: 'cusps',
  loops: 'loops',
};

export function shapeLabel(kind, touches) {
  if (touches) return 'none: it falls over';
  return SHAPES[kind];
}

// One or two sentences about the motion that the controls have set up.
export function describe({ kind, thetaMin, thetaMax, tilt, floor, touches, push, rises, precessionPeriod }) {
  // A nod narrower than 3 degrees needs a decimal place to show at all.
  const digits = !touches && thetaMax - thetaMin < (3 * Math.PI) / 180 ? 1 : 0;
  // Angles within a degree of upright keep two decimals, so 0.01° does not read as 0°.
  const a = (x) => angleLabel(x, x < Math.PI / 180 ? 2 : digits);
  if (touches) {
    return `With this spin and push, the top cannot hold itself up. Its first nod would carry the axle from ${a(tilt)} out to ${thetaMax >= Math.PI / 2 - 1e-9 ? 'beyond the horizontal' : a(thetaMax)}, and the rim hits the table at ${a(floor)}.`;
  }
  if (kind === 'steady') {
    return `Pushed sideways at exactly the steady rate, the axle keeps its ${angleLabel(tilt)} tilt and sweeps out a cone, once every ${seconds(precessionPeriod)}.`;
  }
  if (kind === 'cusps') {
    return `Let go from rest, the top first drops, from ${a(thetaMin)} to ${a(thetaMax)}, and the falling itself swings it sideways. It climbs back to ${a(thetaMin)} and stops dead there every time, so the tip of the axle draws cusps.`;
  }
  if (kind === 'loops') {
    return `The axle nods between ${a(thetaMin)} and ${a(thetaMax)} and runs backwards for part of every nod, so its tip draws loops.`;
  }
  return `Pushed sideways at ${pushLabel(push)}, the top first ${rises ? 'rises' : 'sinks'}; the axle nods between ${a(thetaMin)} and ${a(thetaMax)} while it keeps going round the same way, so its tip draws waves.`;
}

export function fallStory(t, floor) {
  return `The rim hit the table ${seconds(t)} after the top was let go, with the axle ${angleLabel(floor)} from upright.`;
}
