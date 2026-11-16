// Ready-made situations: worldlines with clocks, rods drawn as bands, flashes of light,
// and the events that matter, each with a short account computed from the geometry.

import { gamma, boost } from './lorentz.js';
import { properTimeAlong, uniform, lightMeets } from './worldlines.js';
import { fmt } from './readout.js';

const SPAN = 4.9; // lab times a worldline is drawn between

function freeScene() {
  return {
    id: 'free',
    name: 'Free: your own events',
    rocketBeta: 0.5,
    events: [{ t: 0, x: -2 }, { t: 1, x: 2.5 }, { t: 3, x: 0.5 }],
    selected: [0, 1],
    paths: [],
    bands: [],
    rays: [],
    story: [],
  };
}

function twinsScene() {
  const beta = 0.6;
  const depart = { t: -4, x: 0 };
  const turn = { t: 0, x: beta * 4 };
  const back = { t: 4, x: 0 };
  const home = [depart, back];
  const away = [depart, turn, back];
  const tHome = properTimeAlong(home);
  const tAway = properTimeAlong(away);
  // Where each leg's line of "now" through the turn meets the home worldline (x = 0).
  const homeBefore = turn.t - beta * turn.x - depart.t;
  const homeAfter = turn.t + beta * turn.x - depart.t;
  return {
    id: 'twins',
    name: 'The twins',
    rocketBeta: beta,
    events: [depart, turn, back],
    selected: [0, 1],
    paths: [
      { name: 'Twin at home', color: 'lab', points: home, clocks: true },
      { name: 'Travelling twin', color: 'rocket', points: away, clocks: true },
    ],
    bands: [],
    rays: [],
    numbers: { tHome, tAway, homeBefore, homeAfter },
    story: [
      `A: one twin leaves at ${fmt(beta)}c. B: the turnaround. C: they meet again.`,
      `The clock that stays home ticks off ${fmt(tHome)} s; the travelling clock, ${fmt(tAway)} s. Count the tick marks on each worldline.`,
      `On the way out, each twin sees the other's clock run slow, so why is the traveller the younger one? Select B and look at the rocket's line of "now": it meets the home clock at ${fmt(homeBefore)} s. Set the rocket to −${fmt(beta)}c, the return leg, and the line swings to ${fmt(homeAfter)} s. Only the traveller changes frames, and that jump is the missing time.`,
    ],
  };
}

function barnScene() {
  const beta = 0.8;
  const g = gamma(beta);
  const ladderRest = 2.5;
  const barn = { from: 0, to: 2 };
  const ladderLab = ladderRest / g;
  const mid = (barn.from + barn.to) / 2;
  const frontAt0 = mid + ladderLab / 2;
  const backAt0 = mid - ladderLab / 2;
  const backIn = { t: (barn.from - backAt0) / beta, x: barn.from };
  const frontOut = { t: (barn.to - frontAt0) / beta, x: barn.to };
  const insideLab = frontOut.t - backIn.t;
  const inLadder = boost(frontOut, beta).t - boost(backIn, beta).t;
  return {
    id: 'barn',
    name: 'A ladder in a barn',
    rocketBeta: beta,
    events: [backIn, frontOut],
    selected: [0, 1],
    paths: [],
    bands: [
      { name: 'Barn', color: 'lab', back: uniform(0, barn.from, -SPAN, SPAN), front: uniform(0, barn.to, -SPAN, SPAN) },
      { name: 'Ladder', color: 'rocket', back: uniform(beta, backAt0, -SPAN, SPAN), front: uniform(beta, frontAt0, -SPAN, SPAN) },
    ],
    rays: [],
    numbers: { ladderLab, barnInLadder: (barn.to - barn.from) / g, insideLab, inLadder },
    story: [
      `A ${fmt(ladderRest)} light-second ladder runs at ${fmt(beta)}c through a barn ${fmt(barn.to - barn.from)} light-seconds long. A: the back of the ladder enters. B: the front reaches the far door.`,
      `In the lab the ladder is only ${fmt(ladderLab)} long, so A comes first and for ${fmt(insideLab)} s the whole ladder is inside.`,
      `Riding with the ladder, the barn is the short one, ${fmt((barn.to - barn.from) / g)} long, and B comes ${fmt(-inLadder)} s before A: the front leaves before the back is in. Both are right, because A and B are spacelike apart. Press "The rocket" to see it.`,
    ],
  };
}

function lightningScene() {
  const beta = 0.5;
  const g = gamma(beta);
  const trainRest = 4;
  const half = trainRest / g / 2;
  const rear = { t: 0, x: -half };
  const front = { t: 0, x: half };
  const passengerSeesFront = lightMeets(front, -1, beta, 0);
  const passengerSeesRear = lightMeets(rear, 1, beta, 0);
  const platformSeesBoth = { t: half, x: 0 };
  const inTrain = boost(front, beta).t - boost(rear, beta).t;
  return {
    id: 'lightning',
    name: 'Lightning on a train',
    rocketBeta: beta,
    events: [rear, front, passengerSeesFront, passengerSeesRear, platformSeesBoth],
    selected: [0, 1],
    paths: [
      { name: 'Watcher on the platform', color: 'lab', points: uniform(0, 0, -SPAN, SPAN), clocks: false },
      { name: 'Passenger mid-train', color: 'rocket', points: uniform(beta, 0, -SPAN, SPAN), clocks: false },
    ],
    bands: [
      { name: 'Train', color: 'rocket', back: uniform(beta, -half, -SPAN, SPAN), front: uniform(beta, half, -SPAN, SPAN) },
    ],
    rays: [
      { from: rear, to: passengerSeesRear },
      { from: front, to: passengerSeesFront },
      { from: front, to: platformSeesBoth },
    ],
    numbers: { inTrain, platform: platformSeesBoth.t, passengerFront: passengerSeesFront.t, passengerRear: passengerSeesRear.t },
    story: [
      `A ${fmt(trainRest)} light-second train passes at ${fmt(beta)}c. Lightning hits its rear (A) and its front (B) just as they line up with marks on the platform.`,
      `The flashes reach the watcher standing midway on the platform together (E, at ${fmt(platformSeesBoth.t)} s), so for the platform the strikes were simultaneous.`,
      `The passenger in the middle of the train rides toward the front flash and meets it first (C), then the rear one (D). Light moves at the same speed for the passenger, who sat equally far from both ends, so for the train the front was struck ${fmt(-inTrain)} s earlier.`,
    ],
  };
}

export const SCENES = [freeScene(), twinsScene(), barnScene(), lightningScene()];

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}
