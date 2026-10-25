import { describe, expect, it } from 'vitest';
import { actionable, type Inputs, type Match, tick } from '../../src/engine/engine';
import { RULES } from '../../src/engine/rules';
import { HP, ROUND_FRAMES } from '../../src/engine/stage';
import { fakeMatch, inputs, place, rig, run, skipIntro, until, WARRIOR } from './fake';

const K = RULES.kombat;

/** A KOMBAT match in the fight phase with the fighters `gap` apart. */
function kombat(gap = 1.5, seed = 1, classes: [number, number] = [WARRIOR, WARRIOR], shields: [boolean, boolean] = [false, false]): Match {
  const match = fakeMatch(seed, classes, shields, 'kombat');
  skipIntro(match);
  expect(match.phase).toBe('fight');
  place(match, gap);
  return match;
}

/** One tick with `who` pressing attack, the other holding `held`. */
function tap(match: Match, who: 0 | 1 = 0, held: Inputs = inputs()): void {
  const both: [Inputs, Inputs] = [inputs(), inputs()];
  both[who] = inputs({ attack: true });
  both[who === 0 ? 1 : 0] = held;
  tick(match, both);
}

const texts = (match: Match, side: 0 | 1) => match.texts.filter((t) => t.side === side).map((t) => `${t.kind}:${t.text}`);

describe('KOMBAT: attacks on the press', () => {
  it('a tap swings at once, in reach or not, with no swing timer', () => {
    const match = kombat(1.5);
    const f = match.fighters[0];
    tap(match);
    expect(f.state).toBe('attack');
    expect(f.swingT).toBe(0);
    const far = kombat(6);
    tap(far);
    expect(far.fighters[0].state).toBe('attack');
    expect(texts(far, 0)).not.toContain('info:OUT OF RANGE');
  });

  it('a second tap during the swing chains the next blow, and the third knocks down', () => {
    const match = kombat(1.5);
    const [a, b] = match.fighters;
    rig(match, 'hit');
    tap(match);
    expect(until(match, (m) => m.fighters[1].hp < HP, 30)).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - 8);
    expect(a.chain).toBe(0);
    // The press for the second blow, inside the first swing's recovery: it goes the moment the hitstop is over.
    run(match, 2);
    rig(match, 'hit');
    tap(match);
    expect(until(match, (m) => m.fighters[0].chain === 1, 10)).toBeGreaterThanOrEqual(0);
    expect(a.variation).toBe(1);
    expect(until(match, (m) => m.fighters[1].hp < HP - 8, 30)).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - 16);
    // The second landed while the first still held the victim: a combo.
    expect(match.combo[0]).toBe(2);
    expect(texts(match, 0)).toContain('combo:2 HITS');
    expect(b.state).toBe('hit');
    run(match, 2);
    rig(match, 'hit');
    tap(match);
    expect(until(match, (m) => m.fighters[0].chain === 2, 10)).toBeGreaterThanOrEqual(0);
    expect(until(match, (m) => m.fighters[1].hp < HP - 16, 30)).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - 28);
    expect(b.state).toBe('knockdown');
    expect(match.combo[0]).toBe(3);
    expect(texts(match, 0)).toContain('combo:3 HITS');
  });

  it('a fighter who is down cannot be hit again, so the string does not loop', () => {
    const match = kombat(1.5);
    const b = match.fighters[1];
    b.state = 'knockdown';
    b.move = 'knockdown';
    tap(match);
    run(match, 30);
    expect(b.hp).toBe(HP);
  });

  it('holding the key repeats the first blow as soon as each swing recovers', () => {
    const match = kombat(1.5);
    const a = match.fighters[0];
    const held: [Inputs, Inputs] = [inputs({ attack: true }), inputs()];
    let swings = 0;
    let last = a.swings;
    for (let n = 0; n < 120; n++) {
      tick(match, held);
      if (a.swings !== last) {
        last = a.swings;
        swings++;
        expect(a.chain).toBe(0);
      }
    }
    expect(swings).toBeGreaterThanOrEqual(4);
  });
});

describe('KOMBAT: hitstun', () => {
  it('a landed swing holds the victim for the hitstop and 14 frames more', () => {
    const match = kombat(1.5);
    const b = match.fighters[1];
    rig(match, 'hit');
    tap(match);
    expect(until(match, (m) => m.fighters[1].hp < HP, 30)).toBeGreaterThan(0);
    expect(b.hitstop).toBe(K.swingHitstop);
    expect(b.hitstun).toBe(K.hitstun.light);
    expect(actionable(match, 1)).toBe(false);
    run(match, K.swingHitstop + K.hitstun.light - 1);
    expect(actionable(match, 1)).toBe(false);
    run(match, 1);
    expect(actionable(match, 1)).toBe(true);
    // The combo against them ends with it.
    expect(match.combo[0]).toBe(0);
  });

  it('a melee ability holds the victim longer', () => {
    const match = kombat(1.5);
    const [a, b] = match.fighters;
    a.resource = 100;
    rig(match, 'hit');
    tick(match, [inputs({ ability: 1 }), inputs()]); // Mortal Strike
    expect(until(match, (m) => m.fighters[1].hp < HP, 60)).toBeGreaterThan(0);
    expect(b.hitstun).toBe(K.hitstun.heavy);
  });
});

describe('KOMBAT: block', () => {
  it('holding back takes a blow from the front on the guard: chip damage, block stun, no hitstun', () => {
    const match = kombat(1.5);
    const b = match.fighters[1];
    const back = inputs({ right: true });
    tap(match, 0, back);
    expect(until(match, (m) => m.fighters[1].state === 'block', 30, [inputs(), back])).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - Math.round(8 * K.block!.chip));
    expect(b.hitstun).toBe(0);
    expect(b.lag).toBe(K.block!.stun);
    expect(match.combo[0]).toBe(0);
    expect(texts(match, 1).filter((t) => t.startsWith('block:BLOCK'))).toHaveLength(1);
    // Held in the block for its stun, then free.
    run(match, K.swingHitstop + K.block!.stun, [inputs(), back]);
    expect(actionable(match, 1)).toBe(true);
  });

  it('a blow from behind is not blocked: the guard is held away from where it comes', () => {
    const match = kombat(1.5);
    const [a, b] = match.fighters;
    // P2 holds right, away from P1; then P1 is over to that side, as after jumping across.
    run(match, 3, [inputs(), inputs({ right: true })]);
    a.x = b.x + 1.2;
    a.facing = -1;
    rig(match, 'hit');
    tap(match, 0, inputs({ right: true }));
    expect(until(match, (m) => m.fighters[1].hp < HP, 30, [inputs(), inputs({ right: true })])).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - 8);
    expect(b.hitstun).toBeGreaterThan(0);
    expect(b.state).toBe('hit');
  });

  it('a fighter in the middle of a swing cannot block', () => {
    const match = kombat(1.5);
    const b = match.fighters[1];
    // P1 swings; a frame later P2 swings back holding away, and P1's blow lands first.
    rig(match, 'hit');
    tap(match);
    tick(match, [inputs(), inputs({ attack: true, right: true })]);
    expect(b.state).toBe('attack');
    expect(until(match, (m) => m.fighters[1].hp < HP, 30, [inputs(), inputs({ right: true })])).toBeGreaterThan(0);
    expect(b.hp).toBe(HP - 8);
  });
});

describe('KOMBAT: no dice', () => {
  it('no swing misses, is dodged, parried or blocked by the table in 200 swings rigged to', () => {
    const match = kombat(1.5, 1, [WARRIOR, WARRIOR], [false, true]);
    const [, b] = match.fighters;
    const outcomes = ['miss', 'dodge', 'parry', 'block'] as const;
    for (let n = 0; n < 200; n++) {
      place(match, 1.5);
      b.hp = HP;
      match.timer = ROUND_FRAMES;
      rig(match, outcomes[n % outcomes.length]!);
      tap(match);
      run(match, 60);
      expect(b.hp).toBeLessThan(HP);
      expect(texts(match, 1).some((t) => /^(miss|dodge|parry):/.test(t))).toBe(false);
      expect(match.texts.some((t) => t.kind === 'block')).toBe(false);
    }
    expect(match.phase).toBe('fight');
  });

  it('a crit is half again', () => {
    const match = kombat(1.5);
    // A state whose next draw is under the crit chance.
    let seed = 1;
    while ((Math.imul(seed, 1664525) + 1013904223) >>> 0 >= K.hitTable.crit * 0.5 * 4294967296) seed++;
    match.rng = seed;
    tap(match);
    until(match, (m) => m.fighters[1].hp < HP, 30);
    expect(match.fighters[1].hp).toBe(HP - 12);
  });
});
