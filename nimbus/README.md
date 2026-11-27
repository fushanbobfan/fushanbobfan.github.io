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
  4f xyz, ...), with a sentence counting the orbital's n − 1 nodes: n − l − 1
  spheres, and l planes or cones through the nucleus (|m| planes containing
  the z axis, plus the xy plane when l − |m| is odd, and cones for the rest).
- **A point cloud** of up to 150 000 places the electron could be found, each
  drawn from |ψ|² and coloured by the sign of ψ. Drag it or use the arrow
  keys to turn it; it turns slowly on its own unless your system asks for
  reduced motion.
- **A slice** through the nucleus on the xz, xy or yz plane. The default
  shading spans four decades of density, so faint outer lobes and the dark
  lines of the nodes show; the other shows density as emitted light. When the
  plane is itself a node (the xz plane of 2p y, any coordinate plane of
  4f xyz) the page says so. Point at the slice, or tab to it and move a
  probe with the arrow keys (Shift for bigger steps, Home to recentre), for
  the coordinates, the sign of ψ and the density there compared with the
  orbital's highest.
- **How far from the nucleus**: the radial distribution r²R², with the
  spherical nodes, the most likely distance and the mean distance marked, and
  the cloud's dots counted by distance on top of it.
- **Numbers**: the energy, the most likely and mean distances, the radius
  holding nine tenths of the electron, and where the spherical nodes are, in
  Bohr radii and ångströms.
- **Two orbitals at once**: mix in a second orbital and the electron sits
  half in each. Its cloud then swings back and forth at the frequency of the
  light the atom gives out when it drops from one orbital to the other:
  2p z with 1s rocks along z every 0.41 femtoseconds and gives Lyman alpha at
  121.57 nm. Play or scrub the beat (slowed down between 10¹⁴ and 10¹⁶ times,
  depending on the pair); a ring on the slice marks where the centre of the
  charge falls on that plane. The readouts give the wavelength
  and its series, the energy gap, the length of one beat, the size and
  direction of the swing (the dipole), and how fast the upper orbital would
  drop to the lower one by giving out that light. All of this is electric
  dipole light, the fast and bright kind. Pairs whose l does not change by
  exactly one beat without moving the centre of charge, so they give out no
  dipole light (1s with 2s breathes in and out instead, and 2s really decays
  far more slowly, by sending out two photons at once). Two orbitals of the
  same shell do not beat at all, though 2s with 2p z holds its charge off to
  one side. An orbital mixed with itself is just that orbital.
- **Hybrid orbitals**: the sp, sp² and sp³ sets of any shell from n = 2, the
  shapes chemistry uses for bonds. Pick a set and one of its members to see
  it lean along its own direction, with its share of s, the angle between
  the hybrids of the set (180°, 120°, 109.47°) and where it points. In
  hydrogen ns and np have the same energy, so each hybrid is also an exact
  state of the atom.

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
- A mix is Ψ = (ψ_a e^(−iE_a t/ħ) + ψ_b e^(−iE_b t/ħ)) / √2, whose density
  (ψ_a² + ψ_b²)/2 + ψ_a ψ_b cos ωt beats at ω = (E_b − E_a)/ħ. The cloud for
  a mix is drawn once from the time average, half its dots from each orbital,
  and each dot is weighted by the density at that moment over the average
  (between 0 and 2). The weights are that ratio exactly, so the weighted
  cloud is an unbiased sample of the beating density at every moment.
- A hybrid is a real combination of ns and the three np orbitals with the
  textbook coefficients (for example ½(s + p x + p y + p z) for the first
  sp³). Far from the nucleus R_ns and R_np always have opposite signs, so the
  s part enters with a minus sign; with the usual plus sign, the 2s hybrids
  would point backwards. Its dots are drawn from each orbital in proportion
  to its squared coefficient and weighted by the hybrid's density over that
  blend, so the weighted cloud is an unbiased sample of the hybrid.
- The dipole ⟨a|r|b⟩ is a radial integral of r³R_aR_b by Simpson's rule and
  an angular integral by Gauss–Legendre quadrature, exact for these
  polynomials. Wavelengths and beat periods use the reduced mass of the
  electron and proton, which moves every line 0.054% longer than a fixed
  nucleus would. The drop rate is the electric dipole rate
  A = (4/3) α³ ω³ |⟨a|r|b⟩|² in atomic units, with the nucleus held fixed.
- Sampling is exact, both factors by rejection. The radius is drawn under a
  step-shaped ceiling a little above r²R² on each of 4095 grid cells and kept
  with probability r²R² / ceiling; the grid stops where less than 10⁻¹⁵ of
  the electron lies beyond it. The direction is drawn uniformly on the sphere
  and kept with probability Y² / max Y². The two factors are independent, so
  together they give the full three-dimensional density.

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
- that the radial ceiling clears r²R² at 17 points in every cell of every
  orbital, that 1s radii pass a Kolmogorov–Smirnov test against the exact
  distribution, that sampled radii have the right mean and mean square,
  sampled directions the right ⟨cos²θ⟩ and azimuthal moments (p x against
  p y, d x²−y² against d xy), and every dot the sign of ψ where it landed;
- that nodal planes come out as zero in the slice and dark in the cloud;
- for mixes: the 2p–1s dipole against its closed form 128√2/243 a₀, the
  dipole selection rule, Lyman alpha, Balmer alpha and beta and Paschen alpha
  against their measured vacuum wavelengths, the 2p lifetime of 1.60 ns, the
  3d→2p rate of 6.47 × 10⁷ per second shared two thirds to 2p z from 3d z²,
  that the weighted cloud's centre swings as ⟨a|r|b⟩ cos ωt, and that the
  slice density equals |Ψ|²;
- for hybrids: that each set is orthonormal with equal s shares of ½, ⅓ and
  ¼, that the members point 180°, 120° and 109.47° apart, that each one's
  density along its direction outweighs the density behind it in shells 2
  to 4, and that the weighted cloud of an sp hybrid leans 3 a₀ along +z, as
  a direct quadrature of z|ψ|² gives.

## Layout

```
index.html, style.css   the page
src/hydrogen.js         radial functions, spherical harmonics, nodes, radii
src/sampler.js          exact sampling from |psi|^2, peak density
src/names.js            orbital names
src/slice.js            psi on a plane and its shading
src/cloud.js            view rotation and the point cloud
src/chart.js            radial distribution chart
src/superposition.js    mixes of two orbitals: dipoles, lines, rates, weights
src/hybrids.js          sp, sp2 and sp3 hybrids and their weighted sampling
src/main.js             controls and drawing
test/                   Node test suite
```

## Licence

MIT, see [LICENSE](LICENSE).
