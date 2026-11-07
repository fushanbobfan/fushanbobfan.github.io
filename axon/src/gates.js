// A small crowd of channels for the membrane picture. Each gate has a fixed
// threshold, and it is open while its gating variable is above that threshold.
// So a gate never flickers, and across many channels the share with all gates
// open tends to m^3 h for sodium and n^4 for potassium.

function lane(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeChannels(sodium, potassium, seed = 1952) {
  const random = lane(seed);
  const sample = (count) => Array.from({ length: count }, () => random());
  return {
    sodium: Array.from({ length: sodium }, () => ({ m: sample(3), h: random() })),
    potassium: Array.from({ length: potassium }, () => ({ n: sample(4) })),
  };
}

export function sodiumState(channel, m, h) {
  const gates = channel.m.map((u) => m > u);
  const ball = h > channel.h;
  return { gates, ball, open: ball && gates.every(Boolean) };
}

export function potassiumState(channel, n) {
  const gates = channel.n.map((u) => n > u);
  return { gates, open: gates.every(Boolean) };
}

export function countOpen(crowd, { m, h, n }) {
  return {
    sodium: crowd.sodium.filter((c) => sodiumState(c, m, h).open).length,
    potassium: crowd.potassium.filter((c) => potassiumState(c, n).open).length,
  };
}
