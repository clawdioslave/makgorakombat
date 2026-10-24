import type { AnimationInfo } from '@mogshot/character/scene';
import { type Inputs, type Match, newMatch, noInputs, tick } from '../../src/engine/engine';
import { type MoveTable, resolveMoves, type Wielding } from '../../src/engine/moves';
import { INTRO_FRAMES } from '../../src/engine/stage';

/** A retail-like animation list, every sequence 1000 ms unless overridden by name. */
export const FULL_SET = [
  'Stand', 'Ready1H', 'Walk', 'Walkbackwards', 'JumpStart', 'Jump', 'JumpEnd',
  'Attack1H', 'Attack1H', 'Attack1H', 'AttackUnarmed', 'Special1H', 'SpellCastDirected',
  'ShieldBlock', 'CombatWound', 'CombatCritical', 'Knockdown', 'Stun', 'Death',
  'CombatExecute', 'BattleRoar', 'EmoteCheer',
];

export function fakeAnimations(names: readonly string[] = FULL_SET, durations: Record<string, number> = {}): AnimationInfo[] {
  const seen = new Map<string, number>();
  return names.map((name, i) => {
    const variation = seen.get(name) ?? 0;
    seen.set(name, variation + 1);
    return { sequence: i, id: 1000 + i, variation, name, duration: durations[name] ?? 1000 };
  });
}

export function fakeTable(names: readonly string[] = FULL_SET, wielding: Wielding = 'oneHand', durations: Record<string, number> = {}): MoveTable {
  return resolveMoves(fakeAnimations(names, durations), wielding);
}

export function fakeMatch(seed = 1): Match {
  return newMatch([fakeTable(), fakeTable()], seed);
}

export function inputs(partial: Partial<Inputs> = {}): Inputs {
  return { ...noInputs(), ...partial };
}

export const NONE: [Inputs, Inputs] = [inputs(), inputs()];

/** Ticks `n` times with the same inputs. */
export function run(match: Match, n: number, both: [Inputs, Inputs] = NONE): void {
  for (let i = 0; i < n; i++) tick(match, both);
}

/** Through "ROUND 1" and "FIGHT!" to the first frame the fighters can act. */
export function skipIntro(match: Match): void {
  run(match, INTRO_FRAMES + 1);
}

/** Ticks until `done` or `limit` frames pass; returns how many ticks it took, or -1. */
export function until(match: Match, done: (m: Match) => boolean, limit: number, both: [Inputs, Inputs] = NONE): number {
  for (let i = 0; i < limit; i++) {
    if (done(match)) return i;
    tick(match, both);
  }
  return done(match) ? limit : -1;
}

/** Puts the fighters `gap` apart around the centre, facing each other, on the ground. */
export function place(match: Match, gap: number): void {
  match.fighters[0].x = -gap / 2;
  match.fighters[1].x = gap / 2;
  match.fighters[0].facing = 1;
  match.fighters[1].facing = -1;
}
