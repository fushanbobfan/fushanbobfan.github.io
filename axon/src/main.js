import { mountAxon } from './axonView.js';
import { mountClamp } from './clampView.js';
import { mountMembrane } from './membraneView.js';
import { mountThresholds } from './thresholdsView.js';

const membrane = mountMembrane();
const views = {
  membrane,
  thresholds: mountThresholds(),
  clamp: mountClamp(),
  axon: mountAxon(),
};

const buttons = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('[data-panel]')];

function show(name, { remember = true } = {}) {
  const chosen = views[name] ? name : 'membrane';
  for (const panel of panels) panel.hidden = panel.dataset.panel !== chosen;
  for (const button of buttons) {
    const active = button.dataset.tab === chosen;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (chosen !== 'membrane') membrane.pause();
  views[chosen].shown?.();
  views[chosen].redraw();
  if (remember) history.replaceState(null, '', `${location.pathname}${location.search}#${chosen}`);
}

for (const button of buttons) {
  button.addEventListener('click', () => show(button.dataset.tab));
}
show(location.hash.slice(1), { remember: false });
