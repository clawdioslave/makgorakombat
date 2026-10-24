import { useEffect, useRef, useState } from 'preact/hooks';
import { type Inputs, type Match, newMatch, poseOf, tick } from '../engine/engine';
import { InputReader } from '../engine/input';
import { type MoveTable, resolveMoves } from '../engine/moves';
import { CAMERA, TICK_MS } from '../engine/stage';
import { Arena } from './arena';
import type { BuiltFighter } from './fighters';
import { drawHud } from './hud';
import { seedOf } from './pixels';
import { isMuted, Mixer, toggleMute } from './sound';
import type { Source } from './Select';
import type { Ground } from './stages';

/*
 * The fight. The engine steps sixty times a second whatever the screen does; each frame the
 * fighters are posed from the engine's state and the HUD is drawn over them.
 */

interface FightProps {
  fighters: [BuiltFighter, BuiltFighter];
  stage: Ground;
  p2: Source;
  onBack: () => void;
}

const MAX_STEPS = 4;

/** Classes whose off-hand, beside a one-hander, is a shield: warrior, paladin, shaman. */
const SHIELD_CLASSES = new Set([1, 2, 7]);

/**
 * The fighter's moves and class kit, from its animations, its weapon and its class. A legend
 * without a class gets a warrior's kit, or a hunter's behind a bow.
 */
function tableOf(fighter: BuiltFighter): MoveTable {
  const { champion, result } = fighter;
  const shield = result.wielding === 'oneHand' && champion.classId !== undefined && SHIELD_CLASSES.has(champion.classId) && champion.gear.some(([slot]) => slot === 'offHand');
  return resolveMoves(result.scene.animations, result.wielding, champion.classId, shield);
}

export function Fight({ fighters, stage, p2, onBack }: FightProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stageElement = useRef<HTMLDivElement>(null);
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const match = useRef<Match>(null);
  const rematch = useRef(0);
  const [muted, setMuted] = useState(isMuted());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const ring = new Arena(canvas.current!);
    ring.setFighters(fighters);
    ring.setGround(stage);
    const names: [string, string] = [fighters[0].champion.name, fighters[1].champion.name];
    const seed = seedOf(fighters[0].champion.key + fighters[1].champion.key) + rematch.current;
    const tables: [MoveTable, MoveTable] = [tableOf(fighters[0]), tableOf(fighters[1])];
    match.current = newMatch(tables, seed, names);
    const mixer = new Mixer();
    void mixer.load(0, fighters[0].sounds);
    void mixer.load(1, fighters[1].sounds);
    // For scripts and the console: the live match and what the fight sounds like.
    (window as unknown as { mk?: { match: () => Match; sounds: () => unknown } }).mk = {
      match: () => match.current!,
      sounds: () => ({ played: mixer.played, sides: mixer.summary() }),
    };
    const input = new InputReader();
    input.attach(stageElement.current!);
    input.setSource(1, p2);
    stageElement.current!.focus();

    let frame = 0;
    let last = performance.now();
    let owed = 0;
    const times = { engine: 0, pose: 0, draw: 0 };
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const current = match.current!;
      owed += Math.min(now - last, 250);
      last = now;
      let steps = 0;
      const t0 = performance.now();
      while (owed >= TICK_MS && steps < MAX_STEPS) {
        // The reader asks the CPU itself when player 2 is the computer; asking twice would lose its presses.
        const inputs: [Inputs, Inputs] = input.read(current);
        tick(current, inputs);
        owed -= TICK_MS;
        steps++;
      }
      if (steps === MAX_STEPS) owed = 0;
      if (steps > 0) mixer.observe(current);
      const t1 = performance.now();
      ring.frame(current.fighters.map((fighter) => fighter.x));
      ring.draw(
        current.fighters.map((fighter, i) => ({ ...poseOf(current, i as 0 | 1), x: fighter.x, z: fighter.z, facing: fighter.facing })),
        CAMERA,
      );
      const t2 = performance.now();
      const hud = overlay.current!;
      if (hud.width !== canvas.current!.width || hud.height !== canvas.current!.height) {
        hud.width = canvas.current!.width;
        hud.height = canvas.current!.height;
      }
      const ctx = hud.getContext('2d')!;
      times.engine = times.engine * 0.9 + (t1 - t0) * 0.1;
      times.pose = times.pose * 0.9 + (t2 - t1) * 0.1;
      times.draw = times.draw * 0.9 + (performance.now() - t2) * 0.1;
      const note = debugRef.current
        ? `engine ${times.engine.toFixed(2)} ms · pose+draw ${times.pose.toFixed(2)} ms · hud ${times.draw.toFixed(2)} ms · sounds ${mixer.played}`
        : mutedRef.current ? 'MUTED · M' : undefined;
      drawHud(ctx, hud.width, hud.height, current, names, (point) => ring.project(CAMERA, point), note);
    };
    frame = requestAnimationFrame(loop);

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'F3') {
        event.preventDefault();
        setDebug((d) => !d);
      } else if (event.code === 'KeyM') {
        setMuted(toggleMute());
      } else if (event.code === 'Escape') {
        onBack();
      } else if (event.code === 'Enter' && match.current?.phase === 'matchEnd') {
        rematch.current++;
        match.current = newMatch(tables, seed + rematch.current, names);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      mixer.dispose();
      input.detach();
      window.removeEventListener('keydown', onKey);
    };
  }, [fighters, stage, p2, onBack]);

  return (
    <div class="screen fight" ref={stageElement} tabIndex={0}>
      <canvas class="ring" ref={canvas} />
      <canvas class="hud" ref={overlay} />
    </div>
  );
}
