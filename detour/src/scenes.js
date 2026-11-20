// The road networks on offer. Coordinates are in the drawing's own units (720 x 420).
// Travel time on a road is a + b x minutes with x drivers on it.

export const SCENES = [
  {
    id: 'braess',
    name: "Braess's network",
    blurb: 'Two routes from S to T, each a crowded road plus a fixed 45-minute one. A free link from A to B lets drivers chain the two crowded roads.',
    source: 'S',
    sink: 'T',
    demand: 4000,
    maxDemand: 10000,
    step: 100,
    nodes: [
      { id: 'S', label: 'S', x: 70, y: 210 },
      { id: 'A', label: 'A', x: 360, y: 60 },
      { id: 'B', label: 'B', x: 360, y: 360 },
      { id: 'T', label: 'T', x: 650, y: 210 },
    ],
    roads: [
      { id: 'SA', from: 'S', to: 'A', a: 0, b: 0.01 },
      { id: 'AT', from: 'A', to: 'T', a: 45, b: 0 },
      { id: 'SB', from: 'S', to: 'B', a: 45, b: 0 },
      { id: 'BT', from: 'B', to: 'T', a: 0, b: 0.01 },
      { id: 'AB', from: 'A', to: 'B', a: 0, b: 0, optional: true, name: 'the link from A to B' },
    ],
  },
  {
    id: 'pigou',
    name: "Pigou's two roads",
    blurb: 'A wide highway that always takes an hour, and a narrow road that is quick when empty and slows with every car. Nothing to close here: the gap between the two outcomes is the cost of everyone choosing for themselves.',
    source: 'S',
    sink: 'T',
    demand: 6000,
    maxDemand: 12000,
    step: 100,
    nodes: [
      { id: 'S', label: 'S', x: 90, y: 210 },
      { id: 'T', label: 'T', x: 630, y: 210 },
    ],
    roads: [
      { id: 'hi', from: 'S', to: 'T', a: 60, b: 0, bend: -150 },
      { id: 'lo', from: 'S', to: 'T', a: 0, b: 0.01, bend: 150 },
    ],
  },
  {
    id: 'ladder',
    name: 'Two links in a row',
    blurb: 'Three crowded roads and two free links. Open either link, both, or neither, and compare.',
    source: 'S',
    sink: 'T',
    demand: 6000,
    maxDemand: 12000,
    step: 100,
    nodes: [
      { id: 'S', label: 'S', x: 60, y: 210 },
      { id: 'A', label: 'A', x: 250, y: 60 },
      { id: 'B', label: 'B', x: 250, y: 360 },
      { id: 'C', label: 'C', x: 470, y: 60 },
      { id: 'D', label: 'D', x: 470, y: 360 },
      { id: 'T', label: 'T', x: 660, y: 210 },
    ],
    roads: [
      { id: 'SA', from: 'S', to: 'A', a: 0, b: 0.01 },
      { id: 'SB', from: 'S', to: 'B', a: 50, b: 0 },
      { id: 'AC', from: 'A', to: 'C', a: 50, b: 0 },
      { id: 'BD', from: 'B', to: 'D', a: 0, b: 0.01 },
      { id: 'CT', from: 'C', to: 'T', a: 0, b: 0.01 },
      { id: 'DT', from: 'D', to: 'T', a: 50, b: 0 },
      { id: 'AB', from: 'A', to: 'B', a: 0, b: 0, optional: true, name: 'the link from A to B' },
      { id: 'DC', from: 'D', to: 'C', a: 0, b: 0, optional: true, name: 'the link from D to C' },
    ],
  },
];

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

export function optionalRoads(scene) {
  return scene.roads.filter((r) => r.optional);
}
