# Third-party material

## CIE 1931 colour matching functions

`src/cie1931.js` holds the rows from 370 to 790 nm at every 10 nm of
CIE 2019, "Colour-matching functions of CIE 1931 standard colorimetric
observer", International Commission on Illumination (CIE), Vienna, AT,
DOI: [10.25039/CIE.DS.xvudnb9b](https://doi.org/10.25039/CIE.DS.xvudnb9b)
(file `CIE_xyz_1931_2deg.csv`). The dataset and this file are licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The values are
copied unchanged; `src/spectrum.js` interpolates them and averages them over
each 20 nm band.

## Ozone absorption cross-sections

The table `OZONE_BINS` in `src/air.js` is copied from `atmosphere/demo/demo.cc` of
[precomputed_atmospheric_scattering](https://github.com/ebruneton/precomputed_atmospheric_scattering).
Its values are the IUP Bremen ozone absorption cross-sections at 233 K
(Serdyuchenko et al. 2014), averaged over 10 nm bins.

```
Copyright (c) 2017 Eric Bruneton
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holders nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
THE POSSIBILITY OF SUCH DAMAGE.
```
