# linkwork

A four-bar linkage lab in the browser. Two fixed pivots, three moving bars and
a point riding on the middle bar: turn the crank and the point traces a
coupler curve, which can be an oval, a teardrop, a figure eight or a stretch
that is almost perfectly straight. Drag any pivot or joint to reshape the
linkage and the curve is redrawn at once.

**Live demo:** https://fushanbobfan.github.io/linkwork/

No build step and no dependencies. The kinematics, the Grashof rule and the
starting linkages are plain ES modules covered by a Node test suite; only
`src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The linkage

| Bar | Joins | Moves |
| --- | --- | --- |
| Ground AD | the two fixed pivots | never |
| Crank AB | A to B | turns about A; this is the input |
| Coupler BC | B to C | floats, carrying the coupler point P |
| Rocker DC | D to C | swings about D |

The coupler point P is fixed to the coupler, so B, C and P form a rigid
triangle (drawn shaded). For each crank angle the loop can usually close in
two ways, mirror images across the line BD. These are the two assemblies;
**Other assembly** (<kbd>F</kbd>) switches between them.

## Grashof's rule

Call the shortest bar s, the longest l and the other two p and q. Some bar
turns fully relative to its neighbours exactly when s + l < p + q, and which
bar is shortest decides how the input and output move:

| Shortest bar | Type | Input AB | Output DC |
| --- | --- | --- | --- |
| crank | crank-rocker | turns | rocks |
| ground | double crank (drag link) | turns | turns |
| rocker | rocker-crank | rocks | turns |
| coupler | Grashof double rocker | rocks | rocks |
| (s + l > p + q) | triple rocker | rocks | rocks |

When s + l = p + q the bars can lie flat in a line (a change point), where
the linkage can switch assembly. The readout shows the type, both sums and
the range of crank angles, and a test checks the rule against the solver on
more than a thousand random linkages.

## Toggles

A crank that cannot turn fully stops where coupler and rocker line up. At
that toggle the two assemblies meet, and the motion carries on backwards in
the other one. Running such a linkage bounces between its two toggles and its
coupler curve is one closed loop made from both assemblies.

The transmission angle is the angle between coupler and rocker at C. Near
90&deg; the coupler pushes the rocker squarely; near 0&deg; or 180&deg; it
pulls almost along the rocker and can barely turn it. The readout shows the
current angle and the worst one over a whole cycle.

## Cognates

Every coupler curve is drawn by three different four-bars: the
Roberts&ndash;Chebyshev theorem, after Samuel Roberts and Pafnuty Chebyshev. **Show the two cognates**
(<kbd>G</kbd>) adds them to the stage and lists their bars; **Use cognate 1**
or **2** makes one of them the linkage on the stage.

Write the bars as vectors, crank &alpha; = B &minus; A, coupler
&beta; = C &minus; B and rocker &gamma; = C &minus; D, and the coupler point as
P = B + z&beta; with z a complex number. The loop closes when
&beta; = (D &minus; A) + &gamma; &minus; &alpha;, which gives

| Joint | Position | Moves on |
| --- | --- | --- |
| O, the third pivot | A + z(D &minus; A) | fixed |
| E | A + z&beta; | a circle about A |
| G | O + z&gamma; = E + z(P &minus; E) | a circle about O |
| F | D + (z &minus; 1)&beta; | a circle about D |
| H | O + (1 &minus; z)&alpha; = F + (1 &minus; z)(P &minus; F) | a circle about O |

so A, E, G, O is a four-bar with P on its coupler EG, and so is D, F, H, O.
The triangle A, D, O is similar to the coupler triangle B, C, P. The tests
check that every cognate bar keeps its length through a whole cycle and that
each cognate, solved on its own from scratch, retraces the original curve.

Both cognates of the crossed Chebyshev linkage are the lambda linkage, one
on each side, and the tests check the bar lengths match exactly. When P sits
on B or C the cognates collapse, since one of their bars has no length.

## Starting linkages

| Linkage | Bars (ground, crank, coupler, rocker) | What to look for |
| --- | --- | --- |
| Crank-rocker | 4, 1.5, 4, 3 | a full-turn crank and a looping curve |
| Chebyshev's straight line | 4, 5, 2, 5, crossed, P at the coupler midpoint | between x = 0 and x = 4 the curve rises at most 0.01 above the line y = 4 |
| Chebyshev lambda | 2, 1, 2.5, 2.5, P at 5 along the coupler | a cognate of the crossed linkage, driven by a crank that turns fully |
| Watt's linkage | 6.08, 3, 1, 3, P at the coupler midpoint | a figure eight with a nearly straight middle |
| Drag link | 1, 3, 3.5, 2.5 | both cranks turn fully |
| Triple rocker | 4.5, 2.6, 2.6, 2.6 | no bar turns; the curve runs through both assemblies |

The tests confirm that the crossed Chebyshev linkage and the lambda linkage
trace the same curve to within 0.02 of each other.

## How it is computed

- **Position analysis.** B is placed from the crank angle. C is the
  intersection of the circle of radius b about B and the circle of radius c
  about D; the assembly picks which of the two intersections. P follows from
  B and the direction of BC.
- **Crank range.** The loop closes when |BD| lies between |b &minus; c| and
  b + c. By the law of cosines this bounds the cosine of the crank angle
  measured from the ground line, which gives the arc between the two toggles
  in closed form.
- **Curves.** A full-turn crank is sampled evenly. Near a toggle the coupler
  moves like the square root of the distance to it, so a rocking input is
  sampled with cosine spacing to keep points even along the curve.
- **Editing.** Dragging B sets the crank length and angle, dragging C sets
  the coupler and rocker lengths, dragging P moves it on the coupler, and
  dragging A or D moves a pivot. A change that the loop cannot follow is
  refused.

## Controls

| Action | Effect |
| --- | --- |
| Drag A, D, B, C or P | reshape the linkage |
| Arrow keys with the stage focused | turn the crank (shift for small steps) |
| <kbd>Space</kbd> or **Run** | start or stop the crank |
| <kbd>R</kbd> or **Reverse** | reverse the crank |
| <kbd>F</kbd> or **Other assembly** | switch assembly |
| <kbd>G</kbd> or **Show the two cognates** | draw the cognates |
| Bar fields | set exact lengths |

## Code layout

| File | Contents |
| --- | --- |
| `src/linkage.js` | position analysis, crank range, a full cycle, stepping through toggles |
| `src/grashof.js` | Grashof classification and whether the loop can close |
| `src/cognates.js` | the third pivot and the two Roberts-Chebyshev cognates |
| `src/presets.js` | the starting linkages |
| `src/main.js` | the page |

## License

MIT. See [LICENSE](LICENSE).
