import { useEffect, useRef } from 'preact/hooks';
import { GCD_FRAMES } from '../../engine/abilities';
import { type InputAction, KEYS, keyLabel } from '../../engine/input';
import type { AbilityView, FighterView } from '../../engine/view';
import { seconds } from './UnitFrame';

/*
 * A player's action bar as the game lays its buttons out: square slots with the spell's own
 * icon, the key in the corner, a clockwise cooldown wipe with the seconds left in the middle, a
 * quick wipe over every slot for the global cooldown, the icon greyed while it cannot go and
 * tinted blue when the resource is short, the key in red when the target is out of reach, the
 * reason on hover, a gold flash when the key is pressed and a glow while the ability is in use.
 * The first slot is the auto-attack, with the swing timer wiping round it.
 */

export interface FightBarProps {
  side: 0 | 1;
  view: FighterView;
  /** Icons by ability id; 'attack' for the auto-attack. */
  icons: ReadonlyMap<string, string>;
  /** Ranged weapons shoot instead of swinging. */
  ranged: boolean;
}

/** How long the flash of a pressed key lasts. */
const FLASH_MS = 180;

export function FightBar({ side, view, icons, ranged }: FightBarProps) {
  // When each action's key last went down, so the slot can flash even when the press did nothing.
  const pressed = useRef(new Map<InputAction, number>());
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const map = KEYS[side];
      for (const action of Object.keys(map) as InputAction[]) {
        if (map[action].includes(event.code)) pressed.current.set(action, performance.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [side]);
  const flashing = (action: InputAction) => performance.now() - (pressed.current.get(action) ?? -Infinity) < FLASH_MS;

  const swing = view.swing;
  const swingSweep = swing.total > 0 ? Math.min(1, swing.remaining / swing.total) : 0;
  return (
    // A click on the bar must not take the keyboard focus off the stage, or the keys go dead.
    <div class={`fightbar p${side + 1}`} onMouseDown={(event) => event.preventDefault()}>
      <div
        class={`slot auto ${swing.auto ? 'on' : ''} ${swing.inReach ? '' : 'far'} ${flashing('attack') ? 'flash' : ''}`}
        title={`${ranged ? 'Auto Shot: hold to keep shooting' : 'Attack: hold to keep swinging'}${swing.inReach ? '' : ' — OUT OF RANGE'}`}
      >
        <Icon url={icons.get('attack')} name={ranged ? 'SHOOT' : 'ATTACK'} />
        <span class="sweep" style={{ '--sweep': swingSweep }} />
        <span class="key">{keyLabel(side, 'attack')}</span>
        <span class="rim" />
      </div>
      {view.abilities.map((ability) => (
        <AbilitySlot key={ability.id} side={side} ability={ability} icon={icons.get(ability.id)} colour={view.resource.colour} flash={flashing(ability.action)} />
      ))}
    </div>
  );
}

function AbilitySlot({ side, ability, icon, colour, flash }: { side: 0 | 1; ability: AbilityView; icon: string | undefined; colour: string; flash: boolean }) {
  const cooling = ability.cooldown.remaining > 0 && ability.cooldown.total > 0;
  const onGcd = !cooling && ability.gcd > 0;
  const sweep = cooling ? ability.cooldown.remaining / ability.cooldown.total : onGcd ? ability.gcd / GCD_FRAMES : 0;
  const why = ability.blocked;
  const short = why !== undefined && why.startsWith('NOT ENOUGH');
  const far = why === 'OUT OF RANGE' || why === 'TOO CLOSE';
  const dim = why !== undefined && !short && !far && !cooling && why !== 'NOT READY';
  const cls = [
    'slot',
    ability.active ? 'active' : '',
    flash ? 'flash' : '',
    cooling ? 'cooling' : onGcd ? 'gcd' : '',
    short ? 'short' : '',
    far ? 'far' : '',
    dim ? 'dim' : '',
    ability.usable ? 'ready' : '',
  ].join(' ');
  const detail = [ability.cost > 0 ? `${ability.cost} ${colourName(colour)}` : '', ability.castTime > 0 ? `${(ability.castTime / 60).toFixed(1)}s cast` : 'instant'].filter(Boolean).join(', ');
  const title = `${ability.name} (${detail})${why ? ` — ${why}` : ''}`;
  return (
    <div class={cls} title={title} style={{ '--power': colour }}>
      <Icon url={icon} name={ability.short} />
      <span class="sweep" style={{ '--sweep': sweep }} />
      {cooling && <span class="time">{seconds(ability.cooldown.remaining)}</span>}
      <span class="key">{keyLabel(side, ability.action)}</span>
      {ability.cost > 0 && <span class="cost">{ability.cost}</span>}
      <span class="rim" />
    </div>
  );
}

/** The resource a cost is paid in, from its colour: the view carries the colour per fighter, not per ability. */
function colourName(colour: string): string {
  return { '#c41f3b': 'rage', '#fff569': 'energy', '#2f7df6': 'mana', '#ff8040': 'focus', '#00d1ff': 'runic power', '#c84bf0': 'fury' }[colour] ?? '';
}

/** The spell's picture, or its short name on the plain slot until the picture arrives. */
function Icon({ url, name }: { url: string | undefined; name: string }) {
  return url ? <img class="icon" src={url} alt="" draggable={false} /> : <span class="icon text">{name}</span>;
}
