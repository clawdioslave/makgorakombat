import { describe, expect, it } from 'vitest';
import type { Race } from '@mogshot/character/appearance';
import type { CreatureLook } from '@mogshot/worker/api';
import { factionOf, LEGENDS, type Legend, legendTiles } from '../../src/game/roster';

const race = (id: number, name: string): Race => ({ id, name, key: name.toLowerCase(), file: name, faction: 'alliance', order: id, sexes: [0, 1] } as unknown as Race);
const RACES = [race(4, 'Night Elf'), race(2, 'Orc')];

const tyrande: Legend = { slug: 'tyrande', name: 'Tyrande', title: 'High Priestess', faction: 'alliance', displays: [39620, 7274] };
const thrall: Legend = { slug: 'thrall', name: 'Thrall', title: 'Warchief', faction: 'horde', displays: [19015, 4527] };
const jaina: Legend = { slug: 'jaina', name: 'Jaina', title: 'Lady', faction: 'alliance', displays: [87892] };

describe('legend tiles', () => {
  it('takes the first display the folder has on a player model', () => {
    const looks: CreatureLook[] = [
      { id: 39620, scale: 1.4 }, // a model of its own: cannot be a fighter
      { id: 7274, scale: 1, humanoid: { raceId: 4, sex: 1 } },
      { id: 4527, scale: 1.2, humanoid: { raceId: 2, sex: 0 } },
    ];
    const tiles = legendTiles([tyrande, thrall, jaina], looks, RACES);
    expect(tiles.map((t) => t.id)).toEqual(['legend:tyrande', 'legend:thrall']);
    const [t, th] = tiles;
    expect(t?.kind === 'legend' && [t.displayId, t.raceId, t.sex, t.race?.name]).toEqual([7274, 4, 1, 'Night Elf']);
    expect(th?.kind === 'legend' && [th.displayId, th.raceId, th.sex]).toEqual([4527, 2, 0]);
  });

  it('keeps a legend whose race the roster does not list', () => {
    const tiles = legendTiles([tyrande], [{ id: 7274, scale: 1, humanoid: { raceId: 99, sex: 1 } }], RACES);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]?.kind === 'legend' && tiles[0].race).toBeUndefined();
  });

  it('colours a legend by its own faction', () => {
    const [tile] = legendTiles([thrall], [{ id: 4527, scale: 1.2, humanoid: { raceId: 2, sex: 0 } }], RACES);
    expect(tile && factionOf(tile)).toBe('horde');
  });

  it('lists each legend once, with a display or a note saying why there is none', () => {
    expect(new Set(LEGENDS.map((l) => l.slug)).size).toBe(LEGENDS.length);
    for (const legend of LEGENDS) expect(legend.displays.length > 0 || !!legend.note, legend.slug).toBe(true);
    expect(LEGENDS.filter((l) => l.displays.length > 0).length).toBeGreaterThanOrEqual(8);
  });

  it('gives a legend with no drawable look no tile', () => {
    expect(legendTiles([jaina], [], RACES)).toEqual([]);
  });
});
