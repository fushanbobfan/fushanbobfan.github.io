# iris

Rainbows in the browser. Follow a ray of sunlight into a raindrop, bounce it
once or twice off the back, and see where it leaves. Rays from every part of
the drop leave at different angles, except near one ray, Descartes' rainbow
ray, where they bunch up. That bunching is the bow, and the page renders the
sky it makes: the primary bow, the fainter secondary with its colours
reversed, and the dark band between them.

**Live demo:** https://fushanbobfan.github.io/iris/

No build step and no dependencies. The optics, the colour science and the
sky geometry are plain ES modules covered by a Node test suite; only
`src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The three views

| View | What it shows |
| --- | --- |
| Sky | the rain opposite the sun, rendered from the spectrum of light the drops send back, with a cross at the antisolar point (the shadow of your head) |
| Inside a drop | one ray in red, green and violet, or a fan of parallel rays, and the angle it leaves at |
| Where each ray goes | that angle against the ray's impact parameter, with a histogram of where an evenly lit drop sends its light |

The dashed ring on the sky is where the ray in the drop would appear. Drag in
the drop, or use the arrow keys, to move the ray and the ring follows.

## The angle of the bow

A ray meets the drop at impact parameter x, its offset from the centre in
drop radii. It enters at incidence angle i = asin x and bends to r, with
sin i = n sin r. Every chord inside meets the surface at r again, so after k
reflections the ray has turned by

D = 2(i &minus; r) + k(180&deg; &minus; 2r).

The angle from the antisolar point is 180&deg; minus D folded into
[0&deg;, 180&deg;]. It is stationary where

cos&sup2; i = (n&sup2; &minus; 1) / (k(k + 2)),

and that ray is the rainbow ray. With the refractive index of water this
gives:

| | Violet (400 nm) | Red (700 nm) |
| --- | --- | --- |
| Primary, k = 1 | 40.6&deg; | 42.5&deg; |
| Secondary, k = 2 | 53.6&deg; | 50.2&deg; |

No ray with one reflection leaves farther than the primary angle and none
with two leaves closer than the secondary angle, so the 7.7&deg; between them
gets no light from either: Alexander's dark band, after Alexander of
Aphrodisias. Inside the primary the sky is brighter than outside the
secondary. With the sun more than about 42&deg; up the primary is entirely
below the horizon, which is why rainbows are a morning and late-afternoon
sight from the ground. **Seen from the air** drops the ground and shows the
full circle.

The tests find the rainbow ray both from the closed form and by searching
the angle numerically, and trace every path with vector refraction and
reflection to check the formula for D.

## Brightness and colour

- **Fresnel weights.** Each ray keeps (1 &minus; R)&sup2; R<sup>k</sup> of
  its power, where R is the Fresnel reflectance at incidence i. Reflectance is
  the same from either side of the surface, so every internal bounce costs the
  same. The rainbow ray of the primary keeps about 4.6% of its light and that
  of the secondary about 2%. R is computed separately for light polarized
  across and along the plane of scattering; the primary's rainbow ray is more
  than 90% polarized along the bow.
- **Radiance by angle.** Rays are spread evenly over the drop's cross-section,
  sampled evenly in x&sup2;, and each one's weight goes to the angle it leaves
  at. Dividing by the solid angle of each ring of sky gives radiance. The sun
  is half a degree across, so the profile is blurred by its disc, which also
  removes the infinite spike geometric optics predicts at the bow.
- **The secondary is fainter.** Its peak comes out at about 0.17 of the
  primary's. A test checks this against the caustic estimate
  w x / (sin &alpha; &radic;|&alpha;''|), with w the rainbow ray's throughput
  and &alpha;'' the curvature of the angle at the rainbow ray.
- **Water.** n(&lambda;) = A + B/&lambda;&sup2;, fitted through n = 1.3311 at
  656.3 nm and n = 1.3371 at 486.1 nm. It gives 1.3329 at 589.3 nm.
- **Colour.** The spectrum at each angle is weighted by a 5778 K blackbody
  for sunlight, turned into XYZ with the CIE 1931 colour-matching functions in
  the analytic fit of Wyman, Sloan and Shirley (2013), and into sRGB, white
  balanced so that unfiltered sunlight is white.
- **Projection.** The sky is drawn in stereographic projection, which keeps
  circles on the sky circular on the page, so the bows stay round across a
  wide view.

## Through a polarizing filter

The plane of scattering holds the sun, the drop and the eye, so on the sky it
runs along the great circle through the antisolar point. Light polarized
across that plane (s) vibrates along the bow and light in it (p) across the
bow. An ideal filter whose axis makes angle &psi; with the direction toward
the antisolar point passes sin&sup2;&psi; of the s light and cos&sup2;&psi; of
the p light.

**Look through a polarizing filter** (<kbd>P</kbd>) applies this at every
point of the sky, with the axis set by **Filter axis** and drawn in the
corner. The light of the primary bow is about 90% polarized along the bow,
so with the axis horizontal the top of the bow is bright and its feet fade;
turn the axis upright and the top nearly vanishes. The secondary is less
polarized, about 77%, and the light inside the primary much less. The page
works out the direction toward the antisolar point on the page by stepping
along the great circle and projecting, which is exact because the
stereographic projection preserves angles. A filter always takes half of
unpolarized light, so the exposure is doubled under it and the plain sky
keeps its brightness.

## Drop size and wave optics

Rays alone make every bow the same whatever the size of the drops. Real
bows are not: the light near the rainbow ray leaves the drop on a wavefront
bent into a cubic, and its interference sets the shape of the bow. This is
Airy's theory of the rainbow. **Wave optics for drops of this size** turns it
on, and **Drop diameter** runs from 0.05 mm drizzle to 5 mm downpour.

Writing the deviation near the rainbow ray as
&alpha;(x) &asymp; &alpha;<sub>R</sub> &minus; &alpha;''(x &minus; x<sub>R</sub>)&sup2;/2,
a drop of radius a tilts the outgoing wavefront by &minus;C u&sup2; at
distance u from the rainbow ray, with C = &alpha;''/(2a&sup2;). Its far field
is Ai(s&epsilon;), with &epsilon; the angle from the geometric bow toward its
dark side, s = (k&sup2;/C)<sup>1/3</sup> and k the wavenumber, so

- the brightest ring sits 1.019/s inside the geometric bow, not on it;
- the supernumerary bands follow at the next maxima of Ai&sup2;, 3.248/s,
  4.820/s and so on, closer together the farther in they are;
- some light reaches the dark side, falling off smoothly.

Because s grows as a<sup>2/3</sup>, small drops spread all of this out. For
green light a 1 mm drop moves the bow in by about 0.3&deg; with the first
supernumerary 0.7&deg; inside it; at 0.2 mm the shift is about 0.9&deg; and
the bands are 2&deg; apart and plain to see; at 0.05 mm each colour's bow is
several degrees wide, the colours overlap and the bow turns almost white.
The readout gives the shift and the spacing for green light.

Averaged over its fringes, 2&pi;&radic;s Ai&sup2;(s&epsilon;) tends to
1/&radic;(&minus;&epsilon;), the shape of the geometric caustic, and the tests
check that numerically. Within 0.8&deg; of the bow the page uses the Airy
intensity scaled to that caustic. Farther in the cubic approximation drifts,
so the traced profile is kept and multiplied by the fringes, which leaves its
average unchanged; the tests compare both regions with the rays. Where the
fringes grow finer than the 0.05&deg; angle bins, they fade out over a short
stretch and the rays carry on alone.

Ai itself comes from its power series on [&minus;5, 5], its asymptotic series
above 5, and below &minus;5 from integrating Ai'' = x Ai with fourth-order
Runge&ndash;Kutta, read back by cubic Hermite interpolation. The tests check
it against tabulated values, its first five zeros and the zeros of its slope.

Airy's theory still treats the drop as large compared with the wavelength;
for the smallest drops a full Mie calculation differs in detail.

## Controls

| Action | Effect |
| --- | --- |
| Drag in the drop, or arrow keys with it focused | move the incoming ray (shift for small steps) |
| <kbd>1</kbd>, <kbd>2</kbd> | one or two reflections |
| <kbd>D</kbd> or **Go to the rainbow ray** | jump to Descartes' ray |
| <kbd>P</kbd> or **Look through a polarizing filter** | view the sky through a filter; **Filter axis** turns it |
| **Wave optics** and **Drop diameter** | render the sky with Airy's theory for drops of that size |
| Sun elevation | raise or lower the sun and the antisolar point |
| Exposure | brighten or dim the rendered bows |

## Code layout

| File | Contents |
| --- | --- |
| `src/water.js` | refractive index of water and the wavelengths used |
| `src/optics.js` | deviation, the rainbow ray, Fresnel weights, ray tracing in a drop |
| `src/color.js` | colour-matching functions, sunlight, spectrum to sRGB |
| `src/scatter.js` | radiance by angle from the antisolar point, Airy's theory near the bows, blurred by the sun |
| `src/airy.js` | the Airy function and the scale of Airy's rainbow |
| `src/sky.js` | angles on the sky and the stereographic projection |
| `src/polarizer.js` | the direction of the bow's polarization on the page and the filter's weights |
| `src/main.js` | the page |

## License

MIT. See [LICENSE](LICENSE).
