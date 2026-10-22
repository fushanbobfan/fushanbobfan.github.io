// Run the tunnel without the page and print what the wake does.
// Usage: node scripts/probe.js [--preset id] [--re N] [--shape s] [--width w]
//                              [--size D] [--angle a] [--naca code] [--time T]
// --time is the run length in flow times D/U (default 120); the report
// covers the last 40 of them.

import { clampSettings, presetSettings } from '../src/settings.js';
import { createSim, step, wakeReport, flowTime } from '../src/sim.js';

const args = process.argv.slice(2);
const opt = {};
for (let k = 0; k < args.length; k += 2) opt[args[k].replace(/^--/, '')] = args[k + 1];

const base = opt.preset ? presetSettings(opt.preset) : clampSettings({});
const settings = clampSettings({ ...base, ...opt });
const time = Number(opt.time || 120);
const sim = createSim(settings);
const total = Math.round((time * settings.size) / settings.speed);

const t0 = Date.now();
for (let done = 0; done < total; done += 500) step(sim, Math.min(500, total - done));
const secs = (Date.now() - t0) / 1000;
const r = wakeReport(sim);

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-');
console.log(`shape ${settings.shape}${settings.shape === 'airfoil' ? ` ${settings.naca}` : ''}, angle ${settings.angle}, size ${settings.size}`);
console.log(`grid ${sim.nx} x ${sim.ny}, blockage D/H ${fmt(settings.size / sim.ny)}`);
console.log(`Re ${fmt(sim.relax.re, 1)}${sim.relax.clamped ? ' (capped)' : ''}, tau ${fmt(sim.relax.tau, 4)}, U ${settings.speed}`);
console.log(`ran ${fmt(flowTime(sim), 1)} D/U (${sim.steps} steps) in ${secs.toFixed(1)} s, restarts ${sim.restarts}`);
if (!r) {
  console.log('no force samples');
} else {
  console.log(`wake ${r.shedding ? `shedding, ${r.cycles} cycles` : 'steady'}`);
  console.log(`mean Cd ${fmt(r.cd)}, mean Cl ${fmt(r.clMean)}, Cl amplitude ${fmt(r.clAmplitude)}`);
  console.log(`period ${fmt(r.period, 0)} steps, Strouhal ${fmt(r.strouhal)}`);
}
