import { BRAND } from '../engine/brand';
import type { Phase } from './folder';

interface TitleProps {
  phase: Phase;
  dragging: boolean;
  onPick: (input: HTMLInputElement) => void;
}

const chromium = typeof window !== 'undefined' && 'chrome' in window;

export function Logo({ small }: { small?: boolean }) {
  return (
    <div class={`logo ${small ? 'small' : ''}`}>
      <span class="makgora">MAK'GORA</span>
      <span class="kombat">KOMBAT</span>
    </div>
  );
}

/** The two champions the ring always opens on, drawn once from the game and shipped with the page. */
const art = (name: string) => `${import.meta.env.BASE_URL}title/${name}` + (name === 'logo' ? '' : '.png');

export function Title({ phase, dragging, onPick }: TitleProps) {
  return (
    <div class="screen title">
      <div class="faceoff" aria-hidden="true">
        <img class="champion left" src={art('tyrande')} alt="" draggable={false} />
        <img class="champion right" src={art('thrall')} alt="" draggable={false} />
      </div>
      <h1 class="logo-art">
        <img src={art('logo') + '.webp'} alt={BRAND.title} draggable={false} />
      </h1>
      <p class="tagline">{BRAND.tagline}</p>
      <div class="billing">
        <span class="p1">TYRANDE</span>
        <span class="vs">VS</span>
        <span class="p2">THRALL</span>
      </div>
      {phase.kind === 'opening' ? (
        <div class="drop opening">
          <p class="big">ENTERING THE RING</p>
          <p class="dim">{phase.message}</p>
        </div>
      ) : (
        <div class={`drop ${dragging ? 'over' : ''}`}>
          <p class="big">DROP YOUR WORLD OF WARCRAFT FOLDER HERE</p>
          <p class="dim">
            It is in <code>Applications</code> on a Mac and usually in <code>C:\Program Files (x86)</code> on Windows. Your game
            files are read in this browser and never leave your computer.
          </p>
          <label class="button">
            or choose the folder…
            <input
              type="file"
              // @ts-expect-error webkitdirectory is not in the DOM typings
              webkitdirectory
              hidden
              onChange={(event) => onPick(event.currentTarget)}
            />
          </label>
          {phase.kind === 'error' && <p class="bad">{phase.message}</p>}
          {!chromium && <p class="bad">Made for Chrome. Other browsers may not read the folder.</p>}
        </div>
      )}
      <p class="dim small credits">
        A fan game. World of Warcraft is Blizzard Entertainment's; the fighters are drawn from your own copy of it with the{' '}
        <a href="https://realworldbuilder.github.io/mogshot/">Mogshot</a> engine.
      </p>
    </div>
  );
}
