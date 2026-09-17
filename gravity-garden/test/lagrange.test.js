import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPrimaryPair, normalizedLagrangePoints, lagrangePoints } from "../src/lagrange.js";

const close = (a, b, eps) => Math.abs(a - b) <= eps;

test("pickPrimaryPair returns the two heaviest bodies, heaviest first", () => {
  const bodies = [{ mass: 5 }, { mass: 100 }, { mass: 0 }, { mass: 30 }, { mass: 7 }];
  const pair = pickPrimaryPair(bodies);
  assert.equal(pair[0], bodies[1]);
  assert.equal(pair[1], bodies[3]);
});

test("pickPrimaryPair needs two bodies with positive mass", () => {
  assert.equal(pickPrimaryPair([]), null);
  assert.equal(pickPrimaryPair([{ mass: 10 }]), null);
  assert.equal(pickPrimaryPair([{ mass: 10 }, { mass: 0 }]), null);
  assert.equal(pickPrimaryPair(null), null);
});

test("normalizedLagrangePoints rejects a mass ratio outside (0, 1)", () => {
  assert.throws(() => normalizedLagrangePoints(0), RangeError);
  assert.throws(() => normalizedLagrangePoints(1), RangeError);
  assert.throws(() => normalizedLagrangePoints(NaN), RangeError);
});

test("collinear points lie in the right intervals and satisfy the balance equation", () => {
  for (const mu of [0.001, 0.0121, 0.1, 0.3, 0.5, 0.8]) {
    const { L1, L2, L3 } = normalizedLagrangePoints(mu);
    const primaryX = -mu;
    const secondaryX = 1 - mu;
    assert.ok(L1.x > primaryX && L1.x < secondaryX, `L1 between the bodies for mu=${mu}`);
    assert.ok(L2.x > secondaryX, `L2 beyond the secondary for mu=${mu}`);
    assert.ok(L3.x < primaryX, `L3 beyond the primary for mu=${mu}`);
    for (const p of [L1, L2, L3]) {
      const dP = p.x + mu;
      const dS = p.x - 1 + mu;
      const residual =
        p.x - ((1 - mu) * dP) / Math.abs(dP) ** 3 - (mu * dS) / Math.abs(dS) ** 3;
      assert.ok(close(residual, 0, 1e-9), `residual ${residual} at x=${p.x} for mu=${mu}`);
    }
  }
});

test("for a light secondary, L1 and L2 sit about a Hill radius either side of it", () => {
  // Earth–Moon mass ratio. The Hill-sphere approximation puts L1/L2 at 1 -/+ (mu/3)^(1/3)
  // from the barycenter, good to a few percent at this ratio.
  const mu = 0.0121;
  const hill = Math.cbrt(mu / 3);
  const { L1, L2, L3 } = normalizedLagrangePoints(mu);
  assert.ok(close(L1.x, 1 - mu - hill, 0.01), `L1 ${L1.x}`);
  assert.ok(close(L2.x, 1 - mu + hill, 0.01), `L2 ${L2.x}`);
  // L3 is just outside the secondary's orbit on the far side: -1 - 5mu/12 to first order.
  assert.ok(close(L3.x, -1 - (5 * mu) / 12, 0.01), `L3 ${L3.x}`);
});

test("equal masses put L1 on the barycenter and L2/L3 mirror each other", () => {
  const { L1, L2, L3 } = normalizedLagrangePoints(0.5);
  assert.ok(close(L1.x, 0, 1e-9));
  assert.ok(close(L2.x, -L3.x, 1e-9));
});

test("L4 and L5 form equilateral triangles with the two bodies", () => {
  for (const mu of [0.01, 0.25, 0.5]) {
    const { L4, L5 } = normalizedLagrangePoints(mu);
    for (const p of [L4, L5]) {
      assert.ok(close(Math.hypot(p.x + mu, p.y), 1, 1e-12), "distance to primary");
      assert.ok(close(Math.hypot(p.x - 1 + mu, p.y), 1, 1e-12), "distance to secondary");
    }
    assert.equal(L4.y, -L5.y);
  }
});

test("lagrangePoints maps into world coordinates for any orientation and separation", () => {
  const primary = { mass: 900, x: 10, y: -5 };
  const angle = 0.7;
  const separation = 240;
  const secondary = {
    mass: 100,
    x: primary.x + Math.cos(angle) * separation,
    y: primary.y + Math.sin(angle) * separation,
  };
  const points = lagrangePoints(primary, secondary);
  assert.deepEqual(Object.keys(points), ["L1", "L2", "L3", "L4", "L5"]);

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(close(dist(points.L4, primary), separation, 1e-9));
  assert.ok(close(dist(points.L4, secondary), separation, 1e-9));
  assert.ok(close(dist(points.L5, primary), separation, 1e-9));
  assert.ok(close(dist(points.L5, secondary), separation, 1e-9));

  // The collinear points lie on the line through both bodies.
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  for (const name of ["L1", "L2", "L3"]) {
    const p = points[name];
    const off = -(p.x - primary.x) * uy + (p.y - primary.y) * ux;
    assert.ok(close(off, 0, 1e-9), `${name} on the axis`);
  }
  // L1 between the bodies, L2 past the secondary, L3 behind the primary.
  const along = (p) => (p.x - primary.x) * ux + (p.y - primary.y) * uy;
  assert.ok(along(points.L1) > 0 && along(points.L1) < separation);
  assert.ok(along(points.L2) > separation);
  assert.ok(along(points.L3) < 0);
  // L4 is counterclockwise from the axis (positive perpendicular component), L5 the other way.
  const across = (p) => -(p.x - primary.x) * uy + (p.y - primary.y) * ux;
  assert.ok(across(points.L4) > 0 && across(points.L5) < 0);
});

test("lagrangePoints returns null for coincident or massless bodies", () => {
  assert.equal(lagrangePoints({ mass: 1, x: 0, y: 0 }, { mass: 1, x: 0, y: 0 }), null);
  assert.equal(lagrangePoints({ mass: 0, x: 0, y: 0 }, { mass: 0, x: 1, y: 0 }), null);
  assert.equal(lagrangePoints({ mass: 5, x: 0, y: 0 }, { mass: 0, x: 1, y: 0 }), null);
});
