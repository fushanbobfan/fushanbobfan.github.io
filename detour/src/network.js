// Road networks: nodes, one-way roads with affine travel times, and the routes from start to finish.
// A road's travel time in minutes is a + b * x, where x is the number of drivers on it.

export function travelTime(road, x) {
  return road.a + road.b * x;
}

// The roads that are currently usable: every road that is not optional, and optional roads marked open.
export function openRoads(scene, open) {
  return scene.roads.filter((r) => !r.optional || open.has(r.id));
}

// Every simple route from scene.source to scene.sink over the given roads, as lists of road ids.
export function routes(scene, roads) {
  const out = new Map();
  for (const r of roads) {
    if (!out.has(r.from)) out.set(r.from, []);
    out.get(r.from).push(r);
  }
  const found = [];
  const seen = new Set([scene.source]);
  const walk = (node, path) => {
    if (node === scene.sink) {
      found.push(path.slice());
      return;
    }
    for (const r of out.get(node) || []) {
      if (seen.has(r.to)) continue;
      seen.add(r.to);
      path.push(r.id);
      walk(r.to, path);
      path.pop();
      seen.delete(r.to);
    }
  };
  walk(scene.source, []);
  return found;
}

// A route's name, read off its nodes: "S → A → T".
export function routeName(scene, route) {
  const byId = new Map(scene.roads.map((r) => [r.id, r]));
  const label = (id) => scene.nodes.find((n) => n.id === id).label;
  const nodes = [scene.source, ...route.map((id) => byId.get(id).to)];
  return nodes.map(label).join(' → ');
}

// Drivers on each road, given drivers on each route.
export function roadFlows(roads, routeList, flows) {
  const x = new Map(roads.map((r) => [r.id, 0]));
  routeList.forEach((route, i) => {
    for (const id of route) x.set(id, x.get(id) + flows[i]);
  });
  return x;
}

// Minutes each route takes, given drivers on each route.
export function routeTimes(roads, routeList, flows) {
  const x = roadFlows(roads, routeList, flows);
  const byId = new Map(roads.map((r) => [r.id, r]));
  return routeList.map((route) => route.reduce((t, id) => t + travelTime(byId.get(id), x.get(id)), 0));
}

// Total minutes spent by everyone, summed over drivers.
export function totalTime(roads, routeList, flows) {
  const t = routeTimes(roads, routeList, flows);
  return t.reduce((s, ti, i) => s + ti * flows[i], 0);
}
