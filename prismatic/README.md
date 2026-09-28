# prismatic

A two-dimensional optics bench in the browser. Place light sources, prisms,
lenses and mirrors, then watch rays refract, reflect and split at every
surface they meet. Switch a source to white light and glass spreads it into
a spectrum.

**Live demo:** https://fushanbobfan.github.io/prismatic/

No build step and no dependencies. The geometry, surface optics, tracer,
picking and parameter rules are plain ES modules covered by a Node test suite;
only `src/main.js` and `src/render.js` touch the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

- The bench opens on the **bench tour**, with white light through a dense
  flint prism. Turn the prism slowly: the spectrum swings one way, stops, and swings back. The
  turning point is minimum deviation. Change the glass to fused silica and the
  fan closes up.
- Swing the **laser** round until it meets a prism face at a steep angle from
  inside. Past the critical angle the transmitted ray vanishes and all the
  light reflects.
- Make a **right-angle prism** (apex 90°) and aim a laser square onto one of
  its short faces: it leaves turned through ninety degrees.
- Send the **beam** through the convex lens and watch it come to a focus.
  Lower the surface radius and the focus moves closer; switch the glass to
  dense flint and it moves closer still.
- Point the beam at the **curved mirror** and find its focus half a radius in
  front of it. Widen the beam and the edge rays miss that point: spherical
  aberration.
- Drop a **glass ball** into a white beam. Rays that reflect once inside it
  come back out towards the source, red at a wider angle than violet: the
  geometry of a rainbow, with glass in place of water.
- Turn off *Show faint reflections* to hide the weak Fresnel reflections and
  see only the main paths.

## Scenes and links

The *Scenes* panel loads ready-made benches:

| Scene | What it shows |
| --- | --- |
| Bench tour | a lens focusing a beam, a curved mirror, and white light split by a flint prism |
| Newton's prism | a narrow white beam through dense flint near minimum deviation |
| Rainbow in a glass ball | light reflected once inside a ball comes back out, red wider than violet |
| Prism periscope | two right-angle prisms turn a laser twice by total internal reflection |
| Light pipe | a laser trapped along a glass rod, the principle of an optical fibre |
| Lenses and aberration | edge rays of a wide beam focus closer than central ones; a concave lens spreads a beam |
| Mirror caustic | parallel light on a deep curved mirror crowds onto a bright cusped curve |
| Whispering gallery | a lamp near the rim of a ball: rays past the critical angle circle the rim for good |

The whispering gallery works because a circle keeps the angle of incidence
fixed: a ray from a lamp at distance *d* from the centre, leaving at angle φ to
the radius, meets every surface at asin(*d* sin φ / *R*). If that is past the
critical angle the first time, it is every time.

Scenes are laid out for a 900 × 600 bench and shrink on smaller screens.
**Copy link** puts the current bench in the address bar and on the clipboard;
opening the link restores it. Links hold each element's kind, position, angle
and parameters, and every value is range-checked when the link is opened.

## How it works

**Surfaces.** Every element is turned into straight segments and circular arcs
that know their outward normal. Prisms and blocks are polygons; a lens is two
arcs joined by thin edges; a glass ball is one full circle.

**Tracing.** A ray is followed to the nearest surface along its path. At a
mirror it reflects, keeping 95% of its intensity. At a blocker it stops. At
glass it splits: the angle of the refracted ray follows Snell's law,
n₁ sin θ₁ = n₂ sin θ₂, and the share of light reflected follows the Fresnel
equations for unpolarised light,

R = ½ (r_s² + r_p²), with
r_s = (n₁ cos θᵢ − n₂ cos θₜ) / (n₁ cos θᵢ + n₂ cos θₜ) and
r_p = (n₂ cos θᵢ − n₁ cos θₜ) / (n₂ cos θᵢ + n₁ cos θₜ).

The reflected ray carries R of the light and the refracted ray 1 − R. When
sin θₜ would exceed one there is no refracted ray and R = 1: total internal
reflection needs no special case. A ray stops being followed once it is
dimmer than 1% of its source, after 40 surface events, or when the bench has
drawn 40 000 segments.

**Glass.** The refractive index depends on wavelength through Cauchy's
two-term formula n(λ) = A + B / λ², with λ in micrometres. The coefficients
are the standard textbook values for fused silica, BK7 crown, BaF10 barium
flint and SF10 dense flint.

**Dispersion.** Each glass also shows its Abbe number,
V = (n_d − 1) / (n_F − n_C), from the helium d line (587.6 nm) and the
hydrogen F (486.1 nm) and C (656.3 nm) lines. Crown glass has a high V and
barely separates colours; dense flint has a low V and fans them widely.

**White light.** A white source sends one ray per sampled wavelength (12 by
default, evenly spread from 400 to 700 nm) along every path. Each wavelength
is drawn with a weight chosen so that, where the colours overlap, red, green
and blue add up to a neutral white; once glass separates them each colour
shows on its own.

**Colour.** Each ray is drawn in the approximate colour of its wavelength and
added onto the canvas, so overlapping rays brighten each other.

**Limits.** This is geometric optics in a plane: no diffraction or
interference, no polarisation beyond the Fresnel average, and glass pieces
must not overlap, because a ray meeting glass from outside is assumed to come
from air.

## Controls

| Action | Pointer | Keyboard (bench focused) |
| --- | --- | --- |
| Select | click | <kbd>.</kbd> cycles through elements, <kbd>Esc</kbd> clears |
| Move | drag the element | arrow keys, <kbd>Shift</kbd> for 10 px steps |
| Turn | drag the round handle, <kbd>Shift</kbd> snaps to 15° | <kbd>[</kbd> and <kbd>]</kbd>, <kbd>Shift</kbd> for 15° |
| Remove | *Remove* in the inspector | <kbd>Delete</kbd> |

## Layout

```
index.html        page shell
style.css         styles
src/geometry.js   vectors, segments, arcs and ray intersections
src/optics.js     reflection, Snell refraction, Fresnel reflectance, glasses
src/elements.js   element shapes, outlines and light sources
src/tracer.js     ray tracing through the bench
src/picking.js    pointer hit-testing and rotation handles
src/params.js     editable parameters and their ranges
src/spectrum.js   wavelength to display colour
src/scenes.js     ready-made benches
src/share.js      bench layouts to and from link strings
src/render.js     canvas drawing
src/main.js       interaction, inspector, scenes and links
test/             node:test suites
```

## License

MIT
