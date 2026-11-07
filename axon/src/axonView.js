// The Axon page: two versions of one fibre, racing in slow motion.

import {
  CURVE_DIAMETERS, DIAMETER_HIGH, DIAMETER_LOW, advanceScene, crossingTime, describeSpeeds, diameterFromSlider, fireAt,
  fireEnds, isQuiet, makeScene, sceneSpeeds, sliderFromDiameter, speedCurve, stripNext,
} from './axonScene.js';
import { drawChart, token } from './chart.js';
import { drawTrack, fractionAt, makeTrack, pushRow, resetRaster } from './trackView.js';

const $ = (id) => document.getElementById(id);
const CROSSING_SECONDS = 6;
const FRAME_BUDGET_MS = 14;
const LABELS = { bare: 'Bare axon', sheathed: 'With myelin' };

function formatLength(cm) {
  return cm >= 1 ? `${cm.toFixed(1)} cm` : `${(cm * 10).toFixed(1)} mm`;
}

export function mountAxon() {
  let diameter = 10;
  let celsius = 18.5;
  let scene = makeScene(diameter, celsius);
  let pace = crossingTime(scene, null);
  let running = false;
  let lastFrame = 0;
  let rowDebt = 0;
  let speedTimer = null;
  let firstShow = true;
  const tracks = {
    bare: makeTrack($('track-bare'), 'bare'),
    sheathed: makeTrack($('track-sheathed'), 'sheathed'),
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let curve = [];
  let curveRun = 0;

  function draw() {
    for (const [name, track] of Object.entries(tracks)) {
      drawTrack(track, scene.tracks[name], scene.length, LABELS[name]);
    }
    $('axon-clock').textContent = `${scene.tracks.bare.time.toFixed(1)} ms`;
  }

  function drawCurve() {
    const line = (key, colour) => ({
      x: curve.map((p) => p.diameter),
      y: curve.map((p) => p[key]),
      color: colour,
      width: 2,
    });
    const dots = (key, colour) => curve
      .filter((p) => p[key] !== null)
      .map((p) => ({ x: p.diameter, y: p[key], color: colour, radius: 2.5 }));
    const accent = token('accent');
    const sheath = token('potassium');
    const now = curve.find((p) => p.diameter >= diameter);
    drawChart($('speed-chart'), {
      x: [DIAMETER_LOW, DIAMETER_HIGH],
      y: [0.2, 60],
      logX: true,
      logY: true,
      xTicks: [1, 10, 100],
      yTicks: [1, 10],
      xLabel: 'fibre diameter, µm',
      yLabel: 'speed, m/s',
      series: [line('bare', accent), line('sheathed', sheath)],
      markers: [...dots('bare', accent), ...dots('sheathed', sheath)],
      playhead: now ? diameter : undefined,
    });
  }

  // One point a frame, abandoned if the temperature changes meanwhile.
  function measureCurve() {
    curveRun += 1;
    const run = curveRun;
    curve = [];
    const points = speedCurve(celsius);
    const next = () => {
      if (run !== curveRun) return;
      if ($('tab-axon').hidden) {
        requestAnimationFrame(next);
        return;
      }
      const { done, value } = points.next();
      if (done) return;
      curve.push(value);
      drawCurve();
      if (curve.length < CURVE_DIAMETERS.length) requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  function frame(now) {
    if ($('tab-axon').hidden) {
      running = false;
      return;
    }
    const elapsed = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    const simulated = (elapsed * pace) / CROSSING_SECONDS;
    const rowHeight = Math.max(1, tracks.bare.raster.height);
    const rowsPerMs = rowHeight / (pace * 1.6);
    const steps = Math.round(simulated / scene.dt);
    const until = performance.now() + FRAME_BUDGET_MS;
    const chunk = Math.max(1, Math.round(steps / 8));
    for (let done = 0; done < steps && performance.now() < until; done += chunk) {
      advanceScene(scene, chunk);
      rowDebt += chunk * scene.dt * rowsPerMs;
      while (rowDebt >= 1) {
        rowDebt -= 1;
        for (const [name, track] of Object.entries(tracks)) pushRow(track, scene.tracks[name], scene.length);
      }
    }
    draw();
    if (isQuiet(scene)) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function wake() {
    if (running) return;
    running = true;
    lastFrame = 0;
    requestAnimationFrame(frame);
  }

  function refreshSpeeds() {
    clearTimeout(speedTimer);
    speedTimer = setTimeout(() => {
      const speeds = sceneSpeeds(scene);
      pace = crossingTime(scene, speeds.bare);
      $('axon-speeds').textContent = describeSpeeds(speeds, scene.stripped.length);
    }, 90);
  }

  function rebuild() {
    scene = makeScene(diameter, celsius);
    for (const track of Object.values(tracks)) resetRaster(track);
    rowDebt = 0;
    $('fibre-diameter-out').textContent = `${diameter} µm`;
    $('fibre-celsius-out').textContent = `${celsius} °C`;
    $('axon-length').textContent = `The stretch shown is ${formatLength(scene.length)} long.`;
    $('strip').disabled = false;
    pace = crossingTime(scene, null);
    refreshSpeeds();
    draw();
  }

  $('fibre-diameter').addEventListener('input', (event) => {
    diameter = diameterFromSlider(Number(event.target.value));
    rebuild();
    drawCurve();
  });
  $('fibre-celsius').addEventListener('input', (event) => {
    celsius = Number(event.target.value);
    rebuild();
    measureCurve();
  });
  $('fire-left').addEventListener('click', () => {
    fireEnds(scene, { left: true });
    wake();
  });
  $('fire-right').addEventListener('click', () => {
    fireEnds(scene, { right: true });
    wake();
  });
  $('fire-both').addEventListener('click', () => {
    fireEnds(scene, { left: true, right: true });
    wake();
  });
  $('strip').addEventListener('click', () => {
    if (!stripNext(scene)) $('strip').disabled = true;
    refreshSpeeds();
    draw();
  });
  $('restore').addEventListener('click', rebuild);
  for (const [name, track] of Object.entries(tracks)) {
    track.canvas.addEventListener('click', (event) => {
      fireAt(scene, name, fractionAt(track.canvas, event.clientX));
      wake();
    });
  }
  window.addEventListener('resize', () => {
    if ($('tab-axon').hidden) return;
    for (const track of Object.values(tracks)) {
      if (track.raster.width !== track.canvas.clientWidth) resetRaster(track);
    }
    draw();
    drawCurve();
  });

  return {
    redraw() {
      for (const track of Object.values(tracks)) {
        if (track.raster.width !== track.canvas.clientWidth) resetRaster(track);
      }
      draw();
      drawCurve();
    },
    shown() {
      if (!firstShow) {
        if (!isQuiet(scene)) wake();
        return;
      }
      firstShow = false;
      $('fibre-diameter').value = String(sliderFromDiameter(diameter));
      $('fibre-celsius').value = String(celsius);
      rebuild();
      measureCurve();
      if (!reduceMotion.matches) {
        fireEnds(scene, { left: true });
        wake();
      }
    },
  };
}
