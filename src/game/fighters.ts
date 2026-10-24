import type { ClassEntry } from '@mogshot/character/appearance';
import type { ItemSetInfo, Slot } from '@mogshot/character/equipment';
import { posableRig, type PosableRig } from '@mogshot/model/posable';
import type { FighterResult, FightSoundSet } from '@mogshot/worker/api';
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
  /** "NIGHT ELF" / "Scarletfire" / "TYRANDE WHISPERWIND" and "DRUID" / "HIGH PRIESTESS OF ELUNE". */
  name: string;
  title: string;
  raceId: number;
  sex: number;
  classId: number | undefined;
  choices: [number, number][];
  gear: [Slot, number][];
  /** A legend: the creature display the worker builds as the game draws it; raceId and sex are then its. */
  npc?: number;
}

export interface BuiltFighter {
  champion: Champion;
  result: FighterResult;
  rig: PosableRig;
  moves: MoveTable;
  /** The fighter's sounds, read after the build; undefined when they could not be. */
  sounds: Promise<FightSoundSet | undefined>;
}

const KEEP = 8;

export class Fighters {
  private readonly built = new Map<string, Promise<BuiltFighter>>();
  private readonly sets = new Map<number, Promise<ItemSetInfo[]>>();

  constructor(private readonly client: DataClient, private readonly classes: readonly ClassEntry[]) {}

  /** The champion a tile stands for with the player's sex and class choices applied. */
  async champion(tile: Tile, sex: number, classId: number | undefined): Promise<Champion | undefined> {
    if (tile.kind === 'random') return undefined;
    if (tile.kind === 'legend') {
      return {
        key: `legend:${tile.legend.slug}:${tile.displayId}`,
        name: tile.legend.name.toUpperCase(),
        title: tile.legend.title.toUpperCase(),
        raceId: tile.raceId,
        sex: tile.sex,
        classId: undefined,
        choices: [],
        // The display's hands are empty: the legend's signature weapon goes in them.
        gear: Object.entries(tile.legend.weapons ?? {}).flatMap(([slot, id]) => (id ? [[slot as Slot, id] as [Slot, number]] : [])),
        npc: tile.displayId,
      };
    }
    const className = (id: number | undefined) => this.classes.find((c) => c.id === id)?.name.toUpperCase() ?? '';
    if (tile.kind === 'record') {
      const imported = await this.client.resolveImport(tile.record);
      return {
        key: `record:${tile.record.key}`,
        name: tile.record.name.toUpperCase(),
        title: `${tile.race.name.toUpperCase()} ${className(imported.classId ?? tile.record.classId)}`.trim(),
        raceId: tile.race.id,
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
      raceId: tile.race.id,
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
      fighter = this.client.fighter(champion.raceId, champion.sex, champion.choices, champion.gear, [...ALL_MOVE_NAMES], champion.npc).then((result) => {
        const rig = posableRig(result.rig);
        if (rig.meshCount !== result.scene.meshes.length) throw new Error(`The fighter's rig has ${rig.meshCount} meshes for ${result.scene.meshes.length} in the scene`);
        if (result.scene.problems.length > 0) console.warn(`${champion.name}: ${result.scene.problems.join('; ')}`);
        // The weapon's own swing and impact come from the main hand; the voice from the race and sex built.
        const mainHand = champion.gear.find(([slot]) => slot === 'mainHand')?.[1];
        const sounds = this.client
          .sounds(champion.raceId, champion.sex, champion.classId, mainHand, result.wielding)
          .catch((error: unknown) => {
            console.warn(`${champion.name} has no sound:`, error);
            return undefined;
          });
        return { champion, result, rig, moves: resolveMoves(result.scene.animations, result.wielding), sounds };
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
