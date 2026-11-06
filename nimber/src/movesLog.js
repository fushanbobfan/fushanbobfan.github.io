import { turningPoints } from './turns.js';

// The list of moves, and after the game a sentence on where it was decided.
// moveText turns a history entry into words; noun names the starting position.
export function renderMoves(log, verdict, game, moveText, noun) {
  log.replaceChildren();
  for (const entry of game.history) {
    const li = document.createElement('li');
    li.textContent = `${entry.who === 'you' ? 'You' : 'Computer'}: ${moveText(entry)}`;
    if (game.winner && entry.quality === 'slip') {
      li.className = 'slip';
      li.textContent += ' (gave the game away)';
    }
    log.append(li);
  }
  log.scrollTop = log.scrollHeight;
  verdict.textContent = game.winner ? verdictText(game, moveText, noun) : '';
}

function verdictText(game, moveText, noun) {
  const turns = turningPoints(game);
  if (turns.length) {
    const last = turns[turns.length - 1];
    const whose = last.who === 'you' ? 'your' : "the computer's";
    return `The game last changed hands on ${whose} move: ${moveText(last)}.`;
  }
  const opener = game.first === 'you' ? 'You' : 'The computer';
  const outcome = game.winner === game.first ? 'won' : 'lost';
  return `${opener} moved first from a ${noun} that was ${outcome} from the start, and nobody slipped.`;
}
