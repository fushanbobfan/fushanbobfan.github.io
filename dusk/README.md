# dusk

Why the sky is blue and the setting sun red. Air molecules scatter blue light
about five times as strongly as red, so the light scattered out of a sunbeam,
arriving from every part of the sky, is blue. A low sun's light crosses dozens
of times more air, loses most of its blue on the way, and arrives orange or
red. This page works out the colour of the whole sky from that scattering, one
wavelength at a time, for any height of the sun.

**Live demo:** https://fushanbobfan.github.io/dusk/

No build step and no dependencies. The air, the scattering and the colours are
plain ES modules covered by a Node test suite; the pictures are traced in a
module worker and only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **Controls** for the sun's height (8° below the horizon to overhead), the
  amount of haze and your own height (up to 30 km), with seven starting
  points from midday to a stratospheric balloon.
- **The view towards the sun**, 120° wide and 40° tall.
- **The whole sky** as a fisheye lens sees it.
- **Readouts**: how many times more air the sunlight crosses than with the sun
  overhead, how much of its blue, green and red gets through, the colours of
  the sun's disc and of two patches of sky, and how bright the sky is compared
  with a clear midday sky.
- **Colour by colour**: a chart of sunlight above the air, the sunlight that
  reaches you on the same scale, and the shape of the light of the sky
  overhead, over a strip of the spectrum's colours.
- **An ozone switch**: take the ozone layer away and the sky overhead after
  sunset turns grey-yellow; with it, the sky stays blue.
- **A fixed camera** option. Normally the exposure follows the sky, as your
  eyes do. A camera kept at the exposure for a clear midday shows how dark the
  sky is after sunset or seen from a balloon.

## The model

- A spherical Earth with an atmosphere 100 km deep. Air molecules thin out
  exponentially with an 8.4 km scale height (which gives sea-level pressure),
  haze with a 1.2 km scale height.
- Rayleigh scattering from the refractive index of standard air (Ciddor 1996):
  beta = 8 pi^3 (n^2 - 1)^2 / (3 N lambda^4) times a 1.061 depolarisation
  factor, about 1.16e-5 per metre at 550 nm and a vertical optical depth of
  0.097, as tabulated by Bucholtz (1995).
- Haze set by its vertical optical depth at 550 nm, scattering as
  wavelength^-1.3, keeping 90% of what it meets and throwing light forwards
  with a Henyey-Greenstein phase function (g = 0.76).
- Ozone between 10 and 40 km, 300 Dobson units, with measured absorption
  cross-sections (see below).
- Single scattering: every point along a line of sight is lit by sunlight
  dimmed on its way down to that point, scatters a share of it towards the
  eye, and that light is dimmed again on its way to the eye. Columns of air are
  summed with samples crowded where the air is densest; the ozone column is
  cut where the ray enters and leaves the layer and integrated with a
  Gauss-Legendre rule. The tests check every column against a brute-force sum.
- Colour: 21 wavelengths from 380 to 780 nm, the CIE 1931 colour matching
  functions (the multi-lobe fit of Wyman, Sloan and Shirley 2013), the sRGB
  primaries, and a white balance that draws the sun seen from above the air as
  white. Sunlight above the air is a 5778 K black body.
- Left out: light scattered more than once (the horizon and the twilight sky
  come out darker than they are), clouds, and the bending of light near the
  horizon.

## Files

- `src/spectrum.js` wavelengths, sunlight and the path from a spectrum to a colour
- `src/air.js` scattering and absorption by molecules, haze and ozone
- `src/sky.js` ray geometry, columns of air and the single-scattering sky
- `src/chart.js` the spectrum chart
- `src/render-worker.js` traces the pictures off the page's thread
- `src/readout.js` labels and the description under the picture
- `src/main.js` the page

## Licence

MIT. The ozone cross-sections in `src/air.js` come from Eric Bruneton's
precomputed atmospheric scattering code under the BSD 3-clause licence; see
[THIRD-PARTY.md](THIRD-PARTY.md).
