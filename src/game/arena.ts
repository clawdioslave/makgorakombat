import type { CharacterScene } from '@mogshot/character/scene';
import { CLASSIC_SCREEN_ASPECT, composeBackdrop } from '@mogshot/render/backdrop';
import { type Camera, CharacterRenderer, type Shadow } from '@mogshot/render/renderer';
import { mergedPose, mergeScenes } from '../engine/merge';
import { HALF, STAGE_BOX, worldMatrix } from '../engine/stage';
import type { BuiltFighter } from './fighters';
import { floorAt, type FloorProfile, floorProfile } from './ground';
import type { Ground } from './stages';

/*
 * The ring: two fighters drawn by one of Mogshot's renderers, each placed on the stage line
 * by a world matrix folded into its meshes' transforms, standing in a place read from the
 * game's map files, or, failing that, in front of one of its loading screens. The VS screen
 * and the fight both draw through this.
 */

export interface Placement {
  sequence: number;
  /** Milliseconds into the animation. */
  time: number;
  x: number;
  z: number;
  facing: 1 | -1;
}

/** Half the narrowest view, in yards: two fighters toe to toe fill about half the screen's height. */
const MIN_HALF = 2.9;
/** Room beyond the farther fighter, for a swing or a spell. */
const MARGIN = 1.6;
/** How much the distance blurs in a place: the fighters sharp, the skyline soft. */
const FOCUS = 0.35;

export class Arena {
  readonly renderer: CharacterRenderer;
  private parts: ReturnType<typeof mergeScenes>['parts'] = [];
  private merged: CharacterScene | undefined;
  private fighters: BuiltFighter[] = [];
  private ground: Ground = {};
  private floor: FloorProfile | undefined;
  private backdropSize = '';

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new CharacterRenderer(canvas);
    this.renderer.setFocus(FOCUS);
  }

  setFighters(fighters: BuiltFighter[]): void {
    this.fighters = fighters;
    const merged = mergeScenes(fighters.map((f) => f.result.scene));
    this.merged = merged.scene;
    this.parts = merged.parts;
    this.renderer.setScene(merged.scene);
    this.renderer.holdFraming(STAGE_BOX);
  }

  /** What the fighters stand in: a place in the world (drawn around them), a loading screen behind them, or nothing. */
  setGround(ground: Ground): void {
    this.ground = ground;
    this.backdropSize = '';
    this.floor = ground.place ? floorProfile(ground.place) : undefined;
    this.renderer.setPlace(ground.place);
    if (ground.place) this.renderer.setBackdrop(undefined);
  }

  /** The floor's height under x on the stage line, as drawn: 0 on a loading screen. */
  floorAt(x: number): number {
    return floorAt(this.floor, x);
  }

  /** Match the canvas to its box on screen in device pixels; true when its size changed. */
  fit(): boolean {
    const { canvas } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  }

  /** The box the camera frames; it eases toward what `frame()` asks for so the view does not jump. */
  private framing = { cx: 0, half: 3.6 };

  /**
   * Frame the fighters as a fighting game does: the view follows their midpoint and widens as
   * they part, never narrower than a few yards and never past the stage. Call before draw().
   */
  frame(xs: readonly number[], ease = 0.12): void {
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const wantHalf = Math.min(HALF + 0.6, Math.max(MIN_HALF, (max - min) / 2 + MARGIN));
    const wantCx = Math.min(HALF + 0.6 - wantHalf, Math.max(-(HALF + 0.6) + wantHalf, (min + max) / 2));
    this.framing.cx += (wantCx - this.framing.cx) * ease;
    this.framing.half += (wantHalf - this.framing.half) * ease;
    const { cx, half } = this.framing;
    this.renderer.holdFraming({ min: [cx - half, STAGE_BOX.min[1], STAGE_BOX.min[2]], max: [cx + half, STAGE_BOX.max[1], STAGE_BOX.max[2]] });
  }

  /** Pose every fighter and draw the ring. */
  draw(placements: Placement[], camera: Camera): void {
    if (!this.merged) return;
    this.fit();
    const size = `${this.canvas.width}x${this.canvas.height}`;
    if (size !== this.backdropSize && !this.ground.place) {
      this.backdropSize = size;
      const { screen, image } = this.ground;
      const spec = screen && image ? ({ kind: 'screen', fileId: 0, blur: 0.15, vignette: 0.45 } as const) : ({ kind: 'colour', colour: '#0b0708', vignette: 0.6 } as const);
      this.renderer.setBackdrop(composeBackdrop(spec, this.canvas.width, this.canvas.height, image, screen && !screen.wide ? CLASSIC_SCREEN_ASPECT : undefined));
    }
    const poses = this.fighters.map((fighter, i) => {
      const place = placements[i]!;
      return fighter.rig.pose(place.sequence, place.time);
    });
    const worlds = placements.map((place) => worldMatrix(place.x, place.z + this.floorAt(place.x), place.facing));
    this.renderer.setPose(mergedPose(this.parts, poses, worlds, STAGE_BOX));
    if (this.ground.place) {
      // A disc of shade under each fighter, on the floor whether they stand on it or have jumped off it.
      const shadows: Shadow[] = placements.map((place, i) => {
        const { min, max } = this.fighters[i]!.result.scene.bounds;
        const radius = Math.max(max[0] - min[0], max[1] - min[1]) * 0.55;
        return { x: place.x, y: 0, z: this.floorAt(place.x), radius: radius * Math.max(0.5, 1 - place.z * 0.25) };
      });
      this.renderer.setShadows(shadows);
    }
    this.renderer.render(camera);
  }

  /** Canvas pixel of a world point, for drawing over the ring. */
  project(camera: Camera, point: readonly [number, number, number]): [number, number] | undefined {
    return this.renderer.project(camera, point);
  }
}
