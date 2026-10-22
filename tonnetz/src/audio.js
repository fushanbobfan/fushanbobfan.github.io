// A small Web Audio synth: each note is a pair of slightly detuned
// oscillators through a low-pass filter with a soft attack and release.
// The context starts on the first user gesture, as browsers require.

import { midiToFrequency } from './pitch.js';

export function createSynth() {
  let ctx = null;
  let master = null;
  let volume = 0.6;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function note(midi, start, duration, level) {
    const f = midiToFrequency(midi);
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(4000, f * 6);
    filter.Q.value = 0.4;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(level, start + 0.03);
    env.gain.setTargetAtTime(level * 0.55, start + 0.03, 0.4);
    const end = start + Math.max(0.1, duration);
    env.gain.setTargetAtTime(0, end, 0.12);
    filter.connect(env).connect(master);
    for (const [type, detune] of [['triangle', -4], ['sine', 5]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(start);
      osc.stop(end + 0.8);
    }
  }

  return {
    // Plays MIDI notes `delay` seconds from now for `duration` seconds.
    play(notes, duration = 1, delay = 0) {
      if (!ensure()) return;
      const start = ctx.currentTime + 0.02 + delay;
      const level = 0.22 / Math.sqrt(Math.max(1, notes.length));
      for (const n of notes) note(n, start, duration, level);
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.02);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.02);
    },
    get available() {
      return Boolean(globalThis.AudioContext ?? globalThis.webkitAudioContext);
    },
  };
}
