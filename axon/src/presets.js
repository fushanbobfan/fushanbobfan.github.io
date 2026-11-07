// Starting points for the membrane tab. The numbers each note quotes are
// checked in test/presets.test.js.

export const DEFAULTS = Object.freeze({
  amplitude: 10,
  width: 1,
  second: false,
  secondAmplitude: 10,
  gap: 8,
  length: 50,
  celsius: 6.3,
  na: 100,
  k: 100,
});

export const PRESETS = [
  {
    id: 'push',
    label: 'A brief push',
    settings: {},
    note: 'A 1 ms push lifts the voltage past threshold. Sodium channels open and the voltage overshoots zero to about +39 mV. Then the sodium channels plug themselves, potassium channels open, and the voltage falls past rest to about -76 mV before it recovers.',
  },
  {
    id: 'short',
    label: 'Just too weak',
    settings: { amplitude: 6.8 },
    note: 'A strength of 6.8 gives a small bump that dies away. Raise it to 7 and a spike appears at nearly full height: there is no such thing as half a spike.',
  },
  {
    id: 'soon',
    label: 'Second push too soon',
    settings: { second: true, gap: 8, length: 60 },
    note: 'The second push is as strong as the first, but it arrives 8 ms later, while more sodium channels than usual are still plugged and extra potassium channels are still open. Nothing fires. Drag the gap to 15 ms and the second spike is back.',
  },
  {
    id: 'steady',
    label: 'Steady current',
    settings: { amplitude: 10, width: 200, length: 100 },
    note: 'Hold the current on and the membrane keeps firing, about 68 times a second. A stronger current fires it faster, while at a strength of 6 it gives up after two spikes.',
  },
  {
    id: 'rebound',
    label: 'Letting go',
    settings: { amplitude: -5, width: 30, length: 60 },
    note: 'This current is negative: it holds the voltage down for 30 ms. When it stops, the membrane fires with no push at all. Holding it low unplugged more sodium channels and shut more potassium channels, so ordinary rest now lies above threshold.',
  },
  {
    id: 'no-sodium',
    label: 'Sodium channels blocked',
    settings: { na: 0 },
    note: 'This is what tetrodotoxin, the pufferfish poison, does. With no sodium current, the voltage rises only while the push lasts and then sinks back.',
  },
  {
    id: 'low-potassium',
    label: 'Half the potassium channels blocked',
    settings: { k: 50, amplitude: 0, length: 100 },
    note: 'Nobody is pushing here. Without enough potassium current to hold it at rest, the membrane fires by itself, and each spike is wider because repolarization is slower.',
  },
  {
    id: 'warm',
    label: 'A warmer axon',
    settings: { amplitude: 20, celsius: 18.5 },
    note: 'Warmed to 18.5 °C, the gates move about 3.8 times faster and the spike is about four times narrower. Keep warming: by 30 °C the same push makes no spike, because potassium catches up with sodium before the voltage can climb.',
  },
];

export function presetSettings(id) {
  const preset = PRESETS.find((p) => p.id === id);
  return preset ? { ...DEFAULTS, ...preset.settings } : null;
}

// The width slider runs from 0 to 100 on a log scale, 0.1 ms to 200 ms, so short
// pulses get as much room as long ones. Values snap to two significant figures.
const WIDTH_LOW = 0.1;
const WIDTH_HIGH = 200;

export function widthFromSlider(position) {
  const value = WIDTH_LOW * Math.pow(WIDTH_HIGH / WIDTH_LOW, position / 100);
  return Math.min(WIDTH_HIGH, Number(value.toPrecision(2)));
}

export function sliderFromWidth(width) {
  return (Math.log(width / WIDTH_LOW) / Math.log(WIDTH_HIGH / WIDTH_LOW)) * 100;
}

// The pulses a set of controls asks for. Everything starts 5 ms into the trace.
export function pulsesFrom(settings) {
  const pulses = [];
  if (settings.amplitude !== 0) {
    pulses.push({ start: 5, duration: settings.width, amplitude: settings.amplitude });
  }
  if (settings.second) {
    pulses.push({ start: 5 + settings.gap, duration: 1, amplitude: settings.secondAmplitude });
  }
  return pulses;
}
