import { BRAND } from './brand';
import { type Move, type MoveName, type MoveTable, variationOf } from './moves';
import {
  BACK, BODY, FINISH_FRAMES, GRAVITY, HALF, HP, INTRO_FRAMES, JUMP_V, KO_SLOWMO, ROUND_END_FRAMES, ROUND_FRAMES,
  ROUNDS_TO_WIN, START_X, TICK_MS, WALK,
} from './stage';

/** What a fighter is doing, coarser than the move it plays. */
export type FighterState =
  | 'idle' | 'walk' | 'back' | 'jump' | 'attack' | 'block' | 'hit' | 'knockdown' | 'dazed' | 'death' | 'finisher' | 'intro' | 'win';

export interface Fighter {
  x: number;
  /** Height above the ground. */
  z: number;
  vz: number;
  /** Pushback speed along x, decaying every frame. */
  vx: number;
  /** +1 faces +X (screen right), -1 faces -X. */
  facing: 1 | -1;
  hp: number;
  /** Eases towards hp; the HUD's white trail. */
  shownHp: number;
  state: FighterState;
  /** The move being played and how far into it, in ms. */
  move: MoveName;
  t: number;
  /** The current attack has already connected (or spawned its projectile). */
  hitDone: boolean;
  /** Cycles the light attack's variations; counts up on every light thrown. */
  variation: number;
  /** Frames this fighter stands frozen. */
  hitstop: number;
  blocking: boolean;
  airborne: boolean;
  /** Rounds won. */
  wins: number;
  /** Frames until the special is available again. */
  cooldown: number;
  /** Took damage this round (a blocked hit does not count). */
  tookDamage: boolean;
  /** Hit while airborne: knocked down on landing. */
  knockdownOnLand: boolean;
  /** Heavies that have landed; every third one knocks down. */
  heavyLanded: number;
}

export interface Projectile {
  x: number;
  z: number;
  vx: number;
  owner: 0 | 1;
  /** Frames alive. */
  t: number;
}

export type SparkKind = 'hit' | 'block' | 'crit';

export interface Spark {
  x: number;
  z: number;
  kind: SparkKind;
  /** Frames alive; gone at `life`. */
  t: number;
  life: number;
}

export interface Inputs {
  left: boolean;
  right: boolean;
  /** Edge-triggered: true on the tick the button went down. */
  jump: boolean;
  /** Held. */
  block: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
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

export const NO_INPUTS: Readonly<Inputs> = Object.freeze({
  left: false, right: false, jump: false, block: false, light: false, heavy: false, special: false,
});

export function noInputs(): Inputs {
  return { ...NO_INPUTS };
}

const BANNER_LIFE = 90;
const SPARK_LIFE = 14;
const KNOCKDOWN_FRAMES = 30;
const PROJECTILE_SPEED = 0.14;
const PROJECTILE_Z = 1.25;
const HP_EASE = 0.08;

function newFighter(side: 0 | 1): Fighter {
  return {
    x: side === 0 ? -START_X : START_X,
    z: 0,
    vz: 0,
    vx: 0,
    facing: side === 0 ? 1 : -1,
    hp: HP,
    shownHp: HP,
    state: 'intro',
    move: 'intro',
    t: 0,
    hitDone: false,
    variation: 0,
    hitstop: 0,
    blocking: false,
    airborne: false,
    wins: 0,
    cooldown: 0,
    tookDamage: false,
    knockdownOnLand: false,
    heavyLanded: 0,
  };
}

/** Puts both fighters back on their marks for a new round, keeping their wins. */
function resetRound(match: Match): void {
  for (let i = 0 as 0 | 1; i < 2; i++) {
    const wins = match.fighters[i].wins;
    const fresh = newFighter(i);
    fresh.wins = wins;
    match.fighters[i] = fresh;
  }
  match.projectiles.length = 0;
  match.sparks.length = 0;
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
    fighters: [newFighter(0), newFighter(1)],
    projectiles: [],
    sparks: [],
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

function moveOf(match: Match, i: 0 | 1, name: MoveName): Move {
  return match.tables[i].moves[name];
}

/** Starts a move from its first frame. */
function play(f: Fighter, state: FighterState, move: MoveName): void {
  f.state = state;
  f.move = move;
  f.t = 0;
  f.hitDone = false;
  if (state !== 'block') f.blocking = false;
}

function other(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
}

/** Can this fighter start a new action this tick? */
function actionable(match: Match, i: 0 | 1): boolean {
  const f = match.fighters[i];
  switch (f.state) {
    case 'idle':
    case 'walk':
    case 'back':
    case 'block':
      return true;
    case 'attack': {
      const move = moveOf(match, i, f.move);
      const recover = move.hit?.recover ?? 1;
      return f.t >= recover * variationOf(move, f.variation).duration;
    }
    default:
      return false;
  }
}

function applyInputs(match: Match, i: 0 | 1, inputs: Inputs): void {
  const f = match.fighters[i];
  if (!actionable(match, i)) return;
  const table = match.tables[i];
  if (inputs.special && f.cooldown === 0) {
    play(f, 'attack', 'special');
    f.cooldown = table.moves.special.hit?.cooldown ?? 0;
    return;
  }
  if (inputs.heavy) {
    play(f, 'attack', 'heavy');
    return;
  }
  if (inputs.light) {
    f.variation++;
    play(f, 'attack', 'light');
    return;
  }
  if (inputs.jump && !f.airborne) {
    play(f, 'jump', 'jumpStart');
    f.airborne = true;
    f.vz = JUMP_V;
    return;
  }
  if (inputs.block) {
    if (f.state !== 'block') play(f, 'block', 'block');
    f.blocking = true;
    return;
  }
  const dir = (inputs.right ? 1 : 0) - (inputs.left ? 1 : 0);
  if (dir !== 0) {
    const forward = dir * f.facing > 0;
    const wanted: MoveName = forward ? 'walk' : 'back';
    if (f.move !== wanted || f.state === 'attack') play(f, wanted, wanted);
    f.x += dir * (forward ? WALK : BACK);
    return;
  }
  // An attack past its recover point plays out unless something else is asked for.
  if (f.state !== 'idle' && f.state !== 'attack') play(f, 'idle', 'idle');
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
    case 'block':
    case 'finisher':
    case 'win':
      f.t = duration;
      return;
    case 'intro':
    case 'light':
    case 'heavy':
    case 'special':
    case 'hit':
    case 'crit':
    case 'jumpEnd':
      play(f, 'idle', 'idle');
      return;
    default:
      f.t = duration;
  }
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
    // Gravity.
    if (f.airborne) {
      f.z += f.vz * match.slowmo;
      f.vz -= GRAVITY * match.slowmo;
      if (f.z <= 0) {
        f.z = 0;
        f.vz = 0;
        f.airborne = false;
        if (f.knockdownOnLand) {
          f.knockdownOnLand = false;
          play(f, 'knockdown', 'knockdown');
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
  // Grounded fighters face each other.
  for (let i = 0 as 0 | 1; i < 2; i++) {
    const f = match.fighters[i];
    const o = match.fighters[other(i)];
    if (f.airborne || f.hitstop > 0) continue;
    if (f.state === 'death' || f.state === 'dazed' || f.state === 'knockdown') continue;
    if (o.x > f.x) f.facing = 1;
    else if (o.x < f.x) f.facing = -1;
  }
}

function spark(match: Match, x: number, z: number, kind: SparkKind): void {
  match.sparks.push({ x, z, kind, t: 0, life: SPARK_LIFE });
}

/**
 * Something hit `ti`: a melee move of `ai` or their projectile. Returns the damage dealt (0 when blocked).
 * In the finish phase a heavy on the dazed loser is the fatality; anything else drops them.
 */
function land(match: Match, ai: 0 | 1, ti: 0 | 1, hit: { damage: number; pushback: number; hitstop: number; crit: boolean }, dir: number, sparkX: number, sparkZ: number): number {
  const attacker = match.fighters[ai];
  const target = match.fighters[ti];
  if (target.state === 'death') return 0;

  if (match.phase === 'finish' && target.state === 'dazed') {
    target.hp = 0;
    target.tookDamage = true;
    target.vx = dir * hit.pushback;
    play(target, 'death', 'death');
    spark(match, sparkX, sparkZ, hit.crit ? 'crit' : 'hit');
    if (hit.crit) {
      play(attacker, 'finisher', 'finisher');
      showBanner(match, BRAND.fatality, undefined, KO_SLOWMO.frames + BANNER_LIFE);
    } else {
      showBanner(match, BRAND.ko, undefined, KO_SLOWMO.frames + BANNER_LIFE);
    }
    knockout(match, ai);
    return hit.damage;
  }

  const facingAttacker = target.facing * (attacker.x - target.x) > 0 || attacker.x === target.x;
  if (target.blocking && !target.airborne && facingAttacker) {
    target.vx = dir * hit.pushback * 0.5;
    target.hitstop = Math.max(target.hitstop, 3);
    attacker.hitstop = Math.max(attacker.hitstop, 3);
    spark(match, sparkX, sparkZ, 'block');
    return 0;
  }

  target.hp = Math.max(0, target.hp - hit.damage);
  target.tookDamage = true;
  target.vx = dir * hit.pushback;
  target.hitstop = Math.max(target.hitstop, hit.hitstop);
  attacker.hitstop = Math.max(attacker.hitstop, hit.hitstop);
  let kind: SparkKind = 'hit';
  if (target.airborne) {
    target.knockdownOnLand = true;
    if (hit.crit) kind = 'crit';
  } else if (hit.crit) {
    attacker.heavyLanded++;
    kind = 'crit';
    if (attacker.heavyLanded % 3 === 0) play(target, 'knockdown', 'knockdown');
    else play(target, 'hit', 'crit');
  } else {
    play(target, 'hit', 'hit');
  }
  spark(match, sparkX, sparkZ, kind);
  return hit.damage;
}

/** The knockout: slow motion, the round goes to `winner`. */
function knockout(match: Match, winner: 0 | 1): void {
  match.roundWinner = winner;
  match.fighters[winner].wins++;
  match.slowmo = KO_SLOWMO.rate;
  match.projectiles.length = 0;
  setPhase(match, 'ko');
}

function attacks(match: Match, i: 0 | 1): void {
  const f = match.fighters[i];
  if (f.state !== 'attack' || f.hitDone || f.hitstop > 0) return;
  const move = moveOf(match, i, f.move);
  const hit = move.hit;
  if (!hit) return;
  const duration = variationOf(move, f.variation).duration;
  const at = f.t / duration;
  if (at < hit.from) return;
  if (hit.projectile) {
    f.hitDone = true;
    match.projectiles.push({ x: f.x + f.facing * 0.8, z: PROJECTILE_Z, vx: f.facing * PROJECTILE_SPEED, owner: i, t: 0 });
    return;
  }
  if (at > hit.to) {
    f.hitDone = true;
    return;
  }
  const ti = other(i);
  const target = match.fighters[ti];
  const ahead = f.facing * (target.x - f.x);
  if (!(ahead > 0 && ahead <= hit.range)) return;
  if (Math.abs(target.z - f.z) >= 1.2) return;
  f.hitDone = true;
  land(match, i, ti, hit, f.facing, target.x - f.facing * 0.3, 1.3 + target.z);
}

function projectiles(match: Match): void {
  const alive: Projectile[] = [];
  for (const p of match.projectiles) {
    p.x += p.vx * match.slowmo;
    p.t++;
    const ti = other(p.owner);
    const target = match.fighters[ti];
    const hit = match.tables[p.owner].moves.special.hit;
    let gone = Math.abs(p.x) > HALF + 1;
    if (!gone && hit && target.state !== 'death' && Math.abs(target.x - p.x) < 0.7 && target.z < 1.0) {
      land(match, p.owner, ti, hit, Math.sign(p.vx) || 1, p.x, p.z);
      gone = true;
    }
    if (!gone) alive.push(p);
  }
  match.projectiles = alive;
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
  l.airborne = false;
  l.knockdownOnLand = false;
  l.hitstop = 0;
  play(l, 'dazed', 'dazed');
  match.fighters[winner].hitstop = 0;
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
    if (f.cooldown > 0) f.cooldown--;
    // (3) Hitstop freezes the fighter.
    if (f.hitstop > 0) {
      f.hitstop--;
      continue;
    }
    // (2) Inputs only while fighting.
    applyInputs(match, i, acting ? inputs[i] : NO_INPUTS);
    // (4) Move clock and transitions.
    advanceMove(match, i);
  }

  // (5) Physics.
  physics(match);

  // (6) Attacks connect and specials spawn.
  if (acting) {
    for (let i = 0 as 0 | 1; i < 2; i++) attacks(match, i);
  }

  // (7) Projectiles fly.
  if (acting) projectiles(match);
  else match.projectiles.length = 0;

  // (8) hp 0 opens the finish.
  checkFinish(match);

  // (9) Bookkeeping.
  for (let k = match.sparks.length - 1; k >= 0; k--) {
    const s = match.sparks[k]!;
    s.t++;
    if (s.t >= s.life) match.sparks.splice(k, 1);
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
