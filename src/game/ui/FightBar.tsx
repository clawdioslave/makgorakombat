import { GCD_FRAMES } from '../../engine/abilities';
import { keyLabel } from '../../engine/input';
import type { AbilityView, FighterView } from '../../engine/view';
import { seconds } from './UnitFrame';

/*
 * A player's action bar as the game lays its buttons out: square slots with the spell's own
 * icon, the key in the corner, a clockwise cooldown sweep with the seconds left, a quick sweep
 * for the global cooldown, the icon greyed while it cannot go and tinted blue when the resource
 * is short, a gold glow while the ability is in use. The first slot is the auto-attack, with the
 * swing timer sweeping round it.
 */

export interface FightBarProps {
  side: 0 | 1;
  view: FighterView;
  /** Icons by ability id; 'attack' for the auto-attack. */
  icons: ReadonlyMap<string, string>;
  /** Ranged weapons shoot instead of swinging. */
  ranged: boolean;
}

export function FightBar({ side, view, icons, ranged }: FightBarProps) {
  const swing = view.swing;
  const swingSweep = swing.total > 0 ? Math.min(1, swing.remaining / swing.total) : 0;
  return (
    <div class={`fightbar p${side + 1}`}>
      <div class={`slot auto ${swing.auto ? 'on' : ''}`} title={ranged ? 'Auto Shot' : 'Attack'}>
        <Icon url={icons.get('attack')} name={ranged ? 'SHOOT' : 'ATTACK'} />
        <span class="sweep" style={{ '--sweep': swingSweep }} />
        <span class="key">{keyLabel(side, 'attack')}</span>
        <span class="rim" />
      </div>
      {view.abilities.map((ability) => (
        <AbilitySlot key={ability.id} side={side} ability={ability} icon={icons.get(ability.id)} colour={view.resource.colour} />
      ))}
    </div>
  );
}

function AbilitySlot({ side, ability, icon, colour }: { side: 0 | 1; ability: AbilityView; icon: string | undefined; colour: string }) {
  const cooling = ability.cooldown.remaining > 0 && ability.cooldown.total > 0;
  const sweep = cooling ? ability.cooldown.remaining / ability.cooldown.total : ability.gcd > 0 ? ability.gcd / GCD_FRAMES : 0;
  const why = ability.blocked;
  const short = why !== undefined && why.startsWith('NOT ENOUGH');
  const far = why === 'OUT OF RANGE' || why === 'TOO CLOSE';
  const locked = why === 'NEEDS 20% HEALTH' || why === 'NOT NOW';
  const cls = ['slot', ability.active ? 'active' : '', cooling ? 'cooling' : ability.gcd > 0 ? 'gcd' : '', short ? 'short' : '', far ? 'far' : '', locked ? 'locked' : '', ability.usable ? 'ready' : ''].join(' ');
  return (
    <div class={cls} title={ability.name} style={{ '--power': colour }}>
      <Icon url={icon} name={ability.short} />
      <span class="sweep" style={{ '--sweep': sweep }} />
      {cooling && <span class="time">{seconds(ability.cooldown.remaining)}</span>}
      <span class="key">{keyLabel(side, ability.action)}</span>
      {ability.cost > 0 && <span class="cost">{ability.cost}</span>}
      <span class="rim" />
    </div>
  );
}

/** The spell's picture, or its short name on the plain slot until the picture arrives. */
function Icon({ url, name }: { url: string | undefined; name: string }) {
  return url ? <img class="icon" src={url} alt="" draggable={false} /> : <span class="icon text">{name}</span>;
}
