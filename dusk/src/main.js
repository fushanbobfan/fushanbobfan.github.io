import { toDisplay, hue, hex, luminance } from './spectrum.js';
import { sunLabel, hazeLabel, heightLabel, percent, times, band, brightness, describe } from './readout.js';
import { DEG } from './sky.js';
import { chartSVG, describeSpectrum } from './chart.js';

const $ = (id) => document.getElementById(id);
const inputs = { sun: $('sun'), haze: $('haze'), height: $('height') };
const fixed = $('fixed');
const ozone = $('ozone');
const viewCanvas = $('view');
const domeCanvas = $('dome');

function params() {
  return { sun: Number(inputs.sun.value), haze: Number(inputs.haze.value), height: Number(inputs.height.value), fixed: fixed.checked, ozone: ozone.checked ? 1 : 0 };
}

function showLabels() {
  const p = params();
  $('sun-value').value = sunLabel(p.sun);
  $('haze-value').value = hazeLabel(p.haze);
  $('height-value').value = heightLabel(p.height);
}

// Linear RGB pixels to an offscreen image, then scaled up smoothly onto the canvas.
function paint(canvas, rgb, w, h, exposure, mask) {
  const img = new ImageData(w, h);
  for (let o = 0; o < w * h; o++) {
    if (mask && !mask[o]) continue;
    const [r, g, b] = toDisplay([rgb[3 * o], rgb[3 * o + 1], rgb[3 * o + 2]], exposure);
    img.data.set([r, g, b, 255], 4 * o);
  }
  const off = new OffscreenCanvas(w, h);
  off.getContext('2d').putImageData(img, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { ctx, off };
}

// The sun's position, marked by a disc in its colour. A sun the haze has all but put out (less
// than a millionth of its light left) is marked by a ring.
function drawSun(ctx, x, y, rgb, radius) {
  const colour = hex(hue(rgb));
  if (luminance(rgb) < 1e-6) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    return;
  }
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glow.addColorStop(0, colour + 'aa');
  glow.addColorStop(1, colour + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

function drawView(r) {
  const { view, exposure } = r;
  const { ctx, off } = paint(viewCanvas, view.rgb, view.width, view.height, exposure);
  const W = viewCanvas.width, H = viewCanvas.height;
  ctx.drawImage(off, 0, 0, W, H);
  const el = r.params.sun * DEG;
  if (el > -0.3 * DEG && el < view.rise && Number.isFinite(r.airMass)) {
    drawSun(ctx, W / 2, H * (1 - el / view.rise), r.sun, 7);
  }
  const marks = [-60, -30, 0, 30, 60];
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  for (const a of marks) {
    const x = W * (0.5 + (a * DEG) / view.span);
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x, H - 8);
    ctx.stroke();
  }
}

function drawDome(r) {
  const { dome, exposure } = r;
  const { ctx, off } = paint(domeCanvas, dome.rgb, dome.size, dome.size, exposure, dome.sky);
  const S = domeCanvas.width;
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, 2 * Math.PI);
  ctx.clip();
  ctx.drawImage(off, 0, 0, S, S);
  ctx.restore();
  const el = r.params.sun;
  if (el > -0.3 && Number.isFinite(r.airMass)) {
    const rr = (S / 2) * (1 - el / 90);
    drawSun(ctx, S / 2, S / 2 + rr, r.sun, 6);
  }
  ctx.strokeStyle = 'rgba(128, 128, 128, 0.6)';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, 2 * Math.PI);
  ctx.stroke();
}

function chip(id, rgb) {
  const code = Math.max(...rgb) > 0 ? hex(hue(rgb)) : null;
  $(id).style.background = code || 'transparent';
  $(`${id}-code`).textContent = code || 'no light';
}

function showReadouts(r) {
  chip('swatch-sun', Number.isFinite(r.airMass) ? r.sun : [0, 0, 0]);
  chip('swatch-zenith', r.zenith);
  chip('swatch-opposite', r.opposite);
  $('air-mass').textContent = times(r.airMass);
  $('through-blue').textContent = percent(band(r.transmission, 440));
  $('through-green').textContent = percent(band(r.transmission, 540));
  $('through-red').textContent = percent(band(r.transmission, 660));
  $('sky-brightness').textContent = brightness(r.skyRatio);
  const spectrum = { transmission: r.transmission, sky: r.zenithSpectrum };
  $('spectrum').innerHTML = chartSVG(spectrum);
  $('spectrum-words').textContent = describeSpectrum(spectrum);
  $('verdict').textContent = describe({ ...r.params, airMass: r.airMass, transmission: r.transmission, skyRatio: r.skyRatio, sunRGB: r.sun });
}

const worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
let latest = 0;
let busy = false;
let queued = null;

let revision = 0;
function request(quality) {
  const id = ++latest;
  const msg = { id, revision, params: params(), quality };
  if (busy) {
    queued = msg;
    return;
  }
  busy = true;
  worker.postMessage(msg);
}

let fineTimer = 0;
let drawn = 0;
worker.onmessage = (e) => {
  busy = false;
  if (queued) {
    const next = queued;
    queued = null;
    busy = true;
    worker.postMessage(next);
  }
  const r = e.data;
  // Only a picture of the controls as they stand now is drawn.
  if (r.revision !== revision || r.id < drawn) return;
  drawn = r.id;
  drawView(r);
  drawDome(r);
  showReadouts(r);
};

function update() {
  revision++;
  showLabels();
  request('rough');
  clearTimeout(fineTimer);
  fineTimer = setTimeout(() => request('fine'), 180);
}

for (const el of Object.values(inputs)) el.addEventListener('input', update);
fixed.addEventListener('change', update);
ozone.addEventListener('change', update);
for (const b of document.querySelectorAll('button[data-sun]')) {
  b.addEventListener('click', () => {
    for (const k of Object.keys(inputs)) inputs[k].value = b.dataset[k];
    fixed.checked = b.dataset.fixed === '1';
    ozone.checked = true;
    update();
  });
}

update();
