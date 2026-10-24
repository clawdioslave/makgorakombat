import type { Ability, ResourceKind } from '../../engine/abilities';
import type { Weapon } from '../../engine/moves';

/*
 * The words of a tooltip, as the game's spell tooltips put them: the cost in the top right,
 * the range on the next line, the cast time on the left and the cooldown on the right, then
 * a sentence saying what the ability does, built from its numbers.
 */

export interface Tooltip {
  name: string;
  /** "30 Rage", or '' when free. */
  cost: string;
  /** "Melee Range", "8 yd range". */
  range: string;
  /** "Instant", "1.5 sec cast". */
  cast: string;
  /** "6 sec cooldown", or ''. */
  cooldown: string;
  description: string;
}

const RESOURCE_WORDS: Record<ResourceKind, string> = { rage: 'Rage', energy: 'Energy', mana: 'Mana', focus: 'Focus', runic: 'Runic Power', fury: 'Fury' };

const sec = (frames: number): string => {
  const s = frames / 60;
  return `${Number.isInteger(s) ? s : s.toFixed(1)} sec`;
};

export function describeAbility(a: Ability, resource: ResourceKind): Tooltip {
  const melee = a.kind === 'melee' || (a.kind === 'self' && a.range <= 2.5) || a.kind === 'blink' || a.kind === 'leap';
  const parts: string[] = [];
  switch (a.kind) {
    case 'charge':
      parts.push(`Charges the target${a.damage ? `, dealing ${a.damage} damage` : ''}`);
      break;
    case 'rush':
      parts.push(`Rushes forward${a.damage ? `, dealing ${a.damage} damage to whoever is in the way` : ''}`);
      break;
    case 'bolt':
      parts.push(`Hurls a bolt that deals ${a.damage} damage; it can be jumped over`);
      break;
    case 'blink':
      parts.push('Teleports you a short distance away from the target');
      break;
    case 'leap':
      parts.push('Leaps backwards, out of reach');
      break;
    case 'melee':
      parts.push(a.both ? `Strikes on both sides for ${a.damage} damage` : `Strikes the target for ${a.damage} damage`);
      break;
    case 'spell':
      if (a.damage) parts.push(`Deals ${a.damage} damage`);
      break;
    case 'self':
      break;
  }
  if (a.dot) parts.push(`${parts.length ? 'and ' : 'Deals '}${a.dot.damage} damage every 3 sec for ${sec(a.dot.ticks * 180)}`);
  if (a.stun) parts.push(`${parts.length ? 'and stuns' : 'Stuns'} the target for ${sec(a.stun)}`);
  if (a.slow) parts.push(`${parts.length ? 'and slows' : 'Slows'} the target for ${sec(a.slow)}`);
  if (a.fear) parts.push(`${parts.length ? 'and sends' : 'Sends'} the target fleeing for ${sec(a.fear)}`);
  if (a.interrupt) parts.push(`${parts.length ? 'and interrupts' : 'Interrupts'} the target's cast`);
  if (a.heal) parts.push(`${parts.length ? 'and heals' : 'Heals'} you for ${a.heal}`);
  if (a.absorb) parts.push(`${parts.length ? 'and shields' : 'Shields'} you, absorbing ${a.absorb} damage`);
  if (a.evasion) parts.push(`${parts.length ? 'and raises' : 'Raises'} your chance to dodge for ${sec(a.evasion)}`);
  if (a.gain) parts.push(`${parts.length ? 'and generates' : 'Generates'} ${a.gain} ${RESOURCE_WORDS[resource]}`);
  let description = parts.join(' ');
  if (description) description += '.';
  if (a.execute) description += ' Only usable on a target below 20% health.';
  const range = melee ? 'Melee Range' : a.minRange > 0 ? `${a.minRange} – ${a.range} yd range` : `${a.range} yd range`;
  return {
    name: a.name,
    cost: a.cost > 0 ? `${a.cost} ${RESOURCE_WORDS[resource]}` : '',
    range: a.kind === 'self' || a.kind === 'blink' || a.kind === 'leap' ? '' : range,
    cast: a.cast > 0 ? `${sec(a.cast)} cast` : 'Instant',
    cooldown: a.cooldown > 0 ? `${sec(a.cooldown)} cooldown` : '',
    description: description.trim(),
  };
}

/** The auto-attack's tooltip. */
export function describeWeapon(weapon: Weapon): Tooltip {
  const shots = weapon.ranged;
  return {
    name: shots ? 'Auto Shot' : 'Attack',
    cost: '',
    range: shots ? `${weapon.range} yd range` : 'Melee Range',
    cast: `Every ${sec(weapon.speed)}`,
    cooldown: '',
    description: `${shots ? 'Shoots' : 'Swings'} at the target for ${weapon.damage} damage whenever it is in reach. Hold the key to keep ${shots ? 'shooting' : 'swinging'}; a tap ${shots ? 'shoots' : 'swings'} once.${weapon.shield ? ' Your shield blocks some blows from the front.' : ''}`,
  };
}
