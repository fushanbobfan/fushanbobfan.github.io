// Two-stage growth. A falling snowflake passes through air of changing
// temperature and humidity; here that is one switch of parameters when the
// crystal has grown a chosen fraction of the way to the edge.

import { step, setParams, EDGE_MARGIN } from './reiter.js';

// `second` holds the parameters for the second stage, or null for one stage.
// `at` is the switch point as a fraction of the distance to the edge.
export function createSchedule(second = null, at = 0.5) {
  return { second, at, switchedAt: -1 };
}

// Radius (in cells) at which the schedule switches on a given grid.
export function switchRadius(schedule, grid) {
  return Math.max(1, Math.round(schedule.at * (grid.radius - EDGE_MARGIN)));
}

// Advance up to `times` steps, switching parameters on the first step after
// the ice reaches the switch radius. Returns true if the switch happened.
export function advance(model, schedule, times = 1) {
  if (!schedule.second || schedule.switchedAt >= 0) {
    step(model, times);
    return false;
  }
  const radius = switchRadius(schedule, model.grid);
  for (let t = 0; t < times && !model.done; t++) {
    if (model.extent >= radius) {
      setParams(model, schedule.second);
      schedule.switchedAt = model.step;
      step(model, times - t);
      return true;
    }
    step(model, 1);
  }
  return false;
}
