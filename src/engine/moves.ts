import type { WeaponKind } from '@mogshot/character/equipment';
import type { AnimationInfo } from '@mogshot/character/scene';

export type MoveName =
  | 'idle'
  | 'walk'
  | 'back'
  | 'jumpStart'
  | 'jump'
  | 'jumpEnd'
  | 'light'
  | 'heavy'
  | 'special'
  | 'block'
  | 'hit'
  | 'crit'
  | 'knockdown'
  | 'dazed'
  | 'death'
  | 'finisher'
  | 'intro'
  | 'win';

export type Wielding = WeaponKind | 'unarmed';

/** What an attack does, as fractions of the move's duration and stage units. */
export interface HitWindow {
  /** The attack connects while t/duration is in [from, to]. A projectile spawns when t passes `from`. */
  from: number;
  to: number;
  /** Reach ahead of the attacker. */
  range: number;
  damage: number;
  /** Speed given to the target, away from the attacker. */
  pushback: number;
  /** Frames both fighters freeze when it lands. */
  hitstop: number;
  /** The target plays `crit`; every third landed one knocks them down. */
  crit: boolean;
  /** Spawns a projectile instead of testing reach. */
  projectile: boolean;
  /** Frames before the attacker may throw it again. */
  cooldown: number;
  /** Past this fraction the attacker may start another action. */
  recover: number;
}

export interface Variation {
  sequence: number;
  /** Milliseconds. */
  duration: number;
}

export interface Move {
  name: MoveName;
  /** The model animation that was found; '' when none of the candidates exists and the move borrows another. */
  animation: string;
  /** At least one. Only `light` collects every variation of its animation. */
  variations: Variation[];
  /** Wraps around when it ends; otherwise it holds its last frame until the engine moves on. */
  loop: boolean;
  hit?: HitWindow;
}

export interface MoveTable {
  moves: Record<MoveName, Move>;
  /** False when the model has neither JumpStart nor Jump; the jump still happens, in the idle animation. */
  hasJump: boolean;
  /** False when nothing matched SpellCastDirected or ReadySpellDirected; the special still fires. */
  hasSpecial: boolean;
}

const READY: Record<Wielding, string[]> = {
  unarmed: ['ReadyUnarmed'],
  oneHand: ['Ready1H'],
  twoHand: ['Ready2H'],
  long: ['Ready2HL', 'Ready2H'],
  bow: ['ReadyBow'],
  rifle: ['ReadyRifle'],
  crossbow: ['ReadyCrossbow', 'ReadyRifle'],
  thrown: ['ReadyThrown', 'Ready1H'],
};

const ATTACK: Record<Wielding, string[]> = {
  unarmed: ['AttackUnarmed'],
  oneHand: ['Attack1H'],
  twoHand: ['Attack2H'],
  long: ['Attack2HL', 'Attack2H'],
  bow: ['AttackBow'],
  rifle: ['AttackRifle'],
  crossbow: ['AttackCrossbow', 'AttackRifle'],
  thrown: ['AttackThrown', 'Attack1H'],
};

const SPECIAL: Record<Wielding, string[]> = {
  unarmed: ['SpecialUnarmed'],
  oneHand: ['Special1H'],
  twoHand: ['Special2H'],
  long: ['Special2H'],
  bow: ['Special1H'],
  rifle: ['Special1H'],
  crossbow: ['Special1H'],
  thrown: ['Special1H'],
};

const PARRY: Record<Wielding, string[]> = {
  unarmed: ['ParryUnarmed'],
  oneHand: ['Parry1H'],
  twoHand: ['Parry2H'],
  long: ['Parry2HL', 'Parry2H'],
  bow: ['ParryUnarmed'],
  rifle: ['ParryUnarmed'],
  crossbow: ['ParryUnarmed'],
  thrown: ['Parry1H'],
};

const ALL_READY = ['Ready1H', 'Ready2H', 'ReadyUnarmed', 'Ready2HL', 'ReadyBow', 'ReadyRifle', 'ReadyCrossbow', 'ReadyThrown'];
const ALL_ATTACK = ['Attack1H', 'Attack2H', 'Attack2HL', 'AttackUnarmed', 'AttackBow', 'AttackRifle', 'AttackCrossbow', 'AttackThrown'];
const ALL_SPECIAL = ['Special1H', 'Special2H', 'SpecialUnarmed', 'CombatAbility2HBig01', 'RoundHouseKick', 'Kick'];
const ALL_PARRY = ['ShieldBlock', 'Parry1H', 'Parry2H', 'Parry2HL', 'ParryUnarmed', 'Dodge'];

const LIGHT_HIT: HitWindow = { from: 0.3, to: 0.55, range: 2.0, damage: 8, pushback: 0.35, hitstop: 6, crit: false, projectile: false, cooldown: 0, recover: 0.85 };
const HEAVY_HIT: HitWindow = { from: 0.4, to: 0.65, range: 2.3, damage: 16, pushback: 0.6, hitstop: 10, crit: true, projectile: false, cooldown: 0, recover: 0.9 };
const SPECIAL_HIT: HitWindow = { from: 0.55, to: 0.55, range: 0, damage: 12, pushback: 0.45, hitstop: 8, crit: false, projectile: true, cooldown: 90, recover: 0.85 };

/** Candidates in order of preference, for a given weapon. `light` collects all variations of the name it finds. */
function candidates(wielding: Wielding): Record<MoveName, { names: string[]; loop: boolean; hit?: HitWindow }> {
  const uniq = (first: string[], rest: string[]) => [...new Set([...first, ...rest])];
  return {
    idle: { names: uniq(READY[wielding], ['Stand']), loop: true },
    walk: { names: ['Walk', 'Run'], loop: true },
    back: { names: ['Walkbackwards', 'RunBackwards', 'Walk'], loop: true },
    jumpStart: { names: ['JumpStart'], loop: false },
    jump: { names: ['Jump'], loop: true },
    jumpEnd: { names: ['JumpEnd', 'JumpLandRun'], loop: false },
    light: { names: uniq(ATTACK[wielding], ['AttackUnarmed']), loop: false, hit: LIGHT_HIT },
    heavy: { names: uniq(SPECIAL[wielding], ['Special1H', 'Special2H', 'SpecialUnarmed', 'CombatAbility2HBig01', 'RoundHouseKick', 'Kick']), loop: false, hit: HEAVY_HIT },
    special: { names: ['SpellCastDirected', 'ReadySpellDirected'], loop: false, hit: SPECIAL_HIT },
    block: { names: uniq(['ShieldBlock'], [...PARRY[wielding], 'Parry1H', 'Parry2H', 'ParryUnarmed', 'Dodge']), loop: false },
    hit: { names: ['CombatWound', 'StandWound'], loop: false },
    crit: { names: ['CombatCritical', 'CombatWound'], loop: false },
    knockdown: { names: ['Knockdown', 'CombatCritical'], loop: false },
    dazed: { names: ['Stun', 'StandWound'], loop: true },
    death: { names: ['Death'], loop: false },
    finisher: { names: ['CombatExecute', 'CombatFinishingMove', 'Special2H', 'Special1H'], loop: false },
    intro: { names: ['BattleRoar', 'EmoteRoar', 'Stand'], loop: false },
    win: { names: ['EmoteCheer', 'EmoteRoar', 'BattleRoar'], loop: false },
  };
}

export const MOVE_NAMES: readonly MoveName[] = [
  'idle', 'walk', 'back', 'jumpStart', 'jump', 'jumpEnd', 'light', 'heavy', 'special', 'block',
  'hit', 'crit', 'knockdown', 'dazed', 'death', 'finisher', 'intro', 'win',
];

/** Every model animation any move may use, deduped: what select passes to `client.fighter()` so the worker pre-reads them. */
export const ALL_MOVE_NAMES: readonly string[] = [
  ...new Set([
    ...ALL_READY, 'Stand',
    'Walk', 'Run', 'Walkbackwards', 'RunBackwards',
    'JumpStart', 'Jump', 'JumpEnd', 'JumpLandRun',
    ...ALL_ATTACK,
    ...ALL_SPECIAL,
    'SpellCastDirected', 'ReadySpellDirected',
    ...ALL_PARRY,
    'CombatWound', 'StandWound', 'CombatCritical', 'Knockdown', 'Stun', 'Death',
    'CombatExecute', 'CombatFinishingMove',
    'BattleRoar', 'EmoteRoar', 'EmoteCheer',
  ]),
];

/**
 * Picks a move table out of what a model animates: the first candidate the model has wins.
 * A move with no candidate borrows the idle animation (a jump still jumps, a block still blocks).
 */
export function resolveMoves(animations: readonly AnimationInfo[], wielding: Wielding): MoveTable {
  const byName = new Map<string, AnimationInfo[]>();
  for (const a of animations) {
    const list = byName.get(a.name);
    if (list) list.push(a);
    else byName.set(a.name, [a]);
  }
  const find = (names: string[]): AnimationInfo[] | undefined => {
    for (const name of names) {
      const list = byName.get(name);
      if (list && list.length > 0) return [...list].sort((a, b) => a.variation - b.variation);
    }
    return undefined;
  };

  const spec = candidates(wielding);
  const idleInfos = find(spec.idle.names) ?? (animations[0] ? [animations[0]] : undefined);
  const idleVariation: Variation = idleInfos?.[0]
    ? { sequence: idleInfos[0].sequence, duration: Math.max(1, idleInfos[0].duration) }
    : { sequence: 0, duration: 1000 };
  const idleName = idleInfos?.[0]?.name ?? '';

  const moves = {} as Record<MoveName, Move>;
  let hasJump = false;
  let hasSpecial = false;
  for (const name of MOVE_NAMES) {
    const c = spec[name];
    const found = find(c.names);
    if (found && (name === 'jumpStart' || name === 'jump')) hasJump = true;
    if (found && name === 'special') hasSpecial = true;
    let variations: Variation[];
    if (!found) variations = [idleVariation];
    else if (name === 'light') variations = found.map((a) => ({ sequence: a.sequence, duration: Math.max(1, a.duration) }));
    else variations = [{ sequence: found[0]!.sequence, duration: Math.max(1, found[0]!.duration) }];
    const move: Move = {
      name,
      animation: found ? found[0]!.name : name === 'idle' ? idleName : '',
      variations,
      loop: c.loop,
    };
    if (c.hit) move.hit = c.hit;
    moves[name] = move;
  }
  return { moves, hasJump, hasSpecial };
}

/** The variation a fighter plays: `variation` cycles through the move's list. */
export function variationOf(move: Move, variation: number): Variation {
  const n = move.variations.length;
  return move.variations[((variation % n) + n) % n]!;
}
