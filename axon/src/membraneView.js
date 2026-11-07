// The Membrane tab: controls, the three linked charts, the playhead and the
// picture of the channels.

import { clearTokenCache, dataRange, drawChart, token, xFromPointer } from './chart.js';
import { drawMembrane } from './channelsView.js';
import { DEFAULTS, PRESETS, presetSettings, pulsesFrom, sliderFromWidth, widthFromSlider } from './presets.js';
import { decodeMembrane, encodeMembrane, hasMembraneFields } from './share.js';
import { membrane, restBehaviour, simulate, summarize } from './simulate.js';

const $ = (id) => document.getElementById(id);
const SAMPLES = 1500;
const PLAY_MS_PER_SECOND = 10;

const SLIDERS = [
  { id: 'amp', name: 'amplitude', format: (v) => `${v} µA/cm²` },
  { id: 'width', name: 'width', format: (v) => `${v} ms`, toSlider: sliderFromWidth, fromSlider: widthFromSlider },
  { id: 'amp2', name: 'secondAmplitude', format: (v) => `${v} µA/cm²` },
  { id: 'gap', name: 'gap', format: (v) => `${v} ms` },
  { id: 'length', name: 'length', format: (v) => `${v} ms` },
  { id: 'celsius', name: 'celsius', format: (v) => `${v} °C` },
  { id: 'na', name: 'na', format: (v) => `${v}%` },
  { id: 'k', name: 'k', format: (v) => `${v}%` },
];

const LOWER = {
  gates: {
    label: 'gate open share',
    range: () => [0, 1],
    series: (t) => [
      { y: t.m, color: token('sodium') },
      { y: t.h, color: token('plug') },
      { y: t.n, color: token('potassium') },
    ],
  },
  conductance: {
    label: 'mS/cm²',
    range: (t) => dataRange([t.gNa, t.gK], { minSpan: 1 }),
    series: (t) => [
      { y: t.gNa, color: token('sodium') },
      { y: t.gK, color: token('potassium') },
    ],
  },
  current: {
    label: 'µA/cm²',
    range: (t) => dataRange([t.iNa, t.iK], { minSpan: 5 }),
    series: (t) => [
      { y: t.iNa, color: token('sodium') },
      { y: t.iK, color: token('potassium') },
      { y: t.iL, color: token('muted') },
    ],
  },
};

const LEGENDS = {
  gates: [['sodium', 'm: sodium gates open'], ['plug', 'h: sodium not plugged'], ['potassium', 'n: potassium gates open']],
  conductance: [['sodium', 'sodium conductance'], ['potassium', 'potassium conductance']],
  current: [['sodium', 'sodium current (in is negative)'], ['potassium', 'potassium current'], ['muted', 'leak']],
};

export function describe(summary, rest) {
  if (summary.spikes === 0) {
    const peak = Math.round(summary.peak);
    return `No spike. The voltage reaches ${peak} mV at most.`;
  }
  const quiet = rest.settled ? '' : ' The membrane is firing by itself.';
  if (summary.spikes === 1) return `One spike, peaking at ${formatVolts(summary.peak)}.${quiet}`;
  const rate = summary.rate ? `, ending at ${Math.round(summary.rate)} a second` : '';
  return `${summary.spikes} spikes${rate}.${quiet}`;
}

function formatVolts(v) {
  return `${v > 0 ? '+' : ''}${v.toFixed(0)} mV`;
}

export function mountMembrane() {
  let settings = { ...DEFAULTS };
  let trace = null;
  let pinned = null;
  let playhead = 0;
  let playing = false;
  let lastFrame = 0;
  let lower = 'gates';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function compute() {
    const params = membrane({ naOpen: settings.na / 100, kOpen: settings.k / 100 });
    trace = simulate(params, pulsesFrom(settings), {
      duration: settings.length,
      samples: SAMPLES,
      celsius: settings.celsius,
    });
    if (playhead > settings.length) playhead = settings.length;
    const summary = summarize(trace);
    const rest = restBehaviour(params, settings.celsius);
    $('r-rest').textContent = rest.settled ? `${rest.v.toFixed(1)} mV` : 'none';
    $('r-peak').textContent = formatVolts(summary.peak);
    $('r-spikes').textContent = String(summary.spikes);
    $('r-width').textContent = summary.width === null ? '–' : `${summary.width.toFixed(2)} ms`;
    $('r-rate').textContent = summary.rate === null ? '–' : `${summary.rate.toFixed(0)} /s`;
    $('verdict').textContent = describe(summary, rest);
  }

  function sampleIndex() {
    const i = Math.round((playhead / trace.duration) * SAMPLES);
    return Math.min(SAMPLES, Math.max(0, i));
  }

  function draw() {
    const t = trace.t;
    const voltageSeries = [];
    if (pinned) {
      voltageSeries.push({ x: pinned.t, y: pinned.v, color: token('muted'), width: 1.4, dash: [5, 4] });
    }
    voltageSeries.push({ x: t, y: trace.v, color: token('ink'), width: 2 });
    const i = sampleIndex();
    drawChart($('v-chart'), {
      x: [0, trace.duration],
      y: [-100, 60],
      yTickCount: 4,
      yLabel: 'mV',
      compact: true,
      level: 0,
      series: voltageSeries,
      playhead,
      markers: [{ x: playhead, y: trace.v[i], color: token('accent'), radius: 4 }],
    });
    const stimRange = dataRange([trace.stim], { minSpan: 10, pad: 0.12 });
    drawChart($('stim-chart'), {
      x: [0, trace.duration],
      y: stimRange,
      yTickCount: 2,
      yLabel: 'µA',
      compact: true,
      series: [{ x: t, y: trace.stim, color: token('accent'), width: 1.6 }],
      playhead,
    });
    const view = LOWER[lower];
    drawChart($('lower-chart'), {
      x: [0, trace.duration],
      y: view.range(trace),
      yTickCount: 4,
      yLabel: view.label,
      xLabel: 'ms',
      series: view.series(trace).map((s) => ({ ...s, x: t })),
      playhead,
    });
    const phase = reduceMotion.matches ? 0.5 : playhead * 2.2;
    const state = { v: trace.v[i], m: trace.m[i], h: trace.h[i], n: trace.n[i] };
    drawMembrane($('channel-canvas'), state, phase);
    const naOpen = state.m ** 3 * state.h;
    const kOpen = state.n ** 4;
    $('now-time').textContent = `${playhead.toFixed(1)} ms`;
    $('now-volts').textContent = `${state.v.toFixed(1)} mV`;
    $('now-na').textContent = `${(naOpen * 100).toFixed(1)}% open`;
    $('now-k').textContent = `${(kOpen * 100).toFixed(1)}% open`;
    $('scrub').value = String(playhead);
  }

  function setPlaying(on) {
    playing = on;
    $('play').textContent = on ? 'Pause' : 'Play';
    if (on) {
      lastFrame = 0;
      requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    if (!playing) return;
    if (lastFrame) {
      playhead += ((now - lastFrame) / 1000) * PLAY_MS_PER_SECOND;
      if (playhead >= trace.duration) {
        playhead = trace.duration;
        setPlaying(false);
      }
      draw();
    }
    lastFrame = now;
    if (playing) requestAnimationFrame(frame);
  }

  function syncControls() {
    for (const { id, name, format, toSlider } of SLIDERS) {
      $(id).value = String(toSlider ? toSlider(settings[name]) : settings[name]);
      $(`${id}-out`).textContent = format(settings[name]);
    }
    $('second').checked = settings.second;
    $('second-fields').hidden = !settings.second;
    $('scrub').max = String(settings.length);
  }

  function refresh() {
    syncControls();
    compute();
    draw();
  }

  function loadPreset(id, { play = true } = {}) {
    settings = presetSettings(id);
    const preset = PRESETS.find((p) => p.id === id);
    $('preset').value = id;
    $('preset-note').textContent = preset.note;
    $('preset-note').hidden = false;
    playhead = 0;
    refresh();
    if (play && !reduceMotion.matches) setPlaying(true);
    else setPlaying(false);
  }

  function changed() {
    $('preset').value = 'custom';
    $('preset-note').hidden = true;
    refresh();
  }

  for (const preset of PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    $('preset').append(option);
  }
  $('preset').addEventListener('change', (event) => {
    if (event.target.value !== 'custom') loadPreset(event.target.value);
  });
  for (const { id, name, fromSlider } of SLIDERS) {
    $(id).addEventListener('input', (event) => {
      const value = Number(event.target.value);
      settings[name] = fromSlider ? fromSlider(value) : value;
      changed();
    });
  }
  $('second').addEventListener('change', (event) => {
    settings.second = event.target.checked;
    changed();
  });
  $('lower-view').addEventListener('change', (event) => {
    lower = event.target.value;
    renderLegend();
    draw();
  });
  $('play').addEventListener('click', () => {
    if (!playing && playhead >= trace.duration) playhead = 0;
    setPlaying(!playing);
  });
  $('scrub').addEventListener('input', (event) => {
    setPlaying(false);
    playhead = Number(event.target.value);
    draw();
  });
  for (const id of ['v-chart', 'stim-chart', 'lower-chart']) {
    const canvas = $(id);
    const move = (event) => {
      setPlaying(false);
      playhead = xFromPointer(canvas, event.clientX, [0, trace.duration]);
      draw();
    };
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      move(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (canvas.hasPointerCapture(event.pointerId)) move(event);
    });
  }
  $('pin').addEventListener('click', () => {
    pinned = pinned ? null : { t: trace.t, v: trace.v };
    $('pin').textContent = pinned ? 'Forget kept trace' : 'Keep this trace';
    draw();
  });
  $('copy-link').addEventListener('click', async () => {
    const query = encodeMembrane(settings).toString();
    const url = `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      $('copy-link').textContent = 'Copied';
    } catch {
      $('copy-link').textContent = 'Link is in the address bar';
    }
    setTimeout(() => {
      $('copy-link').textContent = 'Copy link';
    }, 1800);
  });

  function renderLegend() {
    $('lower-legend').replaceChildren(...LEGENDS[lower].map(([colour, text]) => {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = `var(--${colour})`;
      item.append(swatch, text);
      return item;
    }));
  }

  window.addEventListener('resize', () => draw());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    clearTokenCache();
    draw();
  });

  renderLegend();
  const params = new URLSearchParams(location.search);
  if (hasMembraneFields(params)) {
    settings = decodeMembrane(params);
    $('preset').value = 'custom';
    $('preset-note').hidden = true;
    refresh();
  } else {
    loadPreset('push', { play: !reduceMotion.matches });
  }

  return { redraw: draw };
}
