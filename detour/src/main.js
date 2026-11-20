// Wires the page: scene picker, road toggles, demand slider, the animated map and the chart.

import { SCENES, sceneById, optionalRoads } from './scenes.js';
import { openRoads, roadFlows, routeName } from './network.js';
import { outcomes, sweep } from './equilibrium.js';
import { renderNetwork, routeTable, roadCurve, pointOn, minutes, drivers, ROUTE_COLORS } from './draw.js';
import { createTraffic, advance, carsPerMinute } from './traffic.js';
import { renderChart, rangesAbove } from './chart.js';
import { headline, toggleEffect, effectText, trendText } from './story.js';

const $ = (id) => document.getElementById(id);
const map = $('map');
const sceneSelect = $('scene');
const demandInput = $('demand');
const playButton = $('play');
const speedInput = $('speed');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  scene: SCENES[0],
  open: new Set(),
  demand: SCENES[0].demand,
  playing: !reduceMotion,
  traffic: createTraffic(),
  plan: null,
  curves: new Map(),
};

for (const s of SCENES) sceneSelect.add(new Option(s.name, s.id));

function setScene(id) {
  state.scene = sceneById(id);
  state.open = new Set();
  state.demand = state.scene.demand;
  state.traffic = createTraffic();
  sceneSelect.value = state.scene.id;
  demandInput.max = state.scene.maxDemand;
  demandInput.step = state.scene.step;
  demandInput.value = state.demand;
  $('scene-blurb').textContent = state.scene.blurb;
  state.curves = new Map(state.scene.roads.map((r) => [r.id, roadCurve(state.scene, r)]));
  update();
  renderTrend();
}

function toggle(id) {
  if (state.open.has(id)) state.open.delete(id);
  else state.open.add(id);
  update();
}

function update() {
  const { scene, open, demand } = state;
  const roads = openRoads(scene, open);
  const o = outcomes(scene, roads, demand);
  const flows = roadFlows(roads, o.routes, o.equilibrium.flows);
  state.plan = {
    routes: o.routes,
    flows: o.equilibrium.flows,
    roads: new Map(roads.map((r) => [r.id, r])),
    roadFlows: flows,
    carsPerMinute: carsPerMinute(demand),
  };

  const focused = document.activeElement?.closest?.('[data-road]')?.dataset.road;
  map.innerHTML = renderNetwork({ scene, open, flows });
  if (focused) map.querySelector(`[data-road="${focused}"]`)?.focus();

  $('demand-out').textContent = drivers(demand);
  $('headline').textContent = headline(scene, open, demand);

  const opts = optionalRoads(scene);
  $('links').hidden = opts.length === 0;
  $('link-list').innerHTML = opts
    .map((r) => {
      const on = open.has(r.id);
      const effect = demand > 0 ? effectText(toggleEffect(scene, open, demand, r.id)) : '';
      return `<div class="link-item"><button type="button" data-toggle="${r.id}" aria-pressed="${on}">${on ? 'Close' : 'Open'} ${r.name}</button><p class="effect">${effect}</p></div>`;
    })
    .join('');

  $('eq-time').textContent = demand > 0 ? minutes(o.equilibrium.perDriver) : '–';
  $('eq-sub').textContent = demand > 0 ? `per driver; ${drivers(o.equilibrium.total / 60)} hours on the road in all` : '';
  $('opt-time').textContent = demand > 0 ? minutes(o.optimum.perDriver) : '–';
  $('opt-sub').textContent = demand > 0 ? `per driver on average; ${drivers(o.optimum.total / 60)} hours in all` : '';
  const ratio = o.optimum.total > 0 ? o.equilibrium.total / o.optimum.total : 1;
  $('poa').textContent = ratio.toFixed(3);
  $('route-table').innerHTML = routeTable(o.routes.map((r) => routeName(scene, r)), o.equilibrium, o.optimum);
  renderTrendMarker(o.equilibrium.perDriver);
}

let trend = null;

function renderTrend() {
  const { scene } = state;
  const opts = optionalRoads(scene);
  const samples = Math.round(scene.maxDemand / scene.step);
  const toPoints = (s, key) => s.map((p) => ({ demand: p.demand, value: p[key] }));
  const closedSweep = sweep(scene, openRoads(scene, new Set()), 0, scene.maxDemand, samples);
  const series = [];
  let worse = [];
  if (opts.length) {
    const openSweep = sweep(scene, openRoads(scene, new Set(opts.map((r) => r.id))), 0, scene.maxDemand, samples);
    series.push({ id: 'closed', label: 'Every optional road closed', points: toPoints(closedSweep, 'equilibrium') });
    series.push({ id: 'open', label: 'Every optional road open', points: toPoints(openSweep, 'equilibrium') });
    series.push({ id: 'best', label: 'Best split, every road open', points: toPoints(openSweep, 'optimum'), dashed: true });
    worse = rangesAbove(series[1].points, series[0].points);
  } else {
    series.push({ id: 'open', label: 'Everyone picks the fastest route', points: toPoints(closedSweep, 'equilibrium') });
    series.push({ id: 'best', label: 'Best split', points: toPoints(closedSweep, 'optimum'), dashed: true });
  }
  trend = { series, worse };
  $('trend-summary').textContent = trendText(scene, worse);
  $('chart-legend').innerHTML = series
    .map((s) => `<span class="key key-s-${s.id}"></span> ${s.label}`)
    .concat(worse.length ? ['<span class="key key-worse"></span> opening makes it slower'] : [])
    .concat(['<span class="key key-now"></span> now'])
    .join(' ');
  renderTrendMarker(outcomes(scene, openRoads(scene, state.open), state.demand).equilibrium.perDriver);
}

function renderTrendMarker(value) {
  if (!trend) return;
  $('chart').innerHTML = renderChart({
    series: trend.series,
    worse: trend.worse,
    marker: { demand: state.demand, value },
    maxDemand: state.scene.maxDemand,
  });
}

// Animation: one simulated minute per 60 ms at speed 5.
let last = null;
function frame(now) {
  if (last !== null && state.playing && state.plan) {
    const dt = Math.min(0.1, (now - last) / 1000);
    const minutesPerSecond = 4 * Number(speedInput.value) ** 1.2;
    advance(state.traffic, state.plan, dt * minutesPerSecond);
  }
  last = now;
  drawCars();
  requestAnimationFrame(frame);
}

function drawCars() {
  const layer = map.querySelector('#cars');
  if (!layer) return;
  const cars = state.traffic.cars;
  while (layer.childElementCount < cars.length) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '3.6');
    layer.appendChild(c);
  }
  while (layer.childElementCount > cars.length) layer.lastChild.remove();
  cars.forEach((car, i) => {
    const curve = state.curves.get(car.route[car.leg]);
    const p = pointOn(curve, car.t);
    const jitter = ((car.id * 7919) % 9) - 4;
    const el = layer.children[i];
    el.setAttribute('cx', (p.x + jitter * 0.6).toFixed(1));
    el.setAttribute('cy', (p.y + jitter * 0.6).toFixed(1));
    el.setAttribute('fill', ROUTE_COLORS[car.routeIndex % ROUTE_COLORS.length]);
  });
}

sceneSelect.addEventListener('change', () => setScene(sceneSelect.value));
demandInput.addEventListener('input', () => {
  state.demand = Number(demandInput.value);
  update();
});
playButton.addEventListener('click', () => {
  state.playing = !state.playing;
  playButton.textContent = state.playing ? 'Pause' : 'Play';
});
$('link-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-toggle]');
  if (!b) return;
  toggle(b.dataset.toggle);
  $('link-list').querySelector(`[data-toggle="${b.dataset.toggle}"]`)?.focus();
});
map.addEventListener('click', (e) => {
  const g = e.target.closest('[data-road][role="button"]');
  if (g) toggle(g.dataset.road);
});
map.addEventListener('keydown', (e) => {
  const g = e.target.closest('[data-road][role="button"]');
  if (g && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    toggle(g.dataset.road);
  }
});

playButton.textContent = state.playing ? 'Pause' : 'Play';
setScene(SCENES[0].id);
requestAnimationFrame(frame);
