import type { ClassEntry, Race } from '@mogshot/character/appearance';
import type { ItemSetInfo, Slot } from '@mogshot/character/equipment';
import { posableRig, type PosableRig } from '@mogshot/model/posable';
import type { FighterResult } from '@mogshot/worker/api';
import type { DataClient } from '@mogshot/worker/client';
import { ALL_MOVE_NAMES, type MoveTable, resolveMoves } from '../engine/moves';
import type { Tile } from './roster';

/*
 * From a tile on the roster to a fighter in the ring: who to build (race, sex, class, gear),
 * the build itself in the worker, and the built fighter kept for the fight. Builds take a
 * second or so each, so the last few are kept while the players browse.
 */

/** Who a player has chosen, resolved to what the worker builds. */
export interface Champion {
  /** Stable key of the build, for the cache. */
  key: string;
  /** "NIGHT ELF" / "Scarletfire" and "DRUID". */
  name: string;
  title: string;
  race: Race;
  sex: number;
  classId: number | undefined;
  choices: [number, number][];
  gear: [Slot, number][];
}

export interface BuiltFighter {
  champion: Champion;
  result: FighterResult;
  rig: PosableRig;
  moves: MoveTable;
}

const KEEP = 8;

export class Fighters {
  private readonly built = new Map<string, Promise<BuiltFighter>>();
  private readonly sets = new Map<number, Promise<ItemSetInfo[]>>();

  constructor(private readonly client: DataClient, private readonly classes: readonly ClassEntry[]) {}

  /** The champion a tile stands for with the player's sex and class choices applied. */
  async champion(tile: Tile, sex: number, classId: number | undefined): Promise<Champion | undefined> {
    if (tile.kind === 'random') return undefined;
    const className = (id: number | undefined) => this.classes.find((c) => c.id === id)?.name.toUpperCase() ?? '';
    if (tile.kind === 'record') {
      const imported = await this.client.resolveImport(tile.record);
      return {
        key: `record:${tile.record.key}`,
        name: tile.record.name.toUpperCase(),
        title: `${tile.race.name.toUpperCase()} ${className(imported.classId ?? tile.record.classId)}`.trim(),
        race: tile.race,
        sex: imported.sex,
        classId: imported.classId ?? tile.record.classId,
        choices: imported.choices,
        gear: imported.gear.map(([slot, item]) => [slot, item.id]),
      };
    }
    const gear = classId === undefined ? [] : await this.bestKit(classId);
    return {
      key: `race:${tile.race.id}:${sex}:${classId ?? 0}`,
      name: tile.race.name.toUpperCase(),
      title: className(classId),
      race: tile.race,
      sex,
      classId,
      choices: [],
      gear,
    };
  }

  /** The class's best set, with weapons to match, as item ids by slot. */
  private async bestKit(classId: number): Promise<[Slot, number][]> {
    let sets = this.sets.get(classId);
    if (!sets) this.sets.set(classId, (sets = this.client.sets(classId)));
    const list = await sets;
    const best = list.reduce<ItemSetInfo | undefined>((top, set) => (top === undefined || set.level > top.level ? set : top), undefined);
    if (!best) return [];
    return [...best.pieces, ...best.weapons].map(([slot, item]) => [slot, item.id]);
  }

  /** Build the champion, or hand back the one built before. */
  get(champion: Champion): Promise<BuiltFighter> {
    let fighter = this.built.get(champion.key);
    if (!fighter) {
      fighter = this.client.fighter(champion.race.id, champion.sex, champion.choices, champion.gear, [...ALL_MOVE_NAMES]).then((result) => {
        const rig = posableRig(result.rig);
        if (rig.meshCount !== result.scene.meshes.length) throw new Error(`The fighter's rig has ${rig.meshCount} meshes for ${result.scene.meshes.length} in the scene`);
        return { champion, result, rig, moves: resolveMoves(result.scene.animations, result.wielding) };
      });
      fighter.catch(() => this.built.delete(champion.key));
      this.built.set(champion.key, fighter);
      // Keep the last few only: each is tens of megabytes.
      while (this.built.size > KEEP) {
        const oldest = this.built.keys().next().value;
        if (oldest === undefined) break;
        this.built.delete(oldest);
      }
    } else {
      // Touched: it goes to the back of the line.
      this.built.delete(champion.key);
      this.built.set(champion.key, fighter);
    }
    return fighter;
  }
}
