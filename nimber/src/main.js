import { mountPiles } from './pilesView.js';
import { mountQueen } from './queenView.js';
import { mountRows } from './rowsView.js';
import { parseQueen, parseRows } from './share.js';

const sharedRow = parseRows(location.hash);
const sharedQueen = parseQueen(location.hash);
const tabs = [...document.querySelectorAll('.tabs button')];
mountPiles();
const rows = mountRows();
const queen = mountQueen();

function show(name) {
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  if (name === 'rows') rows.show();
  if (name === 'queen') queen.show();
}

for (const tab of tabs) tab.addEventListener('click', () => show(tab.dataset.tab));

if (sharedRow) {
  show('rows');
  rows.load(sharedRow);
} else if (sharedQueen) {
  show('queen');
  queen.load(sharedQueen);
} else {
  show('piles');
}
