// Share links carry the machine, the control point and the wheel's angle, since
// inside the diamond the control point alone does not say where the wheel rests.

import { CLASSICAL, isValidMachine } from './machine.js';

const round = (v, digits) => String(Number(v.toFixed(digits)));

export const DEFAULT_CONTROL = Object.freeze({ x: -2, y: 1 });
export const DEFAULT_ANGLE = 1.5;

export function encodeState({ machine, control, theta }) {
  const params = new URLSearchParams();
  params.set('a', round(machine.a, 3));
  params.set('l', round(machine.l, 3));
  params.set('s', round(machine.s, 3));
  params.set('x', round(control.x, 3));
  params.set('y', round(control.y, 3));
  params.set('t', round(theta, 3));
  return params.toString();
}

function number(params, key, fallback) {
  if (!params.has(key)) return fallback;
  const v = Number(params.get(key));
  return Number.isFinite(v) ? v : fallback;
}

export function decodeState(text) {
  const params = new URLSearchParams(text.replace(/^#/, ''));
  const machine = {
    r: CLASSICAL.r,
    a: number(params, 'a', CLASSICAL.a),
    l: number(params, 'l', CLASSICAL.l),
    s: number(params, 's', CLASSICAL.s),
  };
  return {
    machine: isValidMachine(machine) ? machine : { ...CLASSICAL },
    control: {
      x: number(params, 'x', DEFAULT_CONTROL.x),
      y: number(params, 'y', DEFAULT_CONTROL.y),
    },
    theta: number(params, 't', DEFAULT_ANGLE),
  };
}
