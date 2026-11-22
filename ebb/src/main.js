import { moon, sun, EARTH_RADIUS, MOON_MEAN_DISTANCE, MOON_PERIGEE, MOON_APOGEE } from './tides.js';
import { renderField } from './field.js';
import { rows, distanceLabel, liveText } from './readout.js';

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;

const state = {
  mode: 'tidal',
  moonAngle: 0,
  moonDistance: MOON_MEAN_DISTANCE,
  sunOn: false,
  sunAngle: 0,
  ocean: true,
};

const PRESETS = { perigee: MOON_PERIGEE, mean: MOON_MEAN_DISTANCE, apogee: MOON_APOGEE };

function bodies() {
  return {
    moonBody: moon(state.moonAngle * DEG, state.moonDistance),
    sunBody: state.sunOn ? sun(state.sunAngle * DEG) : null,
  };
}

function render() {
  const b = bodies();
  const pic = renderField({ ...b, mode: state.mode, showOcean: state.ocean });
  $('field').innerHTML = pic.svg;
  const dl = $('readout');
  dl.replaceChildren();
  for (const [k, v] of rows({ ...b, longest: pic.longest, exaggeration: pic.exaggeration, mode: state.mode })) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  $('moon-angle').value = String(Math.round(state.moonAngle) % 360);
  $('moon-angle-value').textContent = `${Math.round(state.moonAngle) % 360}°`;
  $('moon-distance').value = (state.moonDistance / EARTH_RADIUS).toFixed(1);
  $('moon-distance-value').textContent = distanceLabel(state.moonDistance);
  $('sun-angle').disabled = !state.sunOn;
  $('sun-angle').value = String(state.sunAngle);
  $('sun-angle-value').textContent = state.sunOn ? `${state.sunAngle}°` : '';
  $('pull-label').textContent = state.sunOn ? "The Moon's and the Sun's pull" : "The Moon's pull";
  $('live').textContent = liveText(b);
}

for (const r of document.querySelectorAll('input[name="mode"]')) {
  r.addEventListener('change', () => { state.mode = r.value; render(); });
}
$('moon-angle').addEventListener('input', (e) => { state.moonAngle = Number(e.target.value); render(); });
$('moon-distance').addEventListener('input', (e) => {
  state.moonDistance = Number(e.target.value) * EARTH_RADIUS;
  render();
});
for (const btn of document.querySelectorAll('[data-distance]')) {
  btn.addEventListener('click', () => { state.moonDistance = PRESETS[btn.dataset.distance]; render(); });
}
$('sun-on').addEventListener('change', (e) => { state.sunOn = e.target.checked; render(); });
$('sun-angle').addEventListener('input', (e) => { state.sunAngle = Number(e.target.value); render(); });
$('ocean-on').addEventListener('change', (e) => { state.ocean = e.target.checked; render(); });

// Drag the Moon round the Earth. Only the pointer that grabbed it moves it.
let dragging = null;
function angleFromEvent(e) {
  const svg = $('field').querySelector('svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const a = Math.atan2(-p.y, p.x) / DEG;
  return (Math.round(a) + 360) % 360;
}
$('field').addEventListener('pointerdown', (e) => {
  if (!(e.target instanceof Element) || e.target.id !== 'moon-handle') return;
  if (dragging !== null) return;
  dragging = e.pointerId;
  $('field').setPointerCapture(e.pointerId);
  e.preventDefault();
});
$('field').addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragging) return;
  state.moonAngle = angleFromEvent(e);
  render();
});
const stop = (e) => { if (e.pointerId === dragging) dragging = null; };
$('field').addEventListener('pointerup', stop);
$('field').addEventListener('pointercancel', stop);
$('field').addEventListener('lostpointercapture', stop);

render();
