import type { ComponentChildren } from 'preact';

/*
 * The game's tooltip: a near-black translucent box with a silver rim, and lines of text in the
 * game's colours, as an item or a spell lists itself. A line has a left part and an optional
 * right part pushed to the other edge ("Off Hand" ... "Sword", "30 Rage" ... "Melee Range").
 */

export type Quality = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** The colours the game writes tooltip lines in. */
export type Hue = Quality | 'white' | 'gold' | 'green' | 'red' | 'grey' | 'blue' | 'alliance' | 'horde';

export interface Line {
  left?: ComponentChildren;
  right?: ComponentChildren;
  hue?: Hue;
  rightHue?: Hue;
  /** 'name' is the first, larger line; 'small' a quiet note; 'gap' an empty line. */
  kind?: 'name' | 'small' | 'gap';
}

export function WowTooltip({ lines, class: extra = '' }: { lines: readonly Line[]; class?: string }) {
  return (
    <div class={`wow-tooltip ${extra}`}>
      {lines.map((line, i) =>
        line.kind === 'gap' ? (
          <div class="tt-gap" key={i} />
        ) : (
          <div class={`line ${line.kind ? `tt-${line.kind}` : ''} h-${line.hue ?? 'white'}`} key={i}>
            <span class="l">{line.left}</span>
            {line.right !== undefined && <span class={`r h-${line.rightHue ?? line.hue ?? 'white'}`}>{line.right}</span>}
          </div>
        ),
      )}
    </div>
  );
}
