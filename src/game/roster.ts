import type { ClassEntry, Race } from '@mogshot/character/appearance';
import type { ImportedRecord } from '@mogshot/import/record';

/*
 * The roster: every race the game lets you create, one tile each, in the character creation
 * screen's order with the Alliance first, then the neutral races, then the Horde; a random
 * tile; and, above them, the player's own characters as the Mogshot addon captured them.
 */

export type Tile =
  | { kind: 'race'; id: string; race: Race }
  | { kind: 'record'; id: string; race: Race; record: ImportedRecord }
  | { kind: 'random'; id: 'random' };

const FACTION_ORDER = { alliance: 0, neutral: 1, unknown: 1, horde: 2 } as const;

export function rosterTiles(races: readonly Race[]): Tile[] {
  const sorted = [...races].sort((a, b) => FACTION_ORDER[a.faction] - FACTION_ORDER[b.faction] || a.order - b.order || a.name.localeCompare(b.name));
  return [...sorted.map((race): Tile => ({ kind: 'race', id: `race:${race.id}`, race })), { kind: 'random', id: 'random' }];
}

/** The player's characters that are of a race the roster has, newest capture first as the addon lists them. */
export function championTiles(records: readonly ImportedRecord[], races: readonly Race[]): Tile[] {
  const tiles: Tile[] = [];
  for (const record of records) {
    const race = races.find((r) => r.id === record.raceId) ?? races.find((r) => r.file.toLowerCase() === record.race.toLowerCase());
    if (race) tiles.push({ kind: 'record', id: `record:${record.key}`, race, record });
  }
  return tiles;
}

/** The classes a race can be, in the game's order. */
export function classesOf(race: Race, classes: readonly ClassEntry[]): ClassEntry[] {
  return classes.filter((c) => c.races.includes(race.id));
}

/** The class next to `classId` among those a race can be, wrapping; the first when the class is not one of them. */
export function cycleClass(race: Race, classes: readonly ClassEntry[], classId: number | undefined, step: 1 | -1): number | undefined {
  const allowed = classesOf(race, classes);
  if (allowed.length === 0) return undefined;
  const at = allowed.findIndex((c) => c.id === classId);
  if (at < 0) return allowed[0]!.id;
  return allowed[(at + step + allowed.length) % allowed.length]!.id;
}

/** A sex the race has a model for, keeping the player's choice when it has both. */
export function sexFor(race: Race, wanted: number): number {
  return race.sexes.includes(wanted) ? wanted : (race.sexes[0] ?? 0);
}

/** A tile other than the random one, chosen with a step of the match's generator so a rematch can differ. */
export function randomTile(tiles: readonly Tile[], draw: () => number): Tile | undefined {
  const picks = tiles.filter((tile) => tile.kind !== 'random');
  if (picks.length === 0) return undefined;
  return picks[Math.floor(draw() * picks.length) % picks.length];
}

/** The grid position of a tile index in a grid `columns` wide. */
export const gridMove = (index: number, count: number, columns: number, dx: number, dy: number): number => {
  if (count === 0) return 0;
  const rows = Math.ceil(count / columns);
  let row = Math.floor(index / columns);
  let column = index % columns;
  column = (column + dx + columns) % columns;
  row = (row + dy + rows) % rows;
  let next = row * columns + column;
  // Off the end of a short last row: come round to its start, or back up a row.
  if (next >= count) next = dy !== 0 ? row * columns : count - 1;
  return next;
};
