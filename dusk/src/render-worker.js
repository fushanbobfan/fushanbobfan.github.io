// Traces the pictures off the page's thread.

import { makeScene, renderDome, renderView, exposureFor, meanLuminance, sunlight, sunRGB, skyRGB, DEG } from './sky.js';

// A clear midday at sea level: the yardstick for brightness and for the fixed camera.
export const MIDDAY = { sun: 60, haze: 0.06, height: 0, ozone: 1 };
let midday = null;
export function middaySky() {
  if (!midday) {
    const dome = renderDome(makeScene(MIDDAY), 96, 16, 8);
    midday = { exposure: exposureFor(dome.rgb, dome.sky), mean: meanLuminance(dome.rgb, dome.sky) };
  }
  return midday;
}

export function renderAll(params, quality) {
  const scene = makeScene(params);
  const fine = quality === 'fine';
  const dome = renderDome(scene, fine ? 160 : 64, fine ? 20 : 12, fine ? 8 : 6);
  const view = renderView(scene, fine ? 240 : 96, fine ? 80 : 32, undefined, undefined, fine ? 24 : 12, fine ? 10 : 6);
  const ref = middaySky();
  const exposure = params.fixed ? ref.exposure : exposureFor(dome.rgb, dome.sky);
  const light = sunlight(scene);
  return {
    params,
    quality,
    dome,
    view,
    exposure,
    sun: sunRGB(scene),
    zenith: skyRGB(scene, 90 * DEG, 0),
    opposite: skyRGB(scene, 5 * DEG, 180 * DEG),
    airMass: light.airMass,
    transmission: light.transmission,
    skyRatio: meanLuminance(dome.rgb, dome.sky) / ref.mean,
  };
}

if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => {
    const { id, params, quality } = e.data;
    const r = renderAll(params, quality);
    self.postMessage({ id, ...r }, [r.dome.rgb.buffer, r.dome.sky.buffer, r.view.rgb.buffer]);
  };
}
