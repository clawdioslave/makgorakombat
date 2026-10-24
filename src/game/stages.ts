import type { Image } from '@mogshot/formats/blp';
import type { LoadingScreen } from '@mogshot/worker/api';
import type { PlaceScene } from '@mogshot/world/place';

/*
 * The stages: spots in the game world, drawn around the fighters from the install's own map
 * files. A stage is a point and a direction: the fighters stand along the line through the spot
 * that runs the way `facing` points (P1 at the near end), and the camera looks across it, toward
 * facing + 90°, so the backdrop is whatever lies that way. Coordinates are the game's own: x north,
 * y west, in yards, as `/mogshot spot` prints them.
 */

export interface Stage {
  slug: string;
  name: string;
  /** Where it is, in a word, for the strip. */
  where: string;
  /** The game's map id: 0 Eastern Kingdoms, 1 Kalimdor, 530 Outland, 571 Northrend. */
  map: number;
  x: number;
  y: number;
  /** Height of the floor, to pick a storey; without it, the highest surface at the spot. */
  z?: number;
  /** Degrees anticlockwise from north: the stage line runs this way, the camera looks toward facing + 90°. */
  facing: number;
  /** How far the world is drawn around the spot, in yards. */
  reach: number;
  /** Why this spot. */
  why: string;
}

/** How far a stage draws unless it says otherwise: enough for a skyline, little enough for 60 fps. */
export const REACH = 260;

export const STAGES: Stage[] = [
  { slug: 'gurubashi', name: 'Gurubashi Arena', where: 'Stranglethorn Vale', map: 0, x: -13215, y: 250, facing: 0, reach: REACH, why: 'The pit: the game\'s own fighting ring, the stands all round.' },
  { slug: 'valley-of-trials', name: 'The Valley of Trials', where: 'Durotar', map: 1, x: -605, y: -4240, facing: 0, reach: REACH, why: 'The ring of totems outside the Den, where every orc throws a first punch.' },
  { slug: 'crossroads', name: 'The Crossroads', where: 'The Barrens', map: 1, x: -456, y: -2652, facing: 315, reach: REACH, why: 'The square under the watchtower, Barrens sky behind.' },
  { slug: 'valley-of-heroes', name: 'The Valley of Heroes', where: 'Stormwind', map: 0, x: -8975, y: 503, facing: 127, reach: REACH, why: 'The bridge in from the gate, the city\'s blue roofs up the street.' },
  { slug: 'goldshire', name: 'Goldshire', where: 'Elwynn Forest', map: 0, x: -9400, y: 50, facing: 315, reach: REACH, why: 'The flowered lawn beside the Lion\'s Pride, where duels have been fought since 2004.' },
  { slug: 'sentinel-hill', name: 'Sentinel Hill', where: 'Westfall', map: 0, x: -10545, y: 1075, facing: 135, reach: REACH, why: 'Dry grass on the hill, the farmstead and the fields below.' },
  { slug: 'darnassus', name: 'The Gardens', where: 'Darnassus', map: 1, x: 9660, y: 2520, facing: 0, reach: REACH, why: 'Under the great tree, a canopy over the haze.' },
  { slug: 'thunder-bluff', name: 'Thunder Bluff', where: 'Mulgore', map: 1, x: -1300, y: 30, facing: 0, reach: REACH, why: 'The high rise: tents, totems and a drop on every side.' },
  { slug: 'dalaran', name: 'Dalaran', where: 'Northrend', map: 571, x: 5805, y: 628, z: 650, facing: 90, reach: REACH, why: 'The floating city at street level, violet towers over the fight.' },
  { slug: 'icecrown', name: 'The Gate of Icecrown', where: 'Icecrown Citadel', map: 571, x: 5786, y: 2070, facing: 45, reach: REACH, why: 'The black ramp up to the Lich King\'s door, saronite spikes in the haze.' },
];

/** The stages an install can draw: those whose map it has on disk. */
export function stagesFor(maps: readonly number[]): Stage[] {
  return STAGES.filter((stage) => maps.includes(stage.map));
}

/** The thumbnail shipped for a stage, rendered once through Mogshot's command line. */
export function thumbnailUrl(stage: Stage): string {
  return `${import.meta.env.BASE_URL}stages/${stage.slug}.jpg`;
}

/** What the fight stands on: a place in the world, or one of the loading screens, or nothing. */
export interface Ground {
  stage?: Stage;
  place?: PlaceScene;
  screen?: LoadingScreen;
  image?: Image;
}

/** Radians anticlockwise from north, as the worker takes them. */
export function facingRadians(stage: Stage): number {
  return (stage.facing * Math.PI) / 180;
}
