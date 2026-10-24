import { useEffect, useRef, useState } from 'preact/hooks';
import type { Image } from '@mogshot/formats/blp';
import { CLASSIC_SCREEN_ASPECT, composeBackdrop } from '@mogshot/render/backdrop';
import type { LoadingScreen } from '@mogshot/worker/api';
import type { DataClient } from '@mogshot/worker/client';
import { CAMERA, START_X } from '../engine/stage';
import { Arena } from './arena';
import type { BuiltFighter } from './fighters';

/*
 * The two champions face each other across the ring while a stage is picked from the game's
 * loading screens. Enter fights; Escape goes back to the roster.
 */

interface VersusProps {
  client: DataClient;
  fighters: [BuiltFighter, BuiltFighter];
  screens: LoadingScreen[];
  onFight: (screen: LoadingScreen | undefined, image: Image | undefined) => void;
  onBack: () => void;
}

const STAGE_LIKE = /arena|gurubashi|nagrand|coliseum|colosseum|durotar|orgrimmar|stranglethorn|barrens|valley of trials|ring/i;

export function Versus({ client, fighters, screens, onFight, onBack }: VersusProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<Arena>(null);
  const [cursor, setCursor] = useState(() => Math.max(0, screens.findIndex((screen) => STAGE_LIKE.test(screen.name))));
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());
  const images = useRef(new Map<number, Promise<Image | undefined>>());
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const started = useRef(performance.now());

  const imageOf = (screen: LoadingScreen) => {
    let image = images.current.get(screen.fileId);
    if (!image) images.current.set(screen.fileId, (image = client.icon(screen.fileId).catch(() => undefined)));
    return image;
  };

  // Thumbnails around the cursor, drawn as the game shows them.
  useEffect(() => {
    let stale = false;
    const around = screens.slice(Math.max(0, cursor - 8), cursor + 9);
    for (const screen of around) {
      if (thumbs.has(screen.fileId)) continue;
      void imageOf(screen).then((image) => {
        if (stale || !image) return;
        const drawn = composeBackdrop({ kind: 'screen', fileId: screen.fileId, blur: 0, vignette: 0 }, 192, 108, image, screen.wide ? undefined : CLASSIC_SCREEN_ASPECT);
        if (!drawn) return;
        const url = drawn instanceof HTMLCanvasElement ? drawn.toDataURL() : undefined;
        if (!url) return;
        setThumbs((current) => new Map(current).set(screen.fileId, url));
      });
    }
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, screens]);

  // The screen behind the ring follows the cursor.
  useEffect(() => {
    const screen = screens[cursor];
    if (!screen) return;
    let stale = false;
    void imageOf(screen).then((image) => !stale && arena.current?.setScreen(screen, image));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, screens]);

  useEffect(() => {
    const ring = (arena.current ??= new Arena(canvas.current!));
    ring.setFighters(fighters);
    started.current = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const since = now - started.current;
      ring.frame([-START_X, START_X], 1);
      ring.draw(
        fighters.map((fighter, i) => {
          const intro = fighter.moves.moves.intro.variations[0]!;
          const idle = fighter.moves.moves.idle.variations[0]!;
          const roaring = since < intro.duration;
          const time = roaring ? since : idle.duration > 0 ? since % idle.duration : 0;
          return { sequence: roaring ? intro.sequence : idle.sequence, time, x: i === 0 ? -START_X : START_X, z: 0, facing: i === 0 ? 1 : -1 };
        }),
        CAMERA,
      );
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fighters]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft': case 'KeyA': setCursor((c) => (c - 1 + screens.length) % screens.length); break;
        case 'ArrowRight': case 'KeyD': setCursor((c) => (c + 1) % screens.length); break;
        case 'ArrowUp': case 'KeyW': setCursor((c) => (c - 8 + screens.length) % screens.length); break;
        case 'ArrowDown': case 'KeyS': setCursor((c) => (c + 8) % screens.length); break;
        case 'Enter': case 'KeyJ': case 'Numpad1': case 'Comma': case 'Space': {
          event.preventDefault();
          const screen = screens[cursorRef.current];
          if (!screen) onFight(undefined, undefined);
          else void imageOf(screen).then((image) => onFight(screen, image));
          break;
        }
        case 'Escape': onBack(); break;
        default: return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screens, onFight, onBack]);

  const [a, b] = fighters;
  const shown = screens.slice(Math.max(0, cursor - 5), cursor + 6);
  return (
    <div class="screen versus">
      <canvas class="ring" ref={canvas} />
      <div class="plates">
        <div class="plate p1">
          <div class="name">{a.champion.name}</div>
          <div class="title">{a.champion.title}</div>
        </div>
        <div class="vs">VS</div>
        <div class="plate p2">
          <div class="name">{b.champion.name}</div>
          <div class="title">{b.champion.title}</div>
        </div>
      </div>
      <div class="stages">
        <div class="label">CHOOSE THE GROUND · {screens[cursor]?.name ?? 'NO STAGE'}</div>
        <div class="strip">
          {shown.map((screen) => (
            <div key={screen.id} class={`stage ${screen === screens[cursor] ? 'here' : ''}`} title={screen.name}>
              {thumbs.get(screen.fileId) ? <img src={thumbs.get(screen.fileId)} alt={screen.name} /> : <span class="dim small">{screen.name}</span>}
            </div>
          ))}
        </div>
        <div class="controls">
          <span>← → pick a stage · ↑ ↓ jump eight · <b>Enter</b> fight · <b>Esc</b> back</span>
        </div>
      </div>
    </div>
  );
}
