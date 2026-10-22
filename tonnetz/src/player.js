// Timeline for playing a traced progression. Each chord lasts `beats` beats;
// the intermediate triangles of its P/L/R word are visited during the first
// beat so the highlight slides across the lattice before the chord sounds.

import { voiceLead, closeVoicing } from './plr.js';
import { triangleTriad } from './lattice.js';

export function timeline(trace, { tempo = 72, beats = 2 } = {}) {
  const beat = 60 / tempo;
  const events = [];
  let t = 0;
  let voicing = null;
  for (let i = 0; i < trace.steps.length; i++) {
    const st = trace.steps[i];
    const hops = st.to - st.from;
    for (let k = 1; k < hops; k++) {
      // Passing triangles: shown, not sounded.
      events.push({ time: t + (beat * k) / hops, step: i, pathIndex: st.from + k, sound: false });
    }
    const at = t + (hops > 1 ? beat : 0);
    voicing = voicing ? voiceLead(voicing, st.chord) : closeVoicing(st.chord, 62);
    events.push({ time: at, step: i, pathIndex: st.to, sound: true, notes: voicing, duration: t + beat * beats - at });
    t += beat * beats;
  }
  return { events, duration: t };
}

// The last event at or before time `t`, or null before the first.
export function eventAt(tl, t) {
  let found = null;
  for (const e of tl.events) {
    if (e.time <= t + 1e-9) found = e;
    else break;
  }
  return found;
}

// A voicing walk along every triangle of a path, one triad per triangle,
// used when stepping through a word one move at a time.
export function pathVoicings(path, start = 62) {
  const out = [];
  let v = null;
  for (const tri of path) {
    const t = triangleTriad(tri);
    v = v ? voiceLead(v, t) : closeVoicing(t, start);
    out.push(v);
  }
  return out;
}
