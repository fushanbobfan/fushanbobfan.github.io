import { mountPiles } from './pilesView.js';
import { mountRows } from './rowsView.js';
import { parseRows } from './share.js';

const shared = parseRows(location.hash);
const tabs = [...document.querySelectorAll('.tabs button')];
mountPiles();
const rows = mountRows();

function show(name) {
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  if (name === 'rows') rows.show();
}

for (const tab of tabs) tab.addEventListener('click', () => show(tab.dataset.tab));

if (shared) {
  show('rows');
  rows.load(shared);
} else {
  show('piles');
}

