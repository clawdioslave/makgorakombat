import { ABILITY_SLOTS, GCD_FRAMES, MAX_RESOURCE, RESOURCE_COLOURS, RESOURCE_NAMES, type ResourceKind } from './abilities';
import { abilityBlocked, type Match } from './engine';
import type { InputAction } from './input';
import { HP } from './stage';

/*
 * What a unit frame, an action bar or a cast bar needs to know about a fighter, read from the
 * match each frame: plain numbers and names, nothing of the engine's inner state. The DOM UI
 * over the canvas draws from this; so may any script reading `window.mk`.
 */

export interface AbilityView {
  /** 'charge', 'frostbolt' ...: the key for an icon. */
  id: string;
  name: string;
  short: string;
  /** The input action bound to the slot: 'ability1' .. 'ability3'. */
  action: InputAction;
  /** Frames left on its own cooldown, and the cooldown's length (0 when it has none). */
  cooldown: { remaining: number; total: number };
  /** Frames of global cooldown left that hold this ability. */
  gcd: number;
  cost: number;
  /** Frames, 0 for an instant. */
  castTime: number;
  /** Would a press go right now? `blocked` says why not: NOT READY, OUT OF RANGE, NOT ENOUGH RAGE ... */
  usable: boolean;
  blocked: string | undefined;
  /** The fighter is using, casting or dashing with it. */
  active: boolean;
}

export type EffectKind = 'stun' | 'fear' | 'slow' | 'dot' | 'shield' | 'evasion' | 'riposte' | 'lockout';

export interface EffectView {
  kind: EffectKind;
  /** The ability that caused it, for a dot. */
  name: string;
  /** Frames left. */
  remaining: number;
  /** Damage a shield still absorbs, a dot's damage per tick. */
  amount: number;
}

export interface FighterView {
  name: string;
  classKey: string;
  className: string;
  hp: { current: number; max: number };
  resource: { kind: ResourceKind; name: string; colour: string; current: number; max: number };
  /** The auto-attack: on, and how far along the swing timer is. */
  swing: { auto: boolean; remaining: number; total: number };
  /** Frames of global cooldown left. */
  gcd: number;
  abilities: AbilityView[];
  /** While a cast bar fills. */
  cast: { name: string; progress: number; remaining: number; total: number } | undefined;
  effects: EffectView[];
  wins: number;
  /** 'idle', 'attack', 'cast', 'stun' ... as the engine names them. */
  state: string;
}

const ACTIONS: readonly InputAction[] = ['ability1', 'ability2', 'ability3'];

/** A snapshot of fighter `i` for the UI. Cheap enough to take every frame. */
export function fighterView(match: Match, i: 0 | 1): FighterView {
  const f = match.fighters[i];
  const table = match.tables[i];
  const kit = table.kit;
  const acting = match.phase === 'fight' || match.phase === 'finish';
  const abilities: AbilityView[] = [];
  for (let n = 0; n < ABILITY_SLOTS; n++) {
    const a = kit.abilities[n]!;
    const blocked = acting ? abilityBlocked(match, i, n) : 'NOT NOW';
    const gcd = a.gcd ? f.gcd : 0;
    abilities.push({
      id: a.id,
      name: a.name,
      short: a.short,
      action: ACTIONS[n]!,
      cooldown: { remaining: f.cooldowns[n]!, total: a.cooldown },
      gcd,
      cost: a.cost,
      castTime: a.cast,
      usable: blocked === undefined && gcd === 0,
      blocked,
      active: f.ability === n && (f.state === 'ability' || f.state === 'cast' || f.state === 'dash'),
    });
  }
  const effects: EffectView[] = [];
  if (f.stunT > 0 && f.state === 'stun') effects.push({ kind: 'stun', name: 'Stunned', remaining: f.stunT, amount: 0 });
  if (f.fearT > 0 && f.state === 'fear') effects.push({ kind: 'fear', name: 'Feared', remaining: f.fearT, amount: 0 });
  if (f.slowT > 0) effects.push({ kind: 'slow', name: 'Slowed', remaining: f.slowT, amount: 0 });
  if (f.absorb > 0) effects.push({ kind: 'shield', name: 'Shield', remaining: f.absorbT, amount: f.absorb });
  if (f.evasionT > 0) effects.push({ kind: 'evasion', name: 'Evasion', remaining: f.evasionT, amount: 0 });
  if (f.riposteT > 0) effects.push({ kind: 'riposte', name: 'Riposte', remaining: f.riposteT, amount: 0 });
  if (f.lockoutT > 0) effects.push({ kind: 'lockout', name: 'Interrupted', remaining: f.lockoutT, amount: 0 });
  for (const dot of f.dots) {
    const source = match.tables[dot.source].kit.abilities.find((a) => a.id === dot.name);
    effects.push({ kind: 'dot', name: source?.name ?? dot.name, remaining: dot.nextTick + (dot.ticksLeft - 1) * 180, amount: dot.damage });
  }
  const cast = f.cast && f.state === 'cast'
    ? { name: kit.abilities[f.cast.ability]!.name, progress: Math.min(1, f.cast.t / f.cast.total), remaining: f.cast.total - f.cast.t, total: f.cast.total }
    : undefined;
  return {
    name: match.names[i],
    classKey: kit.classKey,
    className: kit.className,
    hp: { current: f.hp, max: HP },
    resource: { kind: kit.resource, name: RESOURCE_NAMES[kit.resource], colour: RESOURCE_COLOURS[kit.resource], current: Math.floor(f.resource), max: MAX_RESOURCE },
    swing: { auto: f.auto || f.queued, remaining: f.swingT, total: table.weapon.speed },
    gcd: f.gcd,
    abilities,
    cast,
    effects,
    wins: f.wins,
    state: f.state,
  };
}

export { GCD_FRAMES };
