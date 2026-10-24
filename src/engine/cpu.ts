import { type Inputs, type Match, nextRandom, noInputs } from './engine';

/** How often the CPU makes up its mind, in frames; it holds its inputs in between. */
export const CPU_DECIDE_FRAMES = 8;

/**
 * The CPU player's inputs for this tick. Decides every CPU_DECIDE_FRAMES frames from `match.rng`
 * alone, so the same seed and the same match give the same play. Call it once per tick, before `tick`.
 */
export function cpuInputs(match: Match, me: 0 | 1): Inputs {
  const memory = match.cpu[me];
  if (match.frame < memory.next) {
    // Presses are edge-triggered: only the decision tick carries them.
    return { ...memory.held, jump: false, light: false, heavy: false, special: false };
  }
  const decision = decide(match, me);
  memory.held = decision;
  memory.next = match.frame + CPU_DECIDE_FRAMES;
  return { ...decision };
}

function decide(match: Match, me: 0 | 1): Inputs {
  const out = noInputs();
  const f = match.fighters[me];
  const opp = match.fighters[me === 0 ? 1 : 0];
  const table = match.tables[me];
  const toward: 1 | -1 = opp.x >= f.x ? 1 : -1;
  const dist = Math.abs(opp.x - f.x);
  const lightRange = table.moves.light.hit?.range ?? 2.0;
  const heavyRange = table.moves.heavy.hit?.range ?? 2.3;
  const walkIn = () => {
    if (toward > 0) out.right = true;
    else out.left = true;
  };
  const backOff = () => {
    if (toward > 0) out.left = true;
    else out.right = true;
  };

  if (match.phase !== 'fight' && match.phase !== 'finish') return out;
  if (f.state === 'death' || f.state === 'dazed' || f.state === 'knockdown') return out;

  // The finish: close in and go for the heavy.
  if (match.phase === 'finish') {
    if (opp.state === 'dazed') {
      if (dist <= heavyRange * 0.9) out.heavy = true;
      else walkIn();
    }
    return out;
  }

  // Something flying at me: jump it or block it.
  const incoming = match.projectiles.find((p) => p.owner !== me && Math.sign(p.vx) === Math.sign(f.x - p.x) && Math.abs(p.x - f.x) < 2.2);
  if (incoming) {
    if (nextRandom(match) < 0.5) out.jump = true;
    else out.block = true;
    return out;
  }

  // The opponent is swinging at me from close by.
  if (opp.state === 'attack' && dist < heavyRange + 0.3) {
    if (nextRandom(match) < 0.7) {
      out.block = true;
      return out;
    }
  }

  if (dist > lightRange) {
    if (dist > 4.5 && f.cooldown === 0 && nextRandom(match) < 0.3) {
      out.special = true;
      return out;
    }
    walkIn();
    return out;
  }

  const r = nextRandom(match);
  if (r < 0.55) out.light = true;
  else if (r < 0.8) out.heavy = true;
  else if (r < 0.9) backOff();
  else if (r < 0.95) out.jump = true;
  return out;
}
