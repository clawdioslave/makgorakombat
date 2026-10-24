import type { CharacterScene, PoseResult } from '@mogshot/character/scene';
import { multiply } from '@mogshot/math/mat4';

export interface MergedPart {
  /** Index of this scene's first mesh in the merged scene, and how many. */
  meshStart: number;
  meshCount: number;
  /** What was added to this scene's texture indices. */
  textureStart: number;
}

export interface MergedScenes {
  scene: CharacterScene;
  parts: MergedPart[];
}

type Bounds = CharacterScene['bounds'];

function unionBounds(all: readonly Bounds[]): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of all) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, b.min[k]!);
      max[k] = Math.max(max[k]!, b.max[k]!);
    }
  }
  return { min, max };
}

/**
 * Several characters as one scene for one renderer: textures concatenated, every draw's texture
 * indices shifted, mesh buffers shared by reference, the originals untouched. Problems are prefixed
 * `P1:`, `P2:`... so they can still be told apart.
 */
export function mergeScenes(scenes: readonly CharacterScene[]): MergedScenes {
  const first = scenes[0];
  if (!first) throw new Error('mergeScenes: no scenes');
  const textures: CharacterScene['textures'] = [];
  const meshes: CharacterScene['meshes'] = [];
  const problems: string[] = [];
  const parts: MergedPart[] = [];
  scenes.forEach((scene, i) => {
    const textureStart = textures.length;
    textures.push(...scene.textures);
    parts.push({ meshStart: meshes.length, meshCount: scene.meshes.length, textureStart });
    for (const mesh of scene.meshes) {
      meshes.push({
        ...mesh,
        draws: mesh.draws.map((draw) => ({
          ...draw,
          textures: draw.textures.map((t) => (t < 0 ? -1 : t + textureStart)),
        })),
      });
    }
    for (const problem of scene.problems) problems.push(`P${i + 1}: ${problem}`);
  });
  const scene: CharacterScene = {
    meshes,
    textures,
    bounds: unionBounds(scenes.map((s) => s.bounds)),
    problems,
    options: [],
    choices: [],
    animations: [],
    presets: [],
    pose: { ...first.pose },
  };
  return { scene, parts };
}

/**
 * One pose for the merged scene: each part's posed meshes with that fighter's world matrix
 * premultiplied into every mesh transform. `poses[i]` is `rig_i.pose(...)` (one entry per mesh
 * of part i), `worlds[i]` its world matrix.
 */
export function mergedPose(
  parts: readonly MergedPart[],
  poses: readonly (readonly { bones: Float32Array; transform: Float32Array }[])[],
  worlds: readonly Float32Array[],
  bounds: Bounds,
): PoseResult {
  const meshes: PoseResult['meshes'] = [];
  parts.forEach((part, i) => {
    const posed = poses[i] ?? [];
    const world = worlds[i];
    for (let m = 0; m < part.meshCount; m++) {
      const mesh = posed[m];
      if (!mesh) continue;
      meshes.push({
        bones: mesh.bones,
        transform: world ? multiply(new Float32Array(16), world, mesh.transform) : mesh.transform,
      });
    }
  });
  return { meshes, bounds, pose: { sequence: 0, time: 0, duration: 0, preset: undefined } };
}
