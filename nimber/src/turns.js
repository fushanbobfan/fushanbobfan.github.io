// Turn-taking between "you" and "computer" for any impartial game, kept as plain
// data so a whole game can be played in a test exactly as the page plays it.
//
// A rules object gives legalMoves(position), applyMove(position, move) and
// isWinning(position), and may set lastMoverLoses for misère play. The game ends
// when no move is left. stallMoves(position) can narrow what a computer plays
// when it has no winning move or is made to slip.

const other = (who) => (who === 'you' ? 'computer' : 'you');

export function createGame(rules, position, first = 'you') {
  if (!rules.legalMoves(position).length) throw new Error('a game needs at least one move');
  return { rules, start: position, position, first, turn: first, history: [], winner: null };
}

// 'good' keeps a won position won, 'slip' throws it away,
// 'lost' is any move from a position that was already lost.
export function judgeMove(rules, position, move) {
  if (!rules.isWinning(position)) return 'lost';
  return rules.isWinning(rules.applyMove(position, move)) ? 'slip' : 'good';
}

export function playMove(game, move) {
  if (game.winner) throw new Error('the game is over');
  const { rules } = game;
  const legal = rules.legalMoves(game.position);
  if (!legal.some((m) => JSON.stringify(m) === JSON.stringify(move))) throw new Error('illegal move');
  const position = rules.applyMove(game.position, move);
  const finished = rules.legalMoves(position).length === 0;
  const loser = rules.lastMoverLoses ? game.turn : other(game.turn);
  return {
    ...game,
    position,
    turn: other(game.turn),
    history: [...game.history, {
      who: game.turn,
      move,
      before: game.position,
      quality: judgeMove(rules, game.position, move),
    }],
    winner: finished ? other(loser) : null,
  };
}

// Rewinds to your previous decision: your last move and any reply to it.
export function takeBack(game) {
  const history = game.history.slice();
  while (history.length && history[history.length - 1].who !== 'you') history.pop();
  if (!history.length) return game;
  history.pop();
  let rewound = createGame(game.rules, game.start, game.first);
  for (const { move } of history) rewound = playMove(rewound, move);
  return { ...game, ...rewound };
}

export function winningMoves(rules, position) {
  return rules.legalMoves(position).filter((m) => !rules.isWinning(rules.applyMove(position, m)));
}

// skill is the chance of playing a winning move when one exists.
export function chooseMove(rules, position, { skill = 1, rng = Math.random } = {}) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const good = winningMoves(rules, position);
  if (good.length && rng() < skill) return pick(good);
  const pool = rules.stallMoves ? rules.stallMoves(position) : rules.legalMoves(position);
  const stalling = pool.filter((m) => rules.isWinning(rules.applyMove(position, m)));
  return pick(stalling.length ? stalling : pool);
}

// The moves where the game changed hands: a player holding a won game let it go.
export function turningPoints(game) {
  return game.history.filter((entry) => entry.quality === 'slip');
}
