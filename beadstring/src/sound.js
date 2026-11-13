// Hearing the modes: each mode becomes a sine tone. The lowest mode is tuned
// to a fixed pitch and the others keep their true frequency ratios, so the
// ear hears exactly how far the beads pull the overtones off whole multiples.

export const BASE_HZ = 196;        // G3
export const MAX_HZ = 12000;       // partials above this are left silent
export const MASTER_GAIN = 0.25;

// Mode amplitudes from mode energies: A = sqrt(2E) / w.
export function modeAmplitudes(energies, omega) {
  return Array.from(energies, (e, i) => (omega[i] > 0 ? Math.sqrt(2 * e) / omega[i] : 0));
}

// One {hz, gain} per mode. `norm` is the summed amplitude at the moment the
// sound's level was set, so a damped string fades out instead of being
// turned back up. With `smooth`, mode k is tuned to k times the base, the
// overtones a smooth string would give.
export function partials(energies, omega, norm, { smooth = false, base = BASE_HZ } = {}) {
  const amps = modeAmplitudes(energies, omega);
  const w1 = omega[0];
  return amps.map((a, i) => {
    const hz = smooth ? base * (i + 1) : w1 > 0 ? (base * omega[i]) / w1 : 0;
    const audible = hz > 0 && hz <= MAX_HZ && norm > 0;
    return { hz, gain: audible ? a / norm : 0 };
  });
}

export function amplitudeSum(energies, omega) {
  return modeAmplitudes(energies, omega).reduce((s, a) => s + a, 0);
}

// A bank of sine oscillators behind one master gain. Created on a user
// gesture; browsers refuse to start audio otherwise.
export function createVoice(AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!AudioContextClass) return null;
  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const tones = [];

  function tone(i) {
    while (tones.length <= i) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      gain.gain.value = 0;
      osc.connect(gain).connect(master);
      osc.start();
      tones.push({ osc, gain });
    }
    return tones[i];
  }

  return {
    // Glide every tone toward its new pitch and level; the short time
    // constant avoids clicks without smearing the decay.
    set(list) {
      const now = ctx.currentTime;
      list.forEach((p, i) => {
        const t = tone(i);
        if (p.hz > 0) t.osc.frequency.setTargetAtTime(p.hz, now, 0.01);
        t.gain.gain.setTargetAtTime(p.gain, now, 0.03);
      });
      for (let i = list.length; i < tones.length; i++) tones[i].gain.gain.setTargetAtTime(0, now, 0.03);
    },
    async on() {
      await ctx.resume();
      master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.05);
    },
    off() {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
  };
}
