import { ABILITY_MELEE_RANGE, ABILITY_SLOTS, DOT_TICK_FRAMES, EXECUTE_BELOW, GCD_FRAMES, MAX_RESOURCE, RESOURCE_NAMES, type ResolvedAbility, type SlotIndex } from './abilities';
import { BRAND } from './brand';
import { type Move, type MoveRef, type MoveTable, variationOf } from './moves';
import {
  BACK, BODY, FINISH_FRAMES, GRAVITY, HALF, HP, INTRO_FRAMES, JUMP_V, KO_SLOWMO, ROUND_END_FRAMES, ROUND_FRAMES,
  ROUNDS_TO_WIN, START_X, TICK_MS, WALK,
} from './stage';

/*
 * The fight, as World of Warcraft fights: an auto-attack on the weapon's swing timer whenever the
 * target is in reach, abilities on a global cooldown and their own cooldowns paid for in rage,
 * energy, mana, focus, runic power or fury, casts with a bar that damage interrupts, and every
 * blow rolled on the hit table: miss, dodge, parry, block, crit or a plain hit. Sixty ticks a
 * second, no DOM, the same seed and inputs always giving the same fight.
 */

/** What a fighter is doing, coarser than the move it plays. */
export type FighterState =
  | 'idle' | 'walk' | 'back' | 'jump'
  /** The auto-attack swing or shot. */
  | 'attack'
  /** An ability's own animation: a strike, the release of a cast, a blink. */
  | 'ability'
  /** The cast bar is filling. */
  | 'cast'
  /** Charging or rushing at the target. */
  | 'dash'
  | 'dodge' | 'parry'
  /** Flinching from a blow; still free to act. */
  | 'hit'
  | 'knockdown' | 'stun' | 'fear' | 'dazed' | 'death' | 'finisher' | 'intro' | 'win';

export interface ActiveDot {
  name: string;
  damage: number;
  ticksLeft: number;
  /** Frames until the next tick. */
  nextTick: number;
  source: 0 | 1;
}

export interface Cast {
  ability: number;
  /** Frames into the cast and the cast's length. */
  t: number;
  total: number;
}

export interface Dash {
  ability: number;
  t: number;
  /** Where the dash started, for a rush of fixed length. */
  fromX: number;
}

export interface Fighter {
  x: number;
  /** Height above the ground. */
  z: number;
  vz: number;
  /** Pushback speed along x, decaying every frame. */
  vx: number;
  /** Horizontal speed held through a leap, until landing. */
  airVx: number;
  /** +1 faces +X (screen right), -1 faces -X. */
  facing: 1 | -1;
  hp: number;
  /** Eases towards hp; the HUD's white trail. */
  shownHp: number;
  state: FighterState;
  /** The move being played and how far into it, in ms. */
  move: MoveRef;
  t: number;
  /** The current swing has already connected (or spawned its shot). */
  hitDone: boolean;
  /** Cycles the swing's variations; counts up on every swing. */
  variation: number;
  /** Frames this fighter stands frozen. */
  hitstop: number;
  airborne: boolean;
  /** Rounds won. */
  wins: number;
  /** Took damage this round. */
  tookDamage: boolean;
  /** Hit while airborne: knocked down on landing. */
  knockdownOnLand: boolean;
  /** The class resource: rage, energy, mana... in [0, MAX_RESOURCE]. */
  resource: number;
  /** Frames until the next auto-attack may go; 0 is ready. */
  swingT: number;
  /** The attack key is held: keep swinging. */
  auto: boolean;
  /** One swing queued by a tap. */
  queued: boolean;
  /** The attack input last tick, so a tap can be told from a hold. */
  attackWas: boolean;
  /** This press has already been told it is out of range. */
  attackSaid: boolean;
  /** An ability pressed while the fighter could not act yet, kept for a few frames; -1 for none. */
  buffered: number;
  bufferedT: number;
  /** Frames of global cooldown left. */
  gcd: number;
  /** Frames left on each of the kit's four abilities. */
  cooldowns: [number, number, number];
  /** The ability being used, cast or dashed with. */
  ability: number;
  cast: Cast | undefined;
  dash: Dash | undefined;
  stunT: number;
  slowT: number;
  fearT: number;
  /** Frames of raised dodge chance. */
  evasionT: number;
  /** Frames after a parry in which the next melee ability is a sure crit. */
  riposteT: number;
  /** Frames in which no cast may start, after being interrupted. */
  lockoutT: number;
  /** Damage still absorbed before health is touched. */
  absorb: number;
  absorbT: number;
  dots: ActiveDot[];
}

export interface Projectile {
  x: number;
  z: number;
  vx: number;
  owner: 0 | 1;
  /** Frames alive. */
  t: number;
  /** The ability that fired it, or -1 for an auto-shot. */
  ability: number;
  damage: number;
}

export type SparkKind = 'hit' | 'block' | 'crit' | 'parry' | 'spell' | 'dot';

export interface Spark {
  x: number;
  z: number;
  kind: SparkKind;
  /** Frames alive; gone at `life`. */
  t: number;
  life: number;
}

export type TextKind = 'damage' | 'crit' | 'dot' | 'heal' | 'absorb' | 'miss' | 'dodge' | 'parry' | 'block' | 'immune' | 'status' | 'info';

/** Floating combat text: a number or a word that rises over a fighter. */
export interface FloatingText {
  x: number;
  z: number;
  text: string;
  kind: TextKind;
  /** Over whom it floats. */
  side: 0 | 1;
  /** Who caused it: the other fighter for a blow, the fighter itself for a heal, a buff or a note. */
  from: 0 | 1;
  t: number;
  life: number;
}

export interface Inputs {
  left: boolean;
  right: boolean;
  /** Edge-triggered: true on the tick the button went down. */
  jump: boolean;
  /** Held: keep auto-attacking. A single tick of it queues one swing. */
  attack: boolean;
  /** Edge-triggered: the kit's four abilities. */
  abilities: [boolean, boolean, boolean];
}

export type Phase = 'intro' | 'fight' | 'finish' | 'ko' | 'roundEnd' | 'matchEnd';

export interface Banner {
  text: string;
  /** A second line, such as HONOR RESTORED. */
  sub?: string;
  /** Frames since it appeared. */
  t: number;
  /** Frames it should stay up. */
  life: number;
}

/** The CPU's last decision, held until it decides again. */
export interface CpuMemory {
  held: Inputs;
  /** Frame of the next decision. */
  next: number;
}

export interface Match {
  tables: [MoveTable, MoveTable];
  names: [string, string];
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  sparks: Spark[];
  texts: FloatingText[];
  /** 1-based. */
  round: number;
  phase: Phase;
  /** Frames in the current phase. */
  phaseT: number;
  /** Frames left in the round. */
  timer: number;
  /** Time scale: 1 normally, KO_SLOWMO.rate on the knockout. */
  slowmo: number;
  banner: Banner | undefined;
  /** LCG state; `nextRandom` advances it. */
  rng: number;
  frame: number;
  /** Who won the current round once decided, and the match once over. */
  roundWinner: 0 | 1 | undefined;
  winner: 0 | 1 | undefined;
  cpu: [CpuMemory, CpuMemory];
}

export function noInputs(): Inputs {
  return { left: false, right: false, jump: false, attack: false, abilities: [false, false, false] };
}

export const NO_INPUTS: Readonly<Inputs> = Object.freeze(noInputs());

const BANNER_LIFE = 90;
const SPARK_LIFE = 14;
/** Floating text lives 1.2 s. */
const TEXT_LIFE = 72;
const INFO_LIFE = 45;
const KNOCKDOWN_FRAMES = 30;
const PROJECTILE_Z = 1.25;
const HP_EASE = 0.08;
/** How far into the release animation a bolt leaves the hand. */
const BOLT_AT = 0.22;
/** Melee abilities connect early in their animation: a short wind-up, then the blow. */
const ABILITY_HIT = { from: 0.18, to: 0.5 };
/** Past this fraction of an ability's animation the fighter may act again. */
const ABILITY_RECOVER = 0.45;
const DODGE_RECOVER = 0.4;
/** Reach beyond the ability's range once it is already swinging. */
const REACH_SLACK = 0.4;
const DASH_SPEED = 0.3;
const DASH_STOP = 1.4;
const DASH_LIMIT = 60;
const RIPOSTE_FRAMES = 90;
const LOCKOUT_FRAMES = 120;
const ABSORB_FRAMES = 12 * 60;
const BLINK_DISTANCE = 3.5;
const LEAP_V = 0.16;
const LEAP_VX = 0.12;
const SLOW_FACTOR = 0.5;
const BLOCK_FACTOR = 0.6;
const CRIT_FACTOR = 2;
/** Speed given to the target by a blow; it decays by 0.82 a frame, so the distance is about 5.5 times this. The game has none; a nudge sells the impact. */
const PUSHBACK = { swing: 0.035, ability: 0.07, spell: 0.03, bolt: 0.05, charge: 0.2 } as const;

/** The hit table. Parry only from the front, block only with a shield, none of them against a helpless target. */
export const HIT_TABLE = { miss: 0.05, dodge: 0.06, evasion: 0.5, parry: 0.06, block: 0.1, crit: 0.15, spellMiss: 0.03 } as const;

/** Rage, fury and runic power earned when a swing lands, and rage when a blow is taken. */
const GAIN_ON_SWING = { oneHand: 10, twoHand: 17 } as const;
const RAGE_ON_HIT = 5;

export const PROJECTILE_SPEED = { bolt: 0.14, shot: 0.22 } as const;

function newFighter(side: 0 | 1, table: MoveTable): Fighter {
  return {
    x: side === 0 ? -START_X : START_X,
    z: 0,
    vz: 0,
    vx: 0,
    airVx: 0,
    facing: side === 0 ? 1 : -1,
    hp: HP,
    shownHp: HP,
    state: 'intro',
    move: 'intro',
    t: 0,
    hitDone: false,
    variation: 0,
    hitstop: 0,
    airborne: false,
    wins: 0,
    tookDamage: false,
    knockdownOnLand: false,
    resource: table.kit.starts,
    swingT: 0,
    auto: false,
    queued: false,
    attackWas: false,
    attackSaid: false,
    buffered: -1,
    bufferedT: 0,
    gcd: 0,
    cooldowns: [0, 0, 0],
    ability: 0,
    cast: undefined,
    dash: undefined,
    stunT: 0,
    slowT: 0,
    fearT: 0,
    evasionT: 0,
    riposteT: 0,
    lockoutT: 0,
    absorb: 0,
    absorbT: 0,
    dots: [],
  };
}

/** Puts both fighters back on their marks for a new round, keeping their wins. */
function resetRound(match: Match): void {
  for (let i = 0 as 0 | 1; i < 2; i++) {
    const wins = match.fighters[i].wins;
    const fresh = newFighter(i, match.tables[i]);
    fresh.wins = wins;
    match.fighters[i] = fresh;
  }
  match.projectiles.length = 0;
  match.sparks.length = 0;
  match.texts.length = 0;
  match.timer = ROUND_FRAMES;
  match.slowmo = 1;
  match.roundWinner = undefined;
  setPhase(match, 'intro');
  showBanner(match, BRAND.round(match.round));
}

export function newMatch(tables: [MoveTable, MoveTable], seed: number, names: [string, string] = ['P1', 'P2']): Match {
  const match: Match = {
    tables,
    names,
    fighters: [newFighter(0, tables[0]), newFighter(1, tables[1])],
    projectiles: [],
    sparks: [],
    texts: [],
    round: 1,
    phase: 'intro',
    phaseT: 0,
    timer: ROUND_FRAMES,
    slowmo: 1,
    banner: undefined,
    rng: seed >>> 0,
    frame: 0,
    roundWinner: undefined,
    winner: undefined,
    cpu: [{ held: noInputs(), next: 0 }, { held: noInputs(), next: 0 }],
  };
  showBanner(match, BRAND.round(1));
  return match;
}

/** Advances the match's LCG and returns a number in [0, 1). */
export function nextRandom(match: Match): number {
  match.rng = (Math.imul(match.rng, 1664525) + 1013904223) >>> 0;
  return match.rng / 4294967296;
}

export function showBanner(match: Match, text: string, sub?: string, life = BANNER_LIFE): void {
  const banner: Banner = { text, t: 0, life };
  if (sub !== undefined) banner.sub = sub;
  match.banner = banner;
}

function setPhase(match: Match, phase: Phase): void {
  match.phase = phase;
  match.phaseT = 0;
}

/** The move a reference names: one of the table's, or an ability's own animation or its held one. */
export function moveOf(match: Match, i: 0 | 1, ref: MoveRef): Move {
  const table = match.tables[i];
  if (ref.startsWith('ability')) return table.kit.abilities[Number(ref.slice(7))]!.move;
  if (ref.startsWith('cast')) return table.kit.abilities[Number(ref.slice(4))]!.hold;
  return table.moves[ref as keyof typeof table.moves];
}

export function abilityOf(match: Match, i: 0 | 1, n: number): ResolvedAbility {
  return match.tables[i].kit.abilities[n]!;
}

/** Starts a move from its first frame. */
function play(f: Fighter, state: FighterState, move: MoveRef): void {
  f.state = state;
  f.move = move;
  f.t = 0;
  f.hitDone = false;
}

function other(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
}

function durationOf(match: Match, i: 0 | 1): number {
  const f = match.fighters[i];
  return variationOf(moveOf(match, i, f.move), f.variation).duration;
}

/** Can this fighter start a new action this tick? */
export function actionable(match: Match, i: 0 | 1): boolean {
  const f = match.fighters[i];
  switch (f.state) {
    case 'idle':
    case 'walk':
    case 'back':
    case 'hit':
      return true;
    case 'attack': {
      const move = moveOf(match, i, f.move);
      return f.t >= (move.hit?.recover ?? 1) * durationOf(match, i);
    }
    case 'ability': {
      // A buff or a blink does not hold the fighter; a strike does, until it is half played.
      const kind = abilityOf(match, i, f.ability).kind;
      if (kind === 'self' || kind === 'blink') return true;
      return f.t >= ABILITY_RECOVER * durationOf(match, i);
    }
    case 'dodge':
    case 'parry':
      return f.t >= DODGE_RECOVER * durationOf(match, i);
    default:
      return false;
  }
}

/** A target that cannot dodge, parry or block: stunned, down, in the air, fleeing or dazed. */
function helpless(f: Fighter): boolean {
  return f.airborne || f.state === 'stun' || f.state === 'knockdown' || f.state === 'fear' || f.state === 'dazed' || f.state === 'death';
}

function text(match: Match, side: 0 | 1, kind: TextKind, words: string, from: 0 | 1 = side): void {
  const f = match.fighters[side];
  match.texts.push({ x: f.x, z: 2.3 + f.z, text: words, kind, side, from, t: 0, life: kind === 'info' ? INFO_LIFE : TEXT_LIFE });
}

function spark(match: Match, x: number, z: number, kind: SparkKind): void {
  match.sparks.push({ x, z, kind, t: 0, life: SPARK_LIFE });
}

function cancelCast(f: Fighter): void {
  if (!f.cast) return;
  f.cast = undefined;
  if (f.state === 'cast') play(f, 'idle', 'idle');
}

/** Is the target in front of `f` within `range` (or within it on either side when `both`), and near the ground? */
function inReach(f: Fighter, o: Fighter, range: number, both: boolean): boolean {
  if (Math.abs(o.z - f.z) >= 1.2) return false;
  const ahead = f.facing * (o.x - f.x);
  return both ? Math.abs(ahead) <= range : ahead > 0 && ahead <= range;
}

/** Why an ability cannot be used right now, or undefined when it can. */
export function abilityBlocked(match: Match, i: 0 | 1, n: number): string | undefined {
  const f = match.fighters[i];
  const o = match.fighters[other(i)];
  const a = abilityOf(match, i, n);
  const kit = match.tables[i].kit;
  if (f.cooldowns[n]! > 0) return 'NOT READY';
  if (f.resource < a.cost) return `NOT ENOUGH ${RESOURCE_NAMES[kit.resource]}`;
  if (a.cast > 0 && f.lockoutT > 0) return 'LOCKED OUT';
  if (a.execute && o.hp > HP * EXECUTE_BELOW && !(match.phase === 'finish' && o.state === 'dazed')) return 'NEEDS 20% HEALTH';
  const dist = Math.abs(o.x - f.x);
  switch (a.kind) {
    case 'melee':
      if (!inReach(f, o, a.range, a.both)) return 'OUT OF RANGE';
      return undefined;
    case 'spell':
    case 'bolt':
      if (dist > a.range) return 'OUT OF RANGE';
      return undefined;
    case 'charge':
      if (dist > a.range) return 'OUT OF RANGE';
      if (dist < a.minRange) return 'TOO CLOSE';
      return undefined;
    default:
      return undefined;
  }
}

/** The ability's effects on the caster: a heal, a shield, evasion. */
function applySelf(match: Match, i: 0 | 1, a: ResolvedAbility): void {
  const f = match.fighters[i];
  if (a.heal > 0) heal(match, i, a.heal);
  if (a.absorb > 0) {
    f.absorb = a.absorb;
    f.absorbT = ABSORB_FRAMES;
    text(match, i, 'absorb', 'SHIELDED');
  }
  if (a.evasion > 0) {
    f.evasionT = a.evasion;
    text(match, i, 'status', 'EVASION');
  }
}

function heal(match: Match, i: 0 | 1, amount: number): void {
  const f = match.fighters[i];
  if (f.hp <= 0 || f.state === 'death') return;
  const healed = Math.min(HP - f.hp, amount);
  if (healed <= 0) return;
  f.hp += healed;
  text(match, i, 'heal', `+${healed}`);
}

/** Fires an ability that reaches its target the moment it goes: an instant spell, a bolt's launch, a self buff. */
function fire(match: Match, i: 0 | 1, n: number): void {
  const f = match.fighters[i];
  const ti = other(i);
  const o = match.fighters[ti];
  const a = abilityOf(match, i, n);
  switch (a.kind) {
    case 'spell':
      if (Math.abs(o.x - f.x) > a.range + REACH_SLACK) return;
      strike(match, i, ti, { damage: a.damage, roll: 'spell', ability: a, pushback: PUSHBACK.spell, hitstop: a.damage > 0 ? 4 : 0 }, f.facing, o.x, 1.3 + o.z);
      return;
    case 'self':
      applySelf(match, i, a);
      return;
    default:
      return;
  }
}

function launch(match: Match, i: 0 | 1, ability: number, damage: number): void {
  const f = match.fighters[i];
  const shot = ability < 0;
  match.projectiles.push({
    x: f.x + f.facing * 0.8,
    z: PROJECTILE_Z,
    vx: f.facing * (shot ? PROJECTILE_SPEED.shot : PROJECTILE_SPEED.bolt),
    owner: i,
    t: 0,
    ability,
    damage,
  });
}

/** Tries to use ability `n`; true when it started. A refused press says why over the fighter. */
export function useAbility(match: Match, i: 0 | 1, n: number): boolean {
  const f = match.fighters[i];
  const o = match.fighters[other(i)];
  const a = abilityOf(match, i, n);
  if (a.gcd && f.gcd > 0) return false;
  const why = abilityBlocked(match, i, n);
  if (why) {
    text(match, i, 'info', why);
    return false;
  }
  if (a.gcd) f.gcd = GCD_FRAMES;
  f.ability = n;
  f.queued = false;
  // A cast pays its cost and starts its cooldown only when it goes off.
  if (a.cast > 0) {
    f.cast = { ability: n, t: 0, total: a.cast };
    play(f, 'cast', `cast${n as SlotIndex}`);
    return true;
  }
  f.cooldowns[n] = a.cooldown;
  f.resource -= a.cost;
  const ref: MoveRef = `ability${n as SlotIndex}`;
  switch (a.kind) {
    case 'melee':
      play(f, 'ability', ref);
      return true;
    case 'bolt':
      play(f, 'ability', ref);
      return true;
    case 'spell':
    case 'self':
      play(f, 'ability', ref);
      f.hitDone = true;
      fire(match, i, n);
      return true;
    case 'charge':
    case 'rush':
      f.dash = { ability: n, t: 0, fromX: f.x };
      play(f, 'dash', `cast${n as SlotIndex}`);
      return true;
    case 'blink': {
      const away = o.x >= f.x ? -1 : 1;
      f.x = Math.min(HALF, Math.max(-HALF, f.x + away * BLINK_DISTANCE));
      f.vx = 0;
      play(f, 'ability', ref);
      f.hitDone = true;
      text(match, i, 'status', a.name.toUpperCase());
      return true;
    }
    case 'leap': {
      const away = o.x >= f.x ? -1 : 1;
      f.airborne = true;
      f.vz = LEAP_V;
      f.airVx = away * LEAP_VX;
      play(f, 'jump', 'jumpStart');
      return true;
    }
  }
}

/** Frames an ability press is kept when the fighter cannot act yet. */
const BUFFER_FRAMES = 8;

/**
 * The keys that must not be lost while the fighter is frozen or mid-move: the attack key, held or
 * tapped, and an ability press, kept for a few frames until the fighter can act.
 */
function readKeys(f: Fighter, inputs: Inputs): void {
  // The attack key: held keeps the auto-attack on; a tap queues one swing.
  const tap = inputs.attack && !f.attackWas;
  f.attackWas = inputs.attack;
  f.auto = inputs.attack;
  if (tap) {
    f.queued = true;
    f.attackSaid = false;
  }
  const pressed = inputs.abilities.findIndex(Boolean);
  if (pressed >= 0) {
    f.buffered = pressed;
    f.bufferedT = BUFFER_FRAMES;
  } else if (f.bufferedT > 0 && --f.bufferedT === 0) {
    f.buffered = -1;
  }
}

function applyInputs(match: Match, i: 0 | 1, inputs: Inputs): void {
  const f = match.fighters[i];
  const o = match.fighters[other(i)];
  const table = match.tables[i];
  const dir = (inputs.right ? 1 : 0) - (inputs.left ? 1 : 0);
  // Moving or jumping cancels a cast.
  if (f.cast && f.state === 'cast' && (dir !== 0 || inputs.jump)) cancelCast(f);
  if (!actionable(match, i)) return;

  // The buffered ability press goes first.
  if (f.buffered >= 0) {
    const n = f.buffered;
    f.buffered = -1;
    f.bufferedT = 0;
    if (useAbility(match, i, n)) return;
  }
  // The auto-attack goes when its timer is up and the target is in reach.
  if ((f.auto || f.queued) && f.swingT === 0) {
    if (inReach(f, o, table.weapon.range, false)) {
      f.variation++;
      play(f, 'attack', 'swing');
      f.swingT = table.weapon.speed;
      f.queued = false;
      return;
    }
    // A press that cannot reach says so, as the game does, the moment it is pressed.
    if (f.queued && inputs.attack && !f.attackSaid) {
      f.attackSaid = true;
      text(match, i, 'info', 'OUT OF RANGE');
    }
  }
  if (inputs.jump && !f.airborne) {
    play(f, 'jump', 'jumpStart');
    f.airborne = true;
    f.vz = JUMP_V;
    return;
  }
  if (dir !== 0) {
    const forward = dir * f.facing > 0;
    const wanted: MoveRef = forward ? 'walk' : 'back';
    if (f.move !== wanted || f.state !== wanted) play(f, wanted, wanted);
    f.x += dir * (forward ? WALK : BACK) * (f.slowT > 0 ? SLOW_FACTOR : 1);
    return;
  }
  // Holding the attack with nowhere else to go follows the target into reach, as the game's follow does.
  if (f.auto && !table.weapon.ranged && !inReach(f, o, table.weapon.range, false) && Math.abs(o.z - f.z) < 1.2 && o.state !== 'death') {
    if (f.move !== 'walk' || f.state !== 'walk') play(f, 'walk', 'walk');
    f.x += f.facing * WALK * (f.slowT > 0 ? SLOW_FACTOR : 1);
    return;
  }
  // A move past its recover point plays out unless something else is asked for.
  if (f.state !== 'idle' && f.state !== 'attack' && f.state !== 'ability' && f.state !== 'hit' && f.state !== 'dodge' && f.state !== 'parry') play(f, 'idle', 'idle');
}

/** Advances the move clock and handles what happens when a move ends. */
function advanceMove(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  const move = moveOf(match, i, f.move);
  const duration = variationOf(move, f.variation).duration;
  f.t += TICK_MS * match.slowmo;
  if (f.t < duration) return;
  if (move.loop) {
    f.t = duration > 0 ? f.t % duration : 0;
    return;
  }
  switch (f.move) {
    case 'jumpStart':
      play(f, 'jump', 'jump');
      return;
    case 'knockdown':
      // Held on the last frame (poseOf clamps); up again after at least 30 frames down.
      if (f.t >= Math.max(duration, KNOCKDOWN_FRAMES * TICK_MS)) play(f, 'idle', 'idle');
      return;
    case 'death':
    case 'finisher':
    case 'win':
      f.t = duration;
      return;
    default:
      if (f.state === 'stun' || f.state === 'fear') {
        f.t = duration;
        return;
      }
      play(f, 'idle', 'idle');
  }
}

/** Timers that run whatever the fighter is doing: cooldowns, the swing timer, regeneration, the status effects. */
function timers(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  const kit = match.tables[i].kit;
  if (f.gcd > 0) f.gcd--;
  for (let n = 0; n < ABILITY_SLOTS; n++) if (f.cooldowns[n]! > 0) f.cooldowns[n]!--;
  if (f.swingT > 0) f.swingT--;
  if (f.slowT > 0) f.slowT--;
  if (f.evasionT > 0) f.evasionT--;
  if (f.riposteT > 0) f.riposteT--;
  if (f.lockoutT > 0) f.lockoutT--;
  if (f.absorbT > 0 && --f.absorbT === 0) f.absorb = 0;
  if (f.state === 'death' || f.state === 'dazed') return;
  if (kit.regen > 0) f.resource = Math.min(MAX_RESOURCE, f.resource + kit.regen);
  if (f.stunT > 0 && --f.stunT === 0 && f.state === 'stun') play(f, 'idle', 'idle');
  if (f.fearT > 0 && --f.fearT === 0 && f.state === 'fear') play(f, 'idle', 'idle');
  // A feared fighter runs from the opponent.
  if (f.state === 'fear' && !f.airborne) f.x += f.facing * WALK * 0.9;
  // The cast bar fills; at the end the spell goes.
  if (f.cast && f.state === 'cast') {
    f.cast.t++;
    if (f.cast.t >= f.cast.total) completeCast(match, i);
  }
  // Damage over time ticks.
  for (let k = f.dots.length - 1; k >= 0; k--) {
    const dot = f.dots[k]!;
    if (--dot.nextTick > 0) continue;
    dot.nextTick = DOT_TICK_FRAMES;
    dot.ticksLeft--;
    if (f.hp > 0) {
      damage(match, dot.source, i, dot.damage, 'dot');
      spark(match, f.x, 1.4 + f.z, 'dot');
    }
    if (dot.ticksLeft <= 0) f.dots.splice(k, 1);
  }
}

function completeCast(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  const cast = f.cast!;
  const n = cast.ability;
  const a = abilityOf(match, i, n);
  f.cast = undefined;
  if (f.resource < a.cost) {
    text(match, i, 'info', `NOT ENOUGH ${RESOURCE_NAMES[match.tables[i].kit.resource]}`);
    play(f, 'idle', 'idle');
    return;
  }
  f.resource -= a.cost;
  f.cooldowns[n] = a.cooldown;
  f.ability = n;
  play(f, 'ability', `ability${n as SlotIndex}`);
  if (a.kind !== 'bolt') {
    f.hitDone = true;
    fire(match, i, n);
  }
}

/** The charge or rush in flight: it runs at the target and lands on arrival. */
function dashes(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  if (f.state !== 'dash' || !f.dash) return;
  const ti = other(i);
  const o = match.fighters[ti];
  const a = abilityOf(match, i, f.dash.ability);
  f.dash.t++;
  const toward: 1 | -1 = o.x >= f.x ? 1 : -1;
  f.facing = toward;
  f.x += toward * DASH_SPEED;
  let arrived: boolean;
  if (a.kind === 'rush') arrived = Math.abs(f.x - f.dash.fromX) >= a.range || f.dash.t >= DASH_LIMIT;
  else arrived = Math.abs(o.x - f.x) <= DASH_STOP || f.dash.t >= DASH_LIMIT;
  if (Math.abs(f.x) >= HALF) arrived = true;
  if (!arrived) return;
  const n = f.dash.ability;
  f.dash = undefined;
  play(f, 'ability', `ability${n as SlotIndex}`);
  f.hitDone = true;
  if (inReach(f, o, ABILITY_MELEE_RANGE, true)) {
    strike(match, i, ti, { damage: a.damage, roll: 'none', ability: a, pushback: PUSHBACK.charge, hitstop: 6 }, toward, o.x, 1.3 + o.z);
  }
}

type Roll = 'melee' | 'ranged' | 'spell' | 'none';
type Outcome = 'miss' | 'dodge' | 'parry' | 'block' | 'crit' | 'hit';

interface Blow {
  damage: number;
  roll: Roll;
  /** Undefined for an auto-attack. */
  ability: ResolvedAbility | undefined;
  pushback: number;
  hitstop: number;
}

/** One draw on the hit table. */
export function rollHit(match: Match, ai: 0 | 1, ti: 0 | 1, roll: Roll): Outcome {
  if (roll === 'none') return 'hit';
  const attacker = match.fighters[ai];
  const target = match.fighters[ti];
  const r = nextRandom(match);
  let edge = 0;
  const step = (chance: number): boolean => {
    edge += chance;
    return r < edge;
  };
  if (roll === 'spell') {
    if (step(HIT_TABLE.spellMiss)) return 'miss';
    if (step(HIT_TABLE.crit)) return 'crit';
    return 'hit';
  }
  if (step(HIT_TABLE.miss)) return 'miss';
  const canAvoid = !helpless(target) && target.state !== 'cast';
  if (canAvoid) {
    if (step(HIT_TABLE.dodge + (target.evasionT > 0 ? HIT_TABLE.evasion : 0))) return 'dodge';
    const facingAttacker = target.facing * (attacker.x - target.x) >= 0;
    if (roll === 'melee' && facingAttacker) {
      if (step(HIT_TABLE.parry)) return 'parry';
      if (match.tables[ti].weapon.shield && step(HIT_TABLE.block)) return 'block';
    }
  }
  if (step(HIT_TABLE.crit)) return 'crit';
  return 'hit';
}

/**
 * Takes `amount` off `ti`'s health (the shield first), shows the number and flinches them.
 * A blow interrupts a cast and breaks a fear. Returns what reached their health.
 */
function damage(match: Match, ai: 0 | 1, ti: 0 | 1, amount: number, kind: 'damage' | 'crit' | 'dot' | 'block'): number {
  const target = match.fighters[ti];
  const attacker = match.fighters[ai];
  if (target.state === 'death') return 0;
  let left = amount;
  if (target.absorb > 0 && left > 0) {
    const absorbed = Math.min(target.absorb, left);
    target.absorb -= absorbed;
    left -= absorbed;
    if (target.absorb === 0) target.absorbT = 0;
    text(match, ti, 'absorb', `ABSORB ${absorbed}`, ai);
  }
  if (left > 0) {
    target.hp = Math.max(0, target.hp - left);
    target.tookDamage = true;
    text(match, ti, kind, kind === 'block' ? `BLOCK ${left}` : String(left), ai);
    if (match.tables[ti].kit.resource === 'rage') target.resource = Math.min(MAX_RESOURCE, target.resource + RAGE_ON_HIT);
  }
  if (kind === 'dot') return left;
  if (target.cast) cancelCast(target);
  if (target.state === 'fear') {
    target.fearT = 0;
    play(target, 'idle', 'idle');
  }
  // The wound shows on every blow that lands, unless the target is mid-ability or still has a swing to land.
  const flinches = target.state === 'idle' || target.state === 'walk' || target.state === 'back' || target.state === 'hit' || target.state === 'dodge' || target.state === 'parry'
    || (target.state === 'attack' && target.hitDone);
  if (left > 0 && flinches) play(target, 'hit', kind === 'crit' ? 'crit' : 'hit');
  void attacker;
  return left;
}

function stun(match: Match, ti: 0 | 1, frames: number): void {
  const target = match.fighters[ti];
  if (target.state === 'death') return;
  if (target.state === 'dazed') {
    text(match, ti, 'immune', 'IMMUNE', other(ti));
    return;
  }
  target.stunT = Math.max(target.stunT, frames);
  cancelCast(target);
  target.dash = undefined;
  target.fearT = 0;
  if (target.airborne) {
    target.knockdownOnLand = true;
  } else {
    play(target, 'stun', 'dazed');
  }
  text(match, ti, 'status', 'STUNNED', other(ti));
}

function fear(match: Match, ti: 0 | 1, frames: number): void {
  const target = match.fighters[ti];
  if (target.state === 'death') return;
  if (target.state === 'dazed' || target.state === 'stun') {
    text(match, ti, 'immune', 'IMMUNE', other(ti));
    return;
  }
  target.fearT = frames;
  cancelCast(target);
  target.dash = undefined;
  play(target, 'fear', 'walk');
  text(match, ti, 'status', 'FEARED', other(ti));
}

/**
 * A blow from `ai` reaches `ti`: rolled on the hit table, then its damage and the ability's effects.
 * In the finish phase an ability on the dazed loser is the fatality; an auto-attack just drops them.
 */
function strike(match: Match, ai: 0 | 1, ti: 0 | 1, blow: Blow, dir: number, sparkX: number, sparkZ: number): number {
  const attacker = match.fighters[ai];
  const target = match.fighters[ti];
  if (target.state === 'death') return 0;
  const a = blow.ability;

  if (match.phase === 'finish' && target.state === 'dazed') {
    target.hp = 0;
    target.tookDamage = true;
    target.vx = dir * blow.pushback;
    play(target, 'death', 'death');
    spark(match, sparkX, sparkZ, a ? 'crit' : 'hit');
    if (a) {
      play(attacker, 'finisher', 'finisher');
      showBanner(match, BRAND.fatality, undefined, KO_SLOWMO.frames + BANNER_LIFE);
    } else {
      showBanner(match, BRAND.ko, undefined, KO_SLOWMO.frames + BANNER_LIFE);
    }
    knockout(match, ai);
    return blow.damage;
  }

  let outcome = rollHit(match, ai, ti, blow.roll);
  // The riposte: the next melee ability after a parry cannot fail.
  if (a && a.kind === 'melee' && attacker.riposteT > 0) {
    outcome = 'crit';
    attacker.riposteT = 0;
  }
  switch (outcome) {
    case 'miss':
      text(match, ti, 'miss', 'MISS', ai);
      return 0;
    case 'dodge':
      text(match, ti, 'dodge', 'DODGE', ai);
      if (target.state !== 'attack' && target.state !== 'ability') play(target, 'dodge', 'dodge');
      return 0;
    case 'parry':
      text(match, ti, 'parry', 'PARRY', ai);
      if (target.state !== 'attack' && target.state !== 'ability') play(target, 'parry', 'parry');
      target.riposteT = RIPOSTE_FRAMES;
      attacker.hitstop = Math.max(attacker.hitstop, 4);
      spark(match, sparkX, sparkZ, 'parry');
      return 0;
    default:
      break;
  }

  let amount = blow.damage;
  let kind: 'damage' | 'crit' | 'block' = 'damage';
  if (outcome === 'crit') {
    amount = Math.round(amount * CRIT_FACTOR);
    kind = 'crit';
  } else if (outcome === 'block') {
    amount = Math.round(amount * BLOCK_FACTOR);
    kind = 'block';
  }
  const wasCasting = target.cast !== undefined;
  if (amount > 0) {
    target.vx = dir * blow.pushback * (outcome === 'block' ? 0.5 : 1);
    const stop = blow.hitstop + (outcome === 'crit' ? 6 : 0);
    target.hitstop = Math.max(target.hitstop, stop);
    attacker.hitstop = Math.max(attacker.hitstop, stop);
    spark(match, sparkX, sparkZ, outcome === 'block' ? 'block' : outcome === 'crit' ? 'crit' : blow.roll === 'spell' ? 'spell' : 'hit');
    if (target.airborne) target.knockdownOnLand = true;
    damage(match, ai, ti, amount, kind);
  }

  // What the hit earns the attacker.
  const kit = match.tables[ai].kit;
  if (kit.resource === 'rage' || kit.resource === 'fury' || kit.resource === 'runic') {
    let gain = a ? a.gain : 0;
    if (!a && blow.roll === 'melee') {
      const w = match.tables[ai].weapon.wielding;
      gain = w === 'twoHand' || w === 'long' ? GAIN_ON_SWING.twoHand : GAIN_ON_SWING.oneHand;
    }
    if (gain > 0) attacker.resource = Math.min(MAX_RESOURCE, attacker.resource + gain);
  }
  if (!a) return amount;

  // The ability's effects.
  if (a.interrupt && wasCasting) {
    cancelCast(target);
    target.lockoutT = LOCKOUT_FRAMES;
    text(match, ti, 'status', 'INTERRUPTED', ai);
  }
  if (a.stun > 0) stun(match, ti, a.stun);
  if (a.fear > 0) fear(match, ti, a.fear);
  if (a.slow > 0) {
    target.slowT = Math.max(target.slowT, a.slow);
    text(match, ti, 'status', 'SLOWED', ai);
  }
  if (a.dot) {
    const existing = target.dots.find((d) => d.name === a.id);
    if (existing) {
      existing.ticksLeft = a.dot.ticks;
      existing.nextTick = DOT_TICK_FRAMES;
    } else {
      target.dots.push({ name: a.id, damage: a.dot.damage, ticksLeft: a.dot.ticks, nextTick: DOT_TICK_FRAMES, source: ai });
    }
    if (amount === 0) text(match, ti, 'status', a.short, ai);
  }
  if (a.heal > 0 && a.kind !== 'self') heal(match, ai, a.heal);
  return amount;
}

/** The knockout: slow motion, the round goes to `winner`. */
function knockout(match: Match, winner: 0 | 1): void {
  match.roundWinner = winner;
  match.fighters[winner].wins++;
  match.slowmo = KO_SLOWMO.rate;
  match.projectiles.length = 0;
  setPhase(match, 'ko');
}

/** Swings and ability animations reaching their window. */
function attacks(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  if (f.hitDone || f.hitstop > 0) return;
  if (f.state !== 'attack' && f.state !== 'ability') return;
  const ti = other(i);
  const target = match.fighters[ti];
  const table = match.tables[i];
  const at = f.t / durationOf(match, i);

  if (f.state === 'attack') {
    const hit = moveOf(match, i, f.move).hit;
    if (!hit || at < hit.from) return;
    if (table.weapon.ranged) {
      f.hitDone = true;
      launch(match, i, -1, table.weapon.damage);
      return;
    }
    if (at > hit.to) {
      f.hitDone = true;
      return;
    }
    if (!inReach(f, target, table.weapon.range + REACH_SLACK, false)) return;
    f.hitDone = true;
    strike(match, i, ti, { damage: table.weapon.damage, roll: 'melee', ability: undefined, pushback: PUSHBACK.swing, hitstop: 8 }, f.facing, target.x - f.facing * 0.3, 1.3 + target.z);
    return;
  }

  const a = abilityOf(match, i, f.ability);
  if (a.kind === 'bolt') {
    if (at < BOLT_AT) return;
    f.hitDone = true;
    launch(match, i, f.ability, a.damage);
    return;
  }
  if (a.kind !== 'melee') {
    f.hitDone = true;
    return;
  }
  if (at < ABILITY_HIT.from) return;
  if (at > ABILITY_HIT.to) {
    f.hitDone = true;
    return;
  }
  if (!inReach(f, target, a.range + REACH_SLACK, a.both)) return;
  f.hitDone = true;
  const dir = target.x >= f.x ? 1 : -1;
  strike(match, i, ti, { damage: a.damage, roll: 'melee', ability: a, pushback: PUSHBACK.ability, hitstop: 12 }, dir, target.x - dir * 0.3, 1.3 + target.z);
}

function projectiles(match: Match): void {
  const alive: Projectile[] = [];
  for (const p of match.projectiles) {
    p.x += p.vx * match.slowmo;
    p.t++;
    const ti = other(p.owner);
    const target = match.fighters[ti];
    let gone = Math.abs(p.x) > HALF + 1;
    if (!gone && target.state !== 'death' && Math.abs(target.x - p.x) < 0.7 && target.z < 1.0) {
      const a = p.ability >= 0 ? abilityOf(match, p.owner, p.ability) : undefined;
      const dir = Math.sign(p.vx) || 1;
      strike(match, p.owner, ti, { damage: p.damage, roll: a ? 'spell' : 'ranged', ability: a, pushback: a ? PUSHBACK.bolt : PUSHBACK.spell, hitstop: 5 }, dir, p.x, p.z);
      gone = true;
    }
    if (!gone) alive.push(p);
  }
  match.projectiles = alive;
}

function physics(match: Match): void {
  const [a, b] = match.fighters;
  for (let i = 0 as 0 | 1; i < 2; i++) {
    const f = match.fighters[i];
    if (f.hitstop > 0) continue;
    // Pushback.
    f.x += f.vx * match.slowmo;
    f.vx *= 0.82;
    if (Math.abs(f.vx) < 0.001) f.vx = 0;
    // Gravity, and the leap's carry.
    if (f.airborne) {
      f.x += f.airVx * match.slowmo;
      f.z += f.vz * match.slowmo;
      f.vz -= GRAVITY * match.slowmo;
      if (f.z <= 0) {
        f.z = 0;
        f.vz = 0;
        f.airVx = 0;
        f.airborne = false;
        if (f.knockdownOnLand) {
          f.knockdownOnLand = false;
          if (f.stunT > 0) play(f, 'stun', 'dazed');
          else play(f, 'knockdown', 'knockdown');
        } else if (f.state === 'jump') {
          play(f, 'idle', 'jumpEnd');
        }
      }
    }
  }
  // Walls.
  for (const f of match.fighters) f.x = Math.min(HALF, Math.max(-HALF, f.x));
  // Bodies do not overlap: the one in the corner stays, the other gives way.
  const gap = Math.abs(a.x - b.x);
  if (gap < BODY) {
    const push = (BODY - gap) / 2;
    const left = a.x <= b.x ? a : b;
    const right = left === a ? b : a;
    const leftWall = left.x - push < -HALF;
    const rightWall = right.x + push > HALF;
    if (leftWall && !rightWall) right.x = left.x + BODY;
    else if (rightWall && !leftWall) left.x = right.x - BODY;
    else {
      left.x -= push;
      right.x += push;
    }
    for (const f of match.fighters) f.x = Math.min(HALF, Math.max(-HALF, f.x));
  }
  // Grounded fighters face each other; a feared one faces away.
  for (let i = 0 as 0 | 1; i < 2; i++) {
    const f = match.fighters[i];
    const o = match.fighters[other(i)];
    if (f.airborne || f.hitstop > 0) continue;
    if (f.state === 'death' || f.state === 'dazed' || f.state === 'knockdown' || f.state === 'stun' || f.state === 'dash') continue;
    const toward: 1 | -1 = o.x > f.x ? 1 : o.x < f.x ? -1 : f.facing;
    f.facing = f.state === 'fear' ? (toward === 1 ? -1 : 1) : toward;
  }
}

/** hp 0 in the fight phase: the loser is dazed, the winner has FINISH_FRAMES to finish them. */
function checkFinish(match: Match): void {
  if (match.phase !== 'fight') return;
  const [a, b] = match.fighters;
  if (a.hp > 0 && b.hp > 0) return;
  const loser: 0 | 1 = a.hp <= 0 && b.hp <= 0 ? (a.hp < b.hp ? 0 : 1) : a.hp <= 0 ? 0 : 1;
  const winner = other(loser);
  const l = match.fighters[loser];
  l.hp = 0;
  l.z = 0;
  l.vz = 0;
  l.airVx = 0;
  l.airborne = false;
  l.knockdownOnLand = false;
  l.hitstop = 0;
  l.cast = undefined;
  l.dash = undefined;
  l.dots.length = 0;
  l.stunT = 0;
  l.fearT = 0;
  play(l, 'dazed', 'dazed');
  const w = match.fighters[winner];
  w.hitstop = 0;
  w.dots.length = 0;
  w.stunT = 0;
  w.fearT = 0;
  if (w.state === 'stun' || w.state === 'fear') play(w, 'idle', 'idle');
  match.projectiles.length = 0;
  match.roundWinner = winner;
  setPhase(match, 'finish');
  showBanner(match, BRAND.finish, undefined, FINISH_FRAMES);
}

/** The timer ran out: the higher hp wins; a tie goes to nobody and the round is fought again. */
function timeout(match: Match): void {
  const [a, b] = match.fighters;
  if (a.hp === b.hp) {
    match.roundWinner = undefined;
    setPhase(match, 'roundEnd');
    return;
  }
  const winner: 0 | 1 = a.hp > b.hp ? 0 : 1;
  const loser = other(winner);
  play(match.fighters[loser], 'death', 'death');
  match.projectiles.length = 0;
  knockout(match, winner);
}

function endRound(match: Match): void {
  const winner = match.roundWinner;
  match.slowmo = 1;
  setPhase(match, 'roundEnd');
  if (winner === undefined) return;
  const w = match.fighters[winner];
  w.hitstop = 0;
  w.cast = undefined;
  w.dash = undefined;
  play(w, 'win', 'win');
  const flawless = !w.tookDamage;
  showBanner(match, BRAND.roundWin(match.names[winner]), flawless ? BRAND.flawless : undefined, ROUND_END_FRAMES);
}

function nextRoundOrMatch(match: Match): void {
  const winner = match.roundWinner;
  if (winner !== undefined && match.fighters[winner].wins >= ROUNDS_TO_WIN) {
    match.winner = winner;
    setPhase(match, 'matchEnd');
    showBanner(match, BRAND.matchWin(match.names[winner]), undefined, Number.POSITIVE_INFINITY);
    return;
  }
  match.round++;
  resetRound(match);
}

function phases(match: Match): void {
  switch (match.phase) {
    case 'intro':
      if (match.phaseT === INTRO_FRAMES - 60) showBanner(match, BRAND.fight, undefined, 60);
      if (match.phaseT >= INTRO_FRAMES) {
        setPhase(match, 'fight');
        for (const f of match.fighters) if (f.state === 'intro') play(f, 'idle', 'idle');
      }
      return;
    case 'fight':
      if (match.timer > 0) match.timer--;
      if (match.timer === 0) timeout(match);
      return;
    case 'finish':
      if (match.phaseT >= FINISH_FRAMES) {
        const winner = match.roundWinner ?? 0;
        const loser = match.fighters[other(winner)];
        play(loser, 'death', 'death');
        showBanner(match, BRAND.ko, undefined, KO_SLOWMO.frames + BANNER_LIFE);
        knockout(match, winner);
      }
      return;
    case 'ko':
      if (match.phaseT >= KO_SLOWMO.frames) endRound(match);
      return;
    case 'roundEnd':
      if (match.phaseT >= ROUND_END_FRAMES) nextRoundOrMatch(match);
      return;
    case 'matchEnd':
      return;
  }
}

/** One 60 Hz step. Mutates `match` deterministically from its state and the two players' inputs. */
export function tick(match: Match, inputs: [Inputs, Inputs]): void {
  // (1) Phases.
  phases(match);
  const acting = match.phase === 'fight' || match.phase === 'finish';

  for (let i = 0 as 0 | 1; i < 2; i++) {
    const f = match.fighters[i];
    // (2) Cooldowns, the swing timer, regeneration, casts and the status effects run on.
    if (acting) timers(match, i);
    // (3) The attack key and ability presses are read even when frozen, so a tap is never lost.
    readKeys(f, acting ? inputs[i] : NO_INPUTS);
    // Hitstop freezes the fighter.
    if (f.hitstop > 0) {
      f.hitstop--;
      continue;
    }
    // (4) Inputs only while fighting.
    applyInputs(match, i, acting ? inputs[i] : NO_INPUTS);
    // (5) Move clock and transitions.
    advanceMove(match, i);
  }

  // (6) Physics.
  physics(match);

  if (acting) {
    // (7) Dashes arrive, swings and abilities connect, bolts leave the hand.
    for (let i = 0 as 0 | 1; i < 2; i++) {
      dashes(match, i);
      attacks(match, i);
    }
    // (8) Projectiles fly.
    projectiles(match);
  } else {
    match.projectiles.length = 0;
  }

  // (9) hp 0 opens the finish.
  checkFinish(match);

  // (10) Bookkeeping.
  for (let k = match.sparks.length - 1; k >= 0; k--) {
    const s = match.sparks[k]!;
    s.t++;
    if (s.t >= s.life) match.sparks.splice(k, 1);
  }
  for (let k = match.texts.length - 1; k >= 0; k--) {
    const s = match.texts[k]!;
    s.t++;
    if (s.t >= s.life) match.texts.splice(k, 1);
  }
  for (const f of match.fighters) {
    f.shownHp += (f.hp - f.shownHp) * HP_EASE;
    if (Math.abs(f.shownHp - f.hp) < 0.05) f.shownHp = f.hp;
  }
  if (match.banner) {
    match.banner.t++;
    if (match.banner.t >= match.banner.life) match.banner = undefined;
  }
  match.phaseT++;
  match.frame++;
}

/** Seconds left on the round clock, for the HUD. */
export function secondsLeft(match: Match): number {
  return Math.ceil(match.timer / 60);
}

/** The move and time to pose fighter `i` with. */
export function poseOf(match: Match, i: 0 | 1): { sequence: number; time: number } {
  const f = match.fighters[i];
  const v = variationOf(moveOf(match, i, f.move), f.variation);
  return { sequence: v.sequence, time: Math.min(f.t, v.duration) };
}
