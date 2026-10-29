// Roberts-Chebyshev cognates: every four-bar coupler curve is traced by two
// other four-bars as well. Points are treated as complex numbers.
//
// Write the crank, coupler and rocker as vectors alpha = B - A,
// beta = C - B, gamma = C - D, and the coupler point as P = B + z beta.
// Closing the loop, beta = (D - A) + gamma - alpha, gives
//   E = A + z beta            turns about A           (cognate 1 crank)
//   G = O + z gamma = E + z (P - E)                   (cognate 1 rocker)
//   F = D + (z - 1) beta      turns about D           (cognate 2 crank)
//   H = O + (1 - z) alpha = F + (1 - z) (P - F)       (cognate 2 rocker)
// with the third fixed pivot O = A + z (D - A). Each moving joint stays a
// fixed distance from its pivot and from its neighbour, and P sits on both
// new couplers.

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (z, p) => ({ x: z.x * p.x - z.y * p.y, y: z.x * p.y + z.y * p.x });
const len = (p) => Math.hypot(p.x, p.y);

// z for a link with coupler offsets (u, v): P - B = (u + i v)(C - B) / b.
export function couplerRatio(link) {
  return { x: link.u / link.b, y: link.v / link.b };
}

export function thirdPivot(link) {
  return add(link.A, mul(couplerRatio(link), sub(link.D, link.A)));
}

// Joint positions of both cognates for one pose of the original linkage.
export function cognatePose(link, pose) {
  const { A, D } = link;
  const { B, C, P } = pose;
  const z = couplerRatio(link);
  const O = thirdPivot(link);
  const E = add(A, sub(P, B));
  const F = add(D, sub(P, C));
  const G = add(E, mul(z, sub(P, E)));
  const H = add(F, mul({ x: 1 - z.x, y: -z.y }, sub(P, F)));
  return { O, E, F, G, H };
}

// The two cognates as links of the same shape as the original, so the
// solver and the page can treat them like any other linkage.
export function cognateLinks(link, pose) {
  const { O, E, F, G, H } = cognatePose(link, pose);
  const P = pose.P;
  const one = { A: link.A, D: O, a: len(sub(E, link.A)), b: len(sub(G, E)), c: len(sub(G, O)) };
  Object.assign(one, offsets(E, G, P));
  const two = { A: link.D, D: O, a: len(sub(F, link.D)), b: len(sub(H, F)), c: len(sub(H, O)) };
  Object.assign(two, offsets(F, H, P));
  return [
    { link: one, B: E, C: G },
    { link: two, B: F, C: H },
  ];
}

function offsets(B, C, P) {
  const b = len(sub(C, B));
  const e = { x: (C.x - B.x) / b, y: (C.y - B.y) / b };
  const p = sub(P, B);
  return { u: p.x * e.x + p.y * e.y, v: -p.x * e.y + p.y * e.x };
}
