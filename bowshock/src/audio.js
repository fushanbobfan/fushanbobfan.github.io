// What the listener hears, as up to two sine voices, one per image. A pure
// tone played backwards is the same tone, so a reversed image is voiced at
// the size of its ratio. Browser only; nothing starts until the page asks.

export const BASE_HZ = 330;
const VOICES = 2;

// Frequency and loudness for one image: pitch scaled by the ratio and kept
// audible, loudness falling with the square root of distance as a 2D wave
// does, and lowered as the pitch climbs so the Mach 1 squeal is not painful.
export function voice(im, base = BASE_HZ) {
  const hz = Math.min(4000, Math.max(40, base * Math.abs(im.ratio)));
  const gain = Math.min(0.25, 0.9 / Math.sqrt(Math.max(4, im.dist))) * Math.min(1, base / hz);
  return { hz, gain };
}

export class Tone {
  constructor() {
    this.ctx = null;
    this.voices = [];
  }

  get running() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  async start() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      const master = this.ctx.createGain();
      master.gain.value = 0.6;
      master.connect(this.ctx.destination);
      for (let i = 0; i < VOICES; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = BASE_HZ;
        gain.gain.value = 0;
        osc.connect(gain).connect(master);
        osc.start();
        this.voices.push({ osc, gain });
      }
    }
    await this.ctx.resume();
    return true;
  }

  async stop() {
    if (this.ctx) await this.ctx.suspend();
  }

  // Images newest first, as `images` returns them.
  update(list) {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      const im = list[i];
      if (!im) {
        v.gain.gain.setTargetAtTime(0, now, 0.03);
        return;
      }
      const { hz, gain } = voice(im);
      v.osc.frequency.setTargetAtTime(hz, now, 0.015);
      v.gain.gain.setTargetAtTime(gain, now, 0.03);
    });
  }
}
