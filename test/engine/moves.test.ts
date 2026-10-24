import { animationId } from '@mogshot/model/animation-names';
import { describe, expect, it } from 'vitest';
import { ALL_MOVE_NAMES, MOVE_NAMES, resolveMoves, variationOf } from '../../src/engine/moves';
import { fakeAnimations, fakeTable, FULL_SET } from './fake';

describe('resolveMoves', () => {
  it('oneHand picks Attack1H with all its variations', () => {
    const table = fakeTable(['Stand', 'Attack1H', 'Attack1H', 'Attack1H', 'AttackUnarmed'], 'oneHand');
    expect(table.moves.light.animation).toBe('Attack1H');
    expect(table.moves.light.variations.map((v) => v.sequence)).toEqual([1, 2, 3]);
    expect(variationOf(table.moves.light, 4).sequence).toBe(2);
  });

  it('falls back to AttackUnarmed', () => {
    const table = fakeTable(['Stand', 'AttackUnarmed', 'AttackUnarmed'], 'oneHand');
    expect(table.moves.light.animation).toBe('AttackUnarmed');
    expect(table.moves.light.variations.length).toBe(2);
  });

  it('two-handers and bows pick their own attack and ready', () => {
    const names = ['Stand', 'Attack1H', 'Attack2H', 'AttackBow', 'Ready1H', 'Ready2H', 'ReadyBow'];
    expect(fakeTable(names, 'twoHand').moves.light.animation).toBe('Attack2H');
    expect(fakeTable(names, 'bow').moves.light.animation).toBe('AttackBow');
    expect(fakeTable(names, 'bow').moves.idle.animation).toBe('ReadyBow');
    expect(fakeTable(names, 'long').moves.light.animation).toBe('Attack2H');
  });

  it('idle is Ready1H, else Stand', () => {
    expect(fakeTable(['Stand', 'Ready1H'], 'oneHand').moves.idle.animation).toBe('Ready1H');
    expect(fakeTable(['Stand'], 'oneHand').moves.idle.animation).toBe('Stand');
    expect(fakeTable(['Stand'], 'oneHand').moves.idle.loop).toBe(true);
  });

  it('Death does not loop; dazed and walk do', () => {
    const table = fakeTable();
    expect(table.moves.death.animation).toBe('Death');
    expect(table.moves.death.loop).toBe(false);
    expect(table.moves.dazed.loop).toBe(true);
    expect(table.moves.walk.loop).toBe(true);
    expect(table.moves.block.loop).toBe(false);
  });

  it('no Knockdown falls back to CombatCritical', () => {
    const table = fakeTable(['Stand', 'CombatCritical']);
    expect(table.moves.knockdown.animation).toBe('CombatCritical');
    expect(fakeTable().moves.knockdown.animation).toBe('Knockdown');
  });

  it('no CombatExecute falls back to Special2H', () => {
    const table = fakeTable(['Stand', 'Special2H', 'Special1H']);
    expect(table.moves.finisher.animation).toBe('Special2H');
    expect(fakeTable().moves.finisher.animation).toBe('CombatExecute');
  });

  it('a missing jump sets hasJump false and borrows idle', () => {
    const table = fakeTable(['Stand', 'Attack1H']);
    expect(table.hasJump).toBe(false);
    expect(table.moves.jump.animation).toBe('');
    expect(table.moves.jump.variations[0]?.sequence).toBe(0);
    expect(fakeTable().hasJump).toBe(true);
    expect(fakeTable().hasSpecial).toBe(true);
    expect(table.hasSpecial).toBe(false);
  });

  it('takes durations from the animations', () => {
    const table = fakeTable(FULL_SET, 'oneHand', { Attack1H: 733, Death: 2100 });
    expect(table.moves.light.variations.every((v) => v.duration === 733)).toBe(true);
    expect(table.moves.death.variations[0]?.duration).toBe(2100);
  });

  it('carries the hit windows from the plan', () => {
    const table = fakeTable();
    expect(table.moves.light.hit).toMatchObject({ from: 0.3, to: 0.55, range: 2.0, damage: 8, pushback: 0.35, hitstop: 6 });
    expect(table.moves.heavy.hit).toMatchObject({ from: 0.4, to: 0.65, range: 2.3, damage: 16, pushback: 0.6, hitstop: 10, crit: true });
    expect(table.moves.special.hit).toMatchObject({ from: 0.55, damage: 12, cooldown: 90, projectile: true });
    expect(table.moves.block.hit).toBeUndefined();
  });

  it('fills every move even from an empty list', () => {
    const table = resolveMoves(fakeAnimations([]), 'unarmed');
    for (const name of MOVE_NAMES) {
      expect(table.moves[name].variations.length).toBeGreaterThan(0);
      expect(table.moves[name].variations[0]?.duration).toBeGreaterThan(0);
    }
  });
});

describe('ALL_MOVE_NAMES', () => {
  it('is deduped and every name is a real animation', () => {
    expect(new Set(ALL_MOVE_NAMES).size).toBe(ALL_MOVE_NAMES.length);
    for (const name of ALL_MOVE_NAMES) expect(animationId(name), name).toBeGreaterThanOrEqual(0);
  });

  it('covers what every weapon and move can ask for', () => {
    for (const name of ['Ready1H', 'Ready2H', 'ReadyUnarmed', 'ReadyBow', 'Stand', 'Attack2HL', 'AttackRifle', 'Special1H', 'Kick', 'SpellCastDirected',
      'ShieldBlock', 'Dodge', 'CombatWound', 'Knockdown', 'Stun', 'Death', 'CombatExecute', 'BattleRoar', 'EmoteCheer', 'JumpLandRun']) {
      expect(ALL_MOVE_NAMES, name).toContain(name);
    }
  });
});
