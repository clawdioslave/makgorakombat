import { useState } from 'preact/hooks';
import { BRAND } from '../engine/brand';
import { ActionBar, GLYPHS } from './ActionBar';
import type { Phase } from './folder';
import { Guide, type GuidePage } from './Guide';

interface TitleProps {
  phase: Phase;
  dragging: boolean;
  onPick: (input: HTMLInputElement) => void;
}

const chromium = typeof window !== 'undefined' && 'chrome' in window;
const SOURCE = 'https://github.com/realworldbuilder/makgorakombat';

/** The title's art, drawn once and shipped with the page: the logo, and the two champions the ring always opens on. */
export const art = (name: string) => `${import.meta.env.BASE_URL}title/${name}`;

export function Logo({ small }: { small?: boolean }) {
  return (
    <div class={`logo ${small ? 'small' : ''}`}>
      <span class="makgora">MAK'GORA</span>
      <span class="kombat">KOMBAT</span>
    </div>
  );
}

export function LogoArt({ small }: { small?: boolean }) {
  return (
    <h1 class={`logo-art ${small ? 'small' : ''}`}>
      <img src={art('logo.png')} alt={BRAND.title} draggable={false} />
    </h1>
  );
}

export function Title({ phase, dragging, onPick }: TitleProps) {
  const [guide, setGuide] = useState<GuidePage>();
  const opening = phase.kind === 'opening';
  return (
    <div class={`screen title ${dragging ? 'over' : ''}`}>
      <div class="faceoff" aria-hidden="true">
        <img class="champion left" src={art('tyrande.png')} alt="" draggable={false} />
        <img class="champion right" src={art('thrall.png')} alt="" draggable={false} />
      </div>
      <LogoArt />
      <p class="tagline">{BRAND.tagline}</p>
      <div class="billing">
        <span class="p1">TYRANDE</span>
        <span class="vs">VS</span>
        <span class="p2">THRALL</span>
      </div>
      {opening ? (
        <div class="opening">
          <p class="big">ENTERING THE RING</p>
          <p class="dim">{phase.message}</p>
        </div>
      ) : (
        <>
          <ActionBar
            slots={[
              {
                key: '1',
                label: 'ENTER THE RING',
                icon: GLYPHS.folder,
                lit: true,
                tip: [
                  { left: 'Enter the Ring', kind: 'name', hue: 'legendary' },
                  { left: 'Unique' },
                  { left: 'Use: Choose your World of Warcraft folder. The fighters, their gear, the arenas and the sounds are read from it here in the browser.', hue: 'green' },
                  { left: '"Your game files never leave your computer."', hue: 'gold' },
                ],
                input: (
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is not in the DOM typings
                    webkitdirectory
                    hidden
                    onChange={(event) => onPick(event.currentTarget)}
                  />
                ),
              },
              {
                key: '2',
                label: 'HOW TO PLAY',
                icon: GLYPHS.swords,
                onClick: () => setGuide('play'),
                tip: [
                  { left: 'How to Play', kind: 'name', hue: 'rare' },
                  { left: 'Use: The keys for both players, the action bar and how a round is won.', hue: 'green' },
                ],
              },
              {
                key: '3',
                label: 'YOUR CHAMPION',
                icon: GLYPHS.champion,
                onClick: () => setGuide('champion'),
                tip: [
                  { left: 'Your Champion', kind: 'name', hue: 'epic' },
                  { left: 'Soulbound' },
                  { left: 'Use: Bring your own characters into the ring with the Mogshot addon.', hue: 'green' },
                ],
              },
              {
                key: '4',
                label: 'SOURCE',
                icon: GLYPHS.code,
                href: SOURCE,
                tip: [
                  { left: 'Source', kind: 'name', hue: 'uncommon' },
                  { left: 'Use: Read how the game is made, on GitHub.', hue: 'green' },
                ],
              },
            ]}
          />
          <p class="hint">
            <b>Drop your World of Warcraft folder</b> anywhere on this page, or press 1 to choose it. It is in <code>Applications</code> on a
            Mac. Your game files are read here in the browser and never leave your computer.
          </p>
          {phase.kind === 'error' && <p class="bad">{phase.message}</p>}
          {!chromium && <p class="bad">Made for Chrome. Other browsers may not read the folder.</p>}
        </>
      )}
      <p class="dim small credits">
        A fan game. World of Warcraft is Blizzard Entertainment's; the fighters are drawn from your own copy of it with the{' '}
        <a href="https://realworldbuilder.github.io/mogshot/">Mogshot</a> engine.
      </p>
      {guide && <Guide page={guide} onPage={setGuide} onClose={() => setGuide(undefined)} />}
    </div>
  );
}
