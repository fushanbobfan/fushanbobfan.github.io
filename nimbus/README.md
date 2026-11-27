# nimbus

The electron clouds of the hydrogen atom. An electron bound to a proton has
no orbit to follow; quantum mechanics gives it a wavefunction ψ, and |ψ|² is
the chance of finding it at each point. This page draws that chance for every
orbital up to n = 6 (1s to the eleven 6h orbitals), straight from the exact
solutions of the Schrödinger equation.

**Live demo:** https://fushanbobfan.github.io/nimbus/

No build step and no dependencies. The wavefunctions, the sampling and the
pictures are plain ES modules covered by a Node test suite; only
`src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **Pickers** for the shell n, the shape l (s, p, d, f, g, h) and the
  orientation m, named the way chemistry texts name them (2p x, 3d x²−y²,
  4f xyz, ...), with a sentence counting the orbital's nodes: n − l − 1
  spheres, |m| planes and l − |m| cones through the nucleus.
- **A point cloud** of up to 150 000 places the electron could be found, each
  drawn from |ψ|² and coloured by the sign of ψ. Drag it or use the arrow
  keys to turn it; it turns slowly on its own unless your system asks for
  reduced motion.
- **A slice** through the nucleus on the xz, xy or yz plane. The default
  shading spans four decades of density, so faint outer lobes and the dark
  lines of the nodes show; the other shows density as emitted light. When the
  plane is itself a node (the xz plane of 2p y, any coordinate plane of
  4f xyz) the page says so. Hover for the coordinates, the sign of ψ and the
  density there compared with the orbital's highest.
- **How far from the nucleus**: the radial distribution r²R², with the
  spherical nodes, the most likely distance and the mean distance marked, and
  the cloud's dots counted by distance on top of it.
- **Numbers**: the energy, the most likely and mean distances, the radius
  holding nine tenths of the electron, and where the spherical nodes are, in
  Bohr radii and ångströms.

## The model

- Atomic units: lengths in Bohr radii a₀ = 0.529177 Å, energies from the
  Rydberg energy 13.6057 eV (CODATA 2022), with the nucleus held fixed, so
  the energies are −13.6057 eV / n².
- ψ = R_nl(r) Y_lm(θ, φ). The radial part uses generalised Laguerre
  polynomials by their three-term recurrence,
  R_nl = N e^(−ρ/2) ρ^l L_(n−l−1)^(2l+1)(ρ) with ρ = 2r/n.
- The angular part is the real spherical harmonics, cos(mφ) for m > 0 and
  sin(|m|φ) for m < 0, built on associated Legendre functions without the
  Condon–Shortley phase so that p x is positive along +x.
- Sampling is exact: the radius comes from inverting the cumulative radial
  distribution (tabulated on 4096 points), the direction from Y² by rejection
  on the sphere. The two factors are independent, so together they give the
  full three-dimensional density.

## Tests

`npm test` checks, among other things:

- R_nl against the textbook closed forms for 1s, 2s, 2p and 3d;
- that every R_nl up to n = 6 is normalised, that those with the same l are
  orthogonal, and that the mean radius matches (3n² − l(l+1)) / 2;
- that the real spherical harmonics up to l = 5 are orthonormal, by
  Gauss–Legendre quadrature, and that p x, d xy, d x²−y² and d z² point the
  way their names say;
- the n − l − 1 spherical nodes (the 3s nodes at (9 ± 3√3)/2 a₀) and the most
  likely radii n² of the orbitals with l = n − 1;
- that sampled radii have the right mean and mean square, sampled directions
  the right ⟨cos²θ⟩, and every dot the sign of ψ where it landed;
- that nodal planes come out as zero in the slice and dark in the cloud.

## Layout

```
index.html, style.css   the page
src/hydrogen.js         radial functions, spherical harmonics, nodes, radii
src/sampler.js          exact sampling from |psi|^2, peak density
src/names.js            orbital names
src/slice.js            psi on a plane and its shading
src/cloud.js            view rotation and the point cloud
src/chart.js            radial distribution chart
src/main.js             controls and drawing
test/                   Node test suite
```

## Licence

MIT, see [LICENSE](LICENSE).
