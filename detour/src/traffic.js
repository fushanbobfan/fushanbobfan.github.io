// Cars for the picture. Each route sends out cars in proportion to the drivers on it, and a car
// crosses each road in that road's travel time, so slow roads fill up with cars the way real ones do.
// Pure state, advanced in simulated minutes, so it can be tested without a page.

import { travelTime } from './network.js';

// A free link takes 0 minutes; cars still need a moment on screen to be seen crossing it.
export const MIN_VISIBLE_MINUTES = 0.6;

export function createTraffic() {
  return { cars: [], owed: new Map(), nextId: 0 };
}

// plan: { routes: [[road id]], flows: [drivers], roads: Map id -> road, roadFlows: Map id -> drivers, carsPerMinute }
export function advance(state, plan, dt) {
  const total = plan.flows.reduce((s, f) => s + f, 0);
  const keyOf = (r) => r.join('>');
  const live = new Set(plan.routes.map(keyOf));
  state.cars = state.cars.filter((c) => live.has(c.key));

  const roadMinutes = (id) => Math.max(MIN_VISIBLE_MINUTES, travelTime(plan.roads.get(id), plan.roadFlows.get(id) || 0));
  for (const car of state.cars) {
    let left = dt;
    while (left > 0 && !car.done) {
      const m = roadMinutes(car.route[car.leg]);
      const need = (1 - car.t) * m;
      if (left < need) {
        car.t += left / m;
        left = 0;
      } else {
        left -= need;
        car.leg += 1;
        car.t = 0;
        if (car.leg >= car.route.length) car.done = true;
      }
    }
  }
  state.cars = state.cars.filter((c) => !c.done);

  if (total > 0) {
    plan.routes.forEach((route, i) => {
      const key = keyOf(route);
      const owed = (state.owed.get(key) || 0) + (plan.carsPerMinute * dt * plan.flows[i]) / total;
      let whole = Math.floor(owed);
      state.owed.set(key, owed - whole);
      while (whole-- > 0) state.cars.push({ id: state.nextId++, key, route, routeIndex: i, leg: 0, t: 0, done: false });
    });
  }
  return state;
}

// How many cars to send out per simulated minute: more drivers, more cars.
export function carsPerMinute(demand) {
  return demand / 2000;
}
