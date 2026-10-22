// Cluster labelling with union-find. Two open sites belong to the same cluster when
// a path of open links joins them; a cluster spans when it touches opposite edges.

import { downOpen, rightOpen, siteOpen } from './lattice.js';

export class UnionFind {
  constructor(n) {
    this.parent = new Int32Array(n);
    this.size = new Int32Array(n).fill(1);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }

  find(i) {
    const parent = this.parent;
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  }

  union(a, b) {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return ra;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
    return ra;
  }
}

const TOP = 1;
const BOTTOM = 2;
const LEFT = 4;
const RIGHT = 8;

// Returns, for every site, the index of its cluster (-1 for a closed site), plus the
// clusters themselves largest first.
export function labelClusters(lat, p) {
  const { size } = lat;
  const n = size * size;
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    if (rightOpen(lat, i, p)) uf.union(i, i + 1);
    if (downOpen(lat, i, p)) uf.union(i, i + size);
  }

  const rootIndex = new Map();
  const clusters = [];
  const label = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!siteOpen(lat, i, p)) {
      label[i] = -1;
      continue;
    }
    const r = uf.find(i);
    let k = rootIndex.get(r);
    if (k === undefined) {
      k = clusters.length;
      rootIndex.set(r, k);
      clusters.push({ id: k, size: 0, edges: 0, first: i });
    }
    const c = clusters[k];
    c.size++;
    const x = i % size;
    const y = (i - x) / size;
    if (y === 0) c.edges |= TOP;
    if (y === size - 1) c.edges |= BOTTOM;
    if (x === 0) c.edges |= LEFT;
    if (x === size - 1) c.edges |= RIGHT;
    label[i] = k;
  }

  for (const c of clusters) {
    c.spansVertical = (c.edges & (TOP | BOTTOM)) === (TOP | BOTTOM);
    c.spansHorizontal = (c.edges & (LEFT | RIGHT)) === (LEFT | RIGHT);
    c.spans = c.spansVertical || c.spansHorizontal;
    delete c.edges;
  }

  // Order largest first (ties by first site, so the order is stable), then relabel.
  const order = clusters.slice().sort((a, b) => b.size - a.size || a.first - b.first);
  const rank = new Int32Array(order.length);
  order.forEach((c, j) => { rank[c.id] = j; c.id = j; });
  for (let i = 0; i < n; i++) if (label[i] >= 0) label[i] = rank[label[i]];

  return { label, clusters: order };
}

export function summarise({ label, clusters }) {
  const open = clusters.reduce((s, c) => s + c.size, 0);
  const largest = clusters.length ? clusters[0].size : 0;
  const spanning = clusters.filter((c) => c.spans);
  // Mean size of the cluster a randomly chosen open site sits in, leaving out
  // spanning clusters: the quantity that diverges at the threshold.
  let sq = 0;
  let finite = 0;
  for (const c of clusters) {
    if (c.spans) continue;
    sq += c.size * c.size;
    finite += c.size;
  }
  return {
    sites: label.length,
    open,
    count: clusters.length,
    largest,
    largestFraction: largest / label.length,
    spans: spanning.length > 0,
    spansVertical: spanning.some((c) => c.spansVertical),
    spansHorizontal: spanning.some((c) => c.spansHorizontal),
    spanningSize: spanning.reduce((s, c) => s + c.size, 0),
    meanFiniteSize: finite ? sq / finite : 0,
  };
}

// Size distribution: how many clusters have each size.
export function sizeHistogram(clusters) {
  const counts = new Map();
  for (const c of clusters) counts.set(c.size, (counts.get(c.size) || 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}
