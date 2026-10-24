import type { EffectView, FighterView } from '../../engine/view';

/*
 * A unit frame as the game draws its player and target frames: the round portrait on the
 * outer side, the name in gold on a dark plate, the green health bar and the class resource
 * bar beneath it in the resource's colour, both with their numbers; the cast bar and the row
 * of buffs and debuffs below. The rounds won are studs on the clock plate between the frames.
 */

export interface UnitFrameProps {
  side: 0 | 1;
  view: FighterView;
  portrait: string | undefined;
  /** Icons for the effects, by the effect's name. */
  effectIcons: ReadonlyMap<string, string>;
  /** The cast's spell icon, by name. */
  spellIcons: ReadonlyMap<string, string>;
}

const DEBUFFS: ReadonlySet<EffectView['kind']> = new Set(['stun', 'fear', 'slow', 'dot', 'lockout']);

export function UnitFrame({ side, view, portrait, effectIcons, spellIcons }: UnitFrameProps) {
  const hp = Math.max(0, Math.min(1, view.hp.current / view.hp.max));
  const res = Math.max(0, Math.min(1, view.resource.current / view.resource.max));
  const dead = view.state === 'death';
  // A long legend name is set smaller so it fits the plate on one line.
  const fit = view.name.length > 18 ? 'tiny' : view.name.length > 13 ? 'small' : '';
  return (
    <div class={`unitframe p${side + 1} ${dead ? 'dead' : ''}`}>
      <div class="plate">
        <div class="portrait">
          {portrait ? <img src={portrait} alt="" draggable={false} /> : <span class="letter">{view.name.charAt(0)}</span>}
        </div>
        <div class="bars">
          <div class="name">
            <span class={`who ${fit}`}>{view.name}</span>
            <span class="class">{view.className}</span>
          </div>
          <div class="bar health" style={{ '--fill': hp }}>
            <span class="fill" />
            <span class="gloss" />
            <span class="text">
              {Math.ceil(view.hp.current)} / {view.hp.max}
            </span>
          </div>
          <div class={`bar power ${view.resource.kind}`} style={{ '--fill': res, '--power': view.resource.colour }}>
            <span class="fill" />
            <span class="gloss" />
            <span class="text">
              {view.resource.current} {view.resource.name}
            </span>
          </div>
        </div>
      </div>
      <div class="effects">
        {view.effects.map((effect, k) => {
          const icon = effectIcons.get(effect.name);
          const total = effectTotal(effect);
          return (
            <div class={`effect ${DEBUFFS.has(effect.kind) ? 'debuff' : 'buff'} ${effect.kind}`} key={`${effect.kind}:${effect.name}:${k}`} title={effect.name}>
              {icon ? <img src={icon} alt="" draggable={false} /> : <span class="letter">{effect.name.charAt(0)}</span>}
              <span class="swipe" style={{ '--sweep': total > 0 ? 1 - Math.min(1, effect.remaining / total) : 0 }} />
              {effect.amount > 0 && <span class="stack">{Math.ceil(effect.amount)}</span>}
              <span class="time">{seconds(effect.remaining)}</span>
            </div>
          );
        })}
      </div>
      {view.cast && (
        <div class="castbar">
          <span class="icon">{spellIcons.get(view.cast.name) && <img src={spellIcons.get(view.cast.name)} alt="" draggable={false} />}</span>
          <div class="track" style={{ '--fill': view.cast.progress }}>
            <span class="fill" />
            <span class="spark" />
            <span class="text">{view.cast.name}</span>
            <span class="left">{(view.cast.remaining / 60).toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** How long the effect ran in all, for the swipe; the view carries only what is left, so the longest seen is remembered. */
const longest = new Map<string, number>();
function effectTotal(effect: EffectView): number {
  const key = `${effect.kind}:${effect.name}`;
  const known = longest.get(key) ?? 0;
  if (effect.remaining > known) longest.set(key, effect.remaining);
  return Math.max(known, effect.remaining);
}

/** Seconds left as the game shows them: whole above ten, tenths below. */
export function seconds(frames: number): string {
  const s = frames / 60;
  if (s >= 60) return `${Math.ceil(s / 60)}m`;
  return s >= 10 ? String(Math.ceil(s)) : s.toFixed(1);
}
