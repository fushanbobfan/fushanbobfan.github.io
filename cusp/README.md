# cusp

A wheel on a pivot, a pin on its rim, two rubber bands. One band runs from the
pin to a fixed point A; you hold the free end C of the other. Move C slowly and
the wheel turns slowly, until at some point it snaps round on its own. Move C
back the way it came and the wheel stays put well past that point before it
snaps back. This is E. C. Zeeman's catastrophe machine, and this page draws the
curved diamond in the plane of your hand that decides all of it.

**Live demo:** https://fushanbobfan.github.io/cusp/

No build step and no dependencies. The model is plain ES modules covered by a
Node test suite; only `src/main.js` and `src/view.js` touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What to try

- **Down and back.** C crosses the diamond from top to bottom and returns. The
  wheel snaps at the far edge each way, and the orange crosses mark two
  different places.
- **Round the cusp.** C goes from above the diamond to below it around the
  tip. The wheel ends up in the same well as if it had snapped, and it got
  there smoothly.
- **Straight along.** C passes through the diamond side to side. A second well
  opens and closes next to the wheel, which never uses it.
- **Into the tip.** C approaches along the axis, a hair above it. One well
  splits into two and that hair picks the side.

Drag C anywhere, or focus the machine and use the arrow keys (Shift for bigger
steps). C follows the pointer at a limited speed, since the story depends on a
slow hand.

## The model

With wheel radius r and pin angle θ, a band of rest length l and length L stores
½k(L − l)² when stretched and nothing when slack. Taking the fixed band's
stiffness as 1 and the moving band's as s,

    V(θ; C) = ½ (L_A − l)₊² + ½ s (L_C − l)₊²

The wheel rests at the minima of V. The page only builds machines with
l < a − r, so the fixed band is taut at every angle.

**The set.** A well disappears where V′ = V″ = 0. For a given θ, write
C = pin + L(αR + βT), with R and T the radial and tangent units at the pin. The
moving band's torque is −s(L − l)rβ. With α = sin φ and |β| = cos φ, V′ = 0
fixes the stretch from φ, and V″ becomes a function of φ alone. A one-dimensional
root search per angle gives every fold point, and neighbouring angles link into
curves. Where two roots vanish within one angle step, bisecting the angle fills
in the hairpin. Cusps are the points where V‴ also vanishes, found by bisecting
sign changes of V‴ along the curve.

**Stiff machines.** With the pin at θ = π the fixed band exerts no torque, so the
moving band can balance it with no stretch. If s r² is larger than the size of
the fixed band's curvature there, part of the circle where the moving band just
goes taut joins the set: inside it the pin at π is a hill, outside it a well, and
V″ jumps across it. On those machines the side cusps can be replaced by corners.

**The default machine** (r = 0.5, a = 2, l = 1, s = 1) has one closed curve with
four cusps. The two on the axis have closed forms from V″(0) = 0 and V″(π) = 0,
at x = −1.4041 and x = −2.4557; the other two are numerical, at
(−1.8669, ±0.7175).

**The wheel** is a rotor with light inertia and damping, integrated in substeps
of at most 2 ms. A separate tracker rolls downhill from the last rest position
as C moves in steps of 0.004. A jump above 0.3 rad between neighbouring steps is
reported as a snap; so is a wheel whose own swing carries it over a low barrier
into another well.

## What the tests check

- The torque and both higher derivatives against finite differences, with slack
  bands and the mirror symmetry of the machine.
- Every traced fold point has zero torque and zero curvature to 1e-9; the axis
  cusps match the closed forms to 1e-6; every cusp has V‴ near zero.
- The count of wells from a brute scan of the energy changes at the same places
  that horizontal lines cross the traced curve.
- The tours do what their labels say on four different machines: two snaps, or
  none.
- The live wheel, stepped at 60 frames a second at the tour's speed, snaps within
  0.04 of the diamond's edges in both directions.

- A survey of 416 machines across the slider range gave one closed curve each,
  with 386 at four cusps and 30 at two. Six of them, chosen for being soft, stiff
  or hairpinned, are kept as tests, including that two wells lie inside the curve
  and one outside at 97% or more of a grid of points.

The tracker's jump threshold means a jump smaller than 0.3 rad, close to a cusp
where the two wells merge, is not reported as a snap.

## References

- E. C. Zeeman, "A catastrophe machine", in *Towards a Theoretical Biology* 4,
  ed. C. H. Waddington, Edinburgh University Press, 1972.
- T. Poston and A. Woodcock, "Zeeman's catastrophe machine", *Proceedings of the
  Cambridge Philosophical Society* 74, 1973.

## License

MIT
