import { describe, expect, it } from 'vitest';
import { CPU_DECIDE_FRAMES, cpuInputs } from '../../src/engine/cpu';
import { type Inputs, type Match, tick } from '../../src/engine/engine';
import { InputReader } from '../../src/engine/input';
import { fakeMatch, inputs, place, skipIntro, until } from './fake';

function cpuTick(match: Match): [Inputs, Inputs] {
  const both: [Inputs, Inputs] = [inputs(), cpuInputs(match, 1)];
  tick(match, both);
  return both;
}

describe('cpuInputs', () => {
  it('walks in when far apart, within 60 frames', () => {
    const match = fakeMatch(5);
    skipIntro(match);
    const start = match.fighters[1].x;
    let frames = 0;
    while (frames < 60 && match.fighters[1].x >= start - 0.3) {
      cpuTick(match);
      frames++;
    }
    expect(match.fighters[1].x).toBeLessThan(start - 0.3);
    expect(frames).toBeLessThanOrEqual(60);
  });

  it('attacks within 120 frames when in range', () => {
    const match = fakeMatch(9);
    skipIntro(match);
    place(match, 1.5);
    let frames = 0;
    while (frames < 120 && match.fighters[1].state !== 'attack') {
      cpuTick(match);
      frames++;
    }
    expect(match.fighters[1].state).toBe('attack');
  });

  it('holds its decision between decision frames', () => {
    const match = fakeMatch(5);
    skipIntro(match);
    const first = cpuInputs(match, 1);
    tick(match, [inputs(), first]);
    for (let i = 1; i < CPU_DECIDE_FRAMES; i++) {
      const held = cpuInputs(match, 1);
      expect(held.left).toBe(first.left);
      expect(held.right).toBe(first.right);
      expect(held.light || held.heavy || held.special || held.jump).toBe(false);
      tick(match, [inputs(), held]);
    }
  });

  it('goes for the heavy in the finish', () => {
    const match = fakeMatch(3);
    skipIntro(match);
    place(match, 1.5);
    match.fighters[0].hp = 8;
    // P1 is the one left dazed; the CPU (P2) finishes.
    tick(match, [inputs(), inputs({ light: true })]);
    expect(until(match, (m) => m.phase === 'finish', 60)).toBeGreaterThan(0);
    let frames = 0;
    while (frames < 200 && match.phase === 'finish') {
      cpuTick(match);
      frames++;
    }
    expect(match.phase).toBe('ko');
    expect(match.fighters[1].move).toBe('finisher');
  });

  it('is the same with the same seed', () => {
    const a = fakeMatch(77);
    const b = fakeMatch(77);
    const seqA: string[] = [];
    const seqB: string[] = [];
    for (let i = 0; i < 600; i++) {
      const ia = cpuInputs(a, 1);
      const ib = cpuInputs(b, 1);
      seqA.push(JSON.stringify(ia));
      seqB.push(JSON.stringify(ib));
      tick(a, [cpuInputs(a, 0), ia]);
      tick(b, [cpuInputs(b, 0), ib]);
    }
    expect(seqA).toEqual(seqB);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(seqA.some((s) => s.includes('true'))).toBe(true);
  });

  it('differs with another seed', () => {
    const a = fakeMatch(1);
    const b = fakeMatch(2);
    const seqA: string[] = [];
    const seqB: string[] = [];
    for (let i = 0; i < 600; i++) {
      const ia = cpuInputs(a, 1);
      const ib = cpuInputs(b, 1);
      seqA.push(JSON.stringify(ia));
      seqB.push(JSON.stringify(ib));
      tick(a, [cpuInputs(a, 0), ia]);
      tick(b, [cpuInputs(b, 0), ib]);
    }
    expect(seqA).not.toEqual(seqB);
  });
});

describe('InputReader', () => {
  it('edge-triggers attacks and jumps, holds movement and block', () => {
    const reader = new InputReader();
    reader.press('KeyD');
    reader.press('KeyJ');
    reader.press('KeyU');
    let [p1] = reader.read();
    expect(p1).toMatchObject({ right: true, light: true, block: true });
    [p1] = reader.read();
    expect(p1).toMatchObject({ right: true, light: false, block: true });
    reader.release('KeyJ');
    reader.read();
    reader.press('KeyJ');
    [p1] = reader.read();
    expect(p1.light).toBe(true);
  });

  it('reads P2 from its own keys and the CPU from the match', () => {
    const reader = new InputReader();
    reader.press('ArrowLeft');
    reader.press('Numpad2');
    const [, p2] = reader.read();
    expect(p2).toMatchObject({ left: true, heavy: true });
    reader.setSource(1, 'cpu');
    const match = fakeMatch(4);
    skipIntro(match);
    const [, cpu] = reader.read(match);
    expect(cpu.left || cpu.right || cpu.special).toBe(true);
    expect(reader.read()[1]).toEqual(inputs());
  });
});
