import { describe, expect, it } from 'vitest';
import { BRAND } from '../../src/engine/brand';
import { type Inputs, type Match, newMatch, poseOf, tick } from '../../src/engine/engine';
import { BODY, FINISH_FRAMES, HALF, HP, INTRO_FRAMES, KO_SLOWMO, ROUND_END_FRAMES, START_X } from '../../src/engine/stage';
import { fakeMatch, fakeTable, inputs, NONE, place, run, skipIntro, until } from './fake';

/** A match in the fight phase with the fighters `gap` apart. */
function fighting(gap = 1.5, seed = 1): Match {
  const match = fakeMatch(seed);
  skipIntro(match);
  expect(match.phase).toBe('fight');
  place(match, gap);
  return match;
}

/** Ticks through one whole attack: the press, then the move's 1000 ms. */
function swing(match: Match, attacker: 0 | 1, press: Partial<Inputs>, held: [Inputs, Inputs] = NONE): void {
  const both: [Inputs, Inputs] = [{ ...held[0] }, { ...held[1] }];
  both[attacker] = { ...both[attacker], ...press };
  tick(match, both);
  run(match, 80, held);
}

describe('intro', () => {
  it('starts on the marks with ROUND 1 and reaches FIGHT!', () => {
    const match = fakeMatch();
    expect(match.fighters[0].x).toBe(-START_X);
    expect(match.fighters[1].x).toBe(START_X);
    expect(match.fighters[0].facing).toBe(1);
    expect(match.fighters[1].facing).toBe(-1);
    expect(match.banner?.text).toBe(BRAND.round(1));
    run(match, INTRO_FRAMES - 59);
    expect(match.banner?.text).toBe(BRAND.fight);
    expect(match.phase).toBe('intro');
    run(match, 60);
    expect(match.phase).toBe('fight');
  });

  it('ignores inputs during the intro', () => {
    const match = fakeMatch();
    run(match, 50, [inputs({ right: true, light: true }), inputs()]);
    expect(match.fighters[0].x).toBe(-START_X);
    expect(match.fighters[0].state).not.toBe('attack');
  });
});

describe('movement', () => {
  it('clamps to the stage walls', () => {
    const match = fighting(4.4);
    run(match, 400, [inputs({ left: true }), inputs({ right: true })]);
    expect(match.fighters[0].x).toBe(-HALF);
    expect(match.fighters[1].x).toBe(HALF);
  });

  it('never lets the bodies overlap below BODY', () => {
    const match = fighting(4.4);
    for (let i = 0; i < 300; i++) {
      tick(match, [inputs({ right: true }), inputs({ left: true })]);
      expect(Math.abs(match.fighters[0].x - match.fighters[1].x)).toBeGreaterThanOrEqual(BODY - 1e-9);
    }
  });

  it('gives way to the fighter in the corner', () => {
    const match = fighting(4.4);
    run(match, 400, [inputs({ left: true }), inputs({ left: true })]);
    expect(match.fighters[0].x).toBe(-HALF);
    expect(match.fighters[1].x).toBeCloseTo(-HALF + BODY, 5);
  });

  it('walks forward and backs away at different speeds', () => {
    const match = fighting(4.4);
    const x0 = match.fighters[0].x;
    tick(match, [inputs({ right: true }), inputs()]);
    const forward = match.fighters[0].x - x0;
    tick(match, [inputs({ left: true }), inputs()]);
    const back = match.fighters[0].x - x0 - forward;
    expect(forward).toBeCloseTo(0.045, 6);
    expect(back).toBeCloseTo(-0.035, 6);
    expect(match.fighters[0].move).toBe('back');
  });

  it('jumps and lands back on the ground', () => {
    const match = fighting(4.4);
    tick(match, [inputs({ jump: true }), inputs()]);
    expect(match.fighters[0].airborne).toBe(true);
    expect(match.fighters[0].move).toBe('jumpStart');
    const frames = until(match, (m) => !m.fighters[0].airborne, 200);
    expect(frames).toBeGreaterThan(20);
    expect(match.fighters[0].z).toBe(0);
    expect(match.fighters[0].move).toBe('jumpEnd');
  });
});

describe('attacks', () => {
  it('a light hit deals 8 once, with hitstop and pushback', () => {
    const match = fighting(1.5);
    tick(match, [inputs({ light: true }), inputs()]);
    expect(match.fighters[0].state).toBe('attack');
    expect(match.fighters[0].move).toBe('light');
    const landed = until(match, (m) => m.fighters[1].hp < HP, 60);
    expect(landed).toBeGreaterThan(0);
    expect(match.fighters[1].hp).toBe(92);
    expect(match.fighters[1].hitstop).toBeGreaterThan(0);
    expect(match.fighters[0].hitstop).toBeGreaterThan(0);
    expect(match.fighters[1].vx).toBeGreaterThan(0);
    expect(match.fighters[1].move).toBe('hit');
    expect(match.sparks[0]?.kind).toBe('hit');
    run(match, 80);
    expect(match.fighters[1].hp).toBe(92);
    expect(match.fighters[1].tookDamage).toBe(true);
    expect(match.fighters[0].state).toBe('idle');
  });

  it('a blocked hit deals 0 and makes a block spark', () => {
    const match = fighting(1.5);
    const held: [Inputs, Inputs] = [inputs(), inputs({ block: true })];
    tick(match, held);
    expect(match.fighters[1].blocking).toBe(true);
    swing(match, 0, { light: true }, held);
    expect(match.fighters[1].hp).toBe(HP);
    expect(match.fighters[1].tookDamage).toBe(false);
    expect(match.sparks.some((s) => s.kind === 'block') || match.sparks.length === 0).toBe(true);
  });

  it('records the block spark when it lands', () => {
    const match = fighting(1.5);
    const held: [Inputs, Inputs] = [inputs(), inputs({ block: true })];
    tick(match, held);
    tick(match, [inputs({ light: true }), inputs({ block: true })]);
    const at = until(match, (m) => m.sparks.length > 0, 60, held);
    expect(at).toBeGreaterThan(0);
    expect(match.sparks[0]?.kind).toBe('block');
    expect(match.fighters[1].hp).toBe(HP);
  });

  it('misses out of range', () => {
    const match = fighting(3);
    swing(match, 0, { light: true });
    expect(match.fighters[1].hp).toBe(HP);
    expect(match.sparks.length).toBe(0);
  });

  it('misses a jumping target', () => {
    const match = fighting(1.5);
    tick(match, [inputs({ light: true }), inputs({ jump: true })]);
    run(match, 60);
    expect(match.fighters[1].hp).toBe(HP);
  });

  it('a heavy deals 16 and the third one knocks down', () => {
    const match = fighting(1.5);
    swing(match, 0, { heavy: true });
    expect(match.fighters[1].hp).toBe(84);
    expect(match.fighters[1].move).not.toBe('knockdown');
    place(match, 1.5);
    swing(match, 0, { heavy: true });
    place(match, 1.5);
    tick(match, [inputs({ heavy: true }), inputs()]);
    const at = until(match, (m) => m.fighters[1].hp < 68, 60);
    expect(at).toBeGreaterThan(0);
    expect(match.fighters[1].move).toBe('knockdown');
    expect(match.fighters[1].hp).toBe(52);
  });

  it('spawns the special projectile at 55 % and hits for 12', () => {
    const match = fighting(4);
    tick(match, [inputs({ special: true }), inputs()]);
    expect(match.fighters[0].move).toBe('special');
    expect(match.fighters[0].cooldown).toBe(90);
    const spawned = until(match, (m) => m.projectiles.length > 0, 60);
    expect(spawned).toBeGreaterThanOrEqual(32);
    expect(spawned).toBeLessThanOrEqual(34);
    const p = match.projectiles[0]!;
    // Spawned 0.8 ahead of P1 at x = -2, then flown one frame.
    expect(p.x).toBeCloseTo(-2 + 0.8 + 0.14, 5);
    expect(p.z).toBe(1.25);
    expect(p.vx).toBeCloseTo(0.14, 5);
    const hit = until(match, (m) => m.fighters[1].hp < HP, 200);
    expect(hit).toBeGreaterThan(0);
    expect(match.fighters[1].hp).toBe(88);
    expect(match.projectiles.length).toBe(0);
  });

  it('a jumping target clears the projectile', () => {
    const match = fighting(4);
    tick(match, [inputs({ special: true }), inputs()]);
    until(match, (m) => m.projectiles.length > 0, 60);
    const p = match.projectiles[0]!;
    const framesToArrive = Math.round((match.fighters[1].x - p.x) / p.vx);
    run(match, framesToArrive - 16);
    tick(match, [inputs(), inputs({ jump: true })]);
    run(match, 40);
    expect(match.fighters[1].hp).toBe(HP);
  });

  it('the special honours its cooldown', () => {
    const match = fighting(4);
    tick(match, [inputs({ special: true }), inputs()]);
    run(match, 70);
    tick(match, [inputs({ special: true }), inputs()]);
    expect(match.fighters[0].move).not.toBe('special');
  });
});

/** Drives P1 to a KO: P2 is left at `hp` and P1 lands a light. */
function toFinish(gap = 1.5): Match {
  const match = fighting(gap);
  match.fighters[1].hp = 8;
  tick(match, [inputs({ light: true }), inputs()]);
  const at = until(match, (m) => m.phase === 'finish', 60);
  expect(at).toBeGreaterThan(0);
  return match;
}

describe('the finish', () => {
  it('hp 0 dazes the loser and asks for the finish', () => {
    const match = toFinish();
    expect(match.fighters[1].hp).toBe(0);
    expect(match.fighters[1].state).toBe('dazed');
    expect(match.banner?.text).toBe(BRAND.finish);
    expect(match.roundWinner).toBe(0);
  });

  it('a landed heavy is DISHONOR! and the winner plays the finisher in slow motion', () => {
    const match = toFinish();
    run(match, 60);
    place(match, 1.5);
    tick(match, [inputs({ heavy: true }), inputs()]);
    const at = until(match, (m) => m.phase === 'ko', 90);
    expect(at).toBeGreaterThan(0);
    expect(match.banner?.text).toBe(BRAND.fatality);
    expect(match.fighters[0].move).toBe('finisher');
    expect(match.fighters[0].state).toBe('finisher');
    expect(match.fighters[1].move).toBe('death');
    expect(match.slowmo).toBe(KO_SLOWMO.rate);
    expect(match.fighters[0].wins).toBe(1);
  });

  it('a light just drops them: K.O.', () => {
    const match = toFinish();
    run(match, 60);
    place(match, 1.5);
    tick(match, [inputs({ light: true }), inputs()]);
    const at = until(match, (m) => m.phase === 'ko', 90);
    expect(at).toBeGreaterThan(0);
    expect(match.banner?.text).toBe(BRAND.ko);
    expect(match.fighters[0].move).not.toBe('finisher');
    expect(match.fighters[1].move).toBe('death');
  });

  it('times out to K.O.', () => {
    const match = toFinish();
    run(match, FINISH_FRAMES + 1);
    expect(match.phase).toBe('ko');
    expect(match.banner?.text).toBe(BRAND.ko);
    expect(match.fighters[1].move).toBe('death');
    expect(match.fighters[0].wins).toBe(1);
  });

  it('the dazed loser cannot act', () => {
    const match = toFinish();
    run(match, 60); // the pushback settles
    const x = match.fighters[1].x;
    run(match, 10, [inputs(), inputs({ left: true, light: true })]);
    expect(match.fighters[1].x).toBe(x);
    expect(match.fighters[1].state).toBe('dazed');
  });

  it('death holds on its last frame', () => {
    const match = toFinish();
    run(match, FINISH_FRAMES + 1);
    run(match, 150); // through the slow motion, before the next round resets them
    const loser = match.fighters[1];
    expect(loser.move).toBe('death');
    expect(loser.t).toBe(1000);
    expect(poseOf(match, 1).time).toBe(1000);
  });
});

describe('rounds', () => {
  function winRound(match: Match): void {
    match.fighters[1].hp = 8;
    place(match, 1.5);
    tick(match, [inputs({ light: true }), inputs()]);
    expect(until(match, (m) => m.phase === 'finish', 60)).toBeGreaterThan(0);
    run(match, FINISH_FRAMES + 1);
    expect(match.phase).toBe('ko');
  }

  it('resets for round 2 with wins[0] === 1', () => {
    const match = fighting();
    winRound(match);
    run(match, KO_SLOWMO.frames);
    expect(match.phase).toBe('roundEnd');
    expect(match.slowmo).toBe(1);
    expect(match.fighters[0].move).toBe('win');
    expect(match.banner?.text).toBe(BRAND.roundWin('P1'));
    run(match, ROUND_END_FRAMES);
    expect(match.phase).toBe('intro');
    expect(match.round).toBe(2);
    expect(match.fighters[0].wins).toBe(1);
    expect(match.fighters[1].wins).toBe(0);
    expect(match.fighters[1].hp).toBe(HP);
    expect(match.fighters[0].x).toBe(-START_X);
    expect(match.fighters[1].x).toBe(START_X);
    expect(match.fighters[1].state).toBe('intro');
    expect(match.banner?.text).toBe(BRAND.round(2));
  });

  it('two KOs end the match', () => {
    const match = fighting();
    winRound(match);
    run(match, KO_SLOWMO.frames + ROUND_END_FRAMES);
    skipIntro(match);
    winRound(match);
    run(match, KO_SLOWMO.frames + ROUND_END_FRAMES);
    expect(match.phase).toBe('matchEnd');
    expect(match.winner).toBe(0);
    expect(match.fighters[0].wins).toBe(2);
    expect(match.banner?.text).toBe(BRAND.matchWin('P1'));
    run(match, 100);
    expect(match.phase).toBe('matchEnd');
  });

  it('the timer gives the round to the higher hp', () => {
    const match = fighting(1.5);
    swing(match, 0, { light: true });
    expect(match.fighters[1].hp).toBe(92);
    match.timer = 1;
    tick(match, NONE);
    expect(match.phase).toBe('ko');
    expect(match.roundWinner).toBe(0);
    expect(match.fighters[1].move).toBe('death');
    expect(match.fighters[0].wins).toBe(1);
  });

  it('a flawless round says HONOR RESTORED', () => {
    const match = fighting();
    winRound(match);
    run(match, KO_SLOWMO.frames);
    expect(match.banner?.sub).toBe(BRAND.flawless);
  });

  it('a round where the winner was hit does not', () => {
    const match = fighting(1.5);
    swing(match, 1, { light: true });
    expect(match.fighters[0].hp).toBe(92);
    run(match, 60); // P1 recovers from the hit
    winRound(match);
    run(match, KO_SLOWMO.frames);
    expect(match.banner?.text).toBe(BRAND.roundWin('P1'));
    expect(match.banner?.sub).toBeUndefined();
  });

  it('uses the names it was given', () => {
    const match = newMatch([fakeTable(), fakeTable()], 3, ['NIGHT ELF', 'ORC']);
    skipIntro(match);
    winRound(match);
    run(match, KO_SLOWMO.frames);
    expect(match.banner?.text).toBe(BRAND.roundWin('NIGHT ELF'));
  });
});

describe('determinism', () => {
  function scripted(frame: number): [Inputs, Inputs] {
    const a = inputs({
      right: frame % 7 < 4,
      left: frame % 11 === 0,
      light: frame % 23 === 0,
      heavy: frame % 61 === 0,
      special: frame % 97 === 0,
      jump: frame % 53 === 0,
      block: frame % 13 < 2,
    });
    const b = inputs({
      left: frame % 5 < 3,
      light: frame % 19 === 0,
      heavy: frame % 47 === 0,
      special: frame % 89 === 0,
      jump: frame % 71 === 0,
      block: frame % 17 < 3,
    });
    return [a, b];
  }

  it('the same seed and inputs give the same match after 2000 ticks', () => {
    const a = fakeMatch(42);
    const b = fakeMatch(42);
    for (let f = 0; f < 2000; f++) {
      tick(a, scripted(f));
      tick(b, scripted(f));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.fighters[0].hp + a.fighters[1].hp).toBeLessThan(2 * HP);
  });
});
