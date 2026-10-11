// Run a rule for a number of steps and print what the colony did.
// Usage: node scripts/probe.js RULE STEPS

import { parseRule } from '../src/rules.js';
import { Colony } from '../src/colony.js';

const [text = 'RL', stepsArg = '20000'] = process.argv.slice(2);
const parsed = parseRule(text);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(1);
}
const colony = new Colony(parsed.rule, [{ x: 0, y: 0, dir: 0 }]);
const t0 = performance.now();
colony.run(Number(stepsArg));
const ms = performance.now() - t0;
const { minX, maxX, minY, maxY } = colony.box;
console.log({
  rule: parsed.rule.text,
  steps: colony.steps,
  ms: Math.round(ms),
  box: `${maxX - minX + 1} x ${maxY - minY + 1}`,
  highway: colony.highway,
  halted: colony.halted,
});
