import type { CharacterScene, SceneMesh, SceneTexture } from '@mogshot/character/scene';
import { transformPoint } from '@mogshot/math/mat4';
import { describe, expect, it } from 'vitest';
import { mergedPose, mergeScenes } from '../../src/engine/merge';
import { STAGE_BOX, worldMatrix } from '../../src/engine/stage';

function texture(seed: number): SceneTexture {
  return { width: 1, height: 1, pixels: new Uint8Array([seed, 0, 0, 255]), wrapX: false, wrapY: false };
}

function mesh(textures: number[][]): SceneMesh {
  return {
    vertices: new Uint8Array(48),
    indices: new Uint16Array([0, 0, 0]),
    bones: new Float32Array(16),
    transform: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    billboards: [],
    draws: textures.map((t, i) => ({
      sectionId: i, indexStart: 0, indexCount: 3, shaderId: 0, textureCount: t.length, blendMode: 0,
      materialFlags: 0, priority: 0, layer: 0, textures: t,
    })),
  };
}

function scene(textureCount: number, meshes: SceneMesh[], bounds: CharacterScene['bounds'], problems: string[] = []): CharacterScene {
  return {
    meshes,
    textures: Array.from({ length: textureCount }, (_, i) => texture(i)),
    bounds,
    problems,
    options: [],
    choices: [],
    animations: [],
    presets: [],
    pose: { sequence: 0, time: 0, duration: 1000, preset: 'Stand' },
  };
}

describe('mergeScenes', () => {
  const a = scene(2, [mesh([[0, 1]])], { min: [-1, -1, 0], max: [1, 1, 2] }, ['helm missing']);
  const b = scene(3, [mesh([[0, -1, 2]]), mesh([[1]])], { min: [-0.5, -2, 0], max: [3, 0.5, 2.5] }, ['sword']);
  const merged = mergeScenes([a, b]);

  it('concatenates the textures and re-indexes the draws', () => {
    expect(merged.scene.textures.length).toBe(5);
    expect(merged.scene.textures[2]).toBe(b.textures[0]);
    expect(merged.scene.meshes.length).toBe(3);
    expect(merged.scene.meshes[0]?.draws[0]?.textures).toEqual([0, 1]);
    expect(merged.scene.meshes[1]?.draws[0]?.textures).toEqual([2, -1, 4]);
    expect(merged.scene.meshes[2]?.draws[0]?.textures).toEqual([3]);
  });

  it('leaves the originals untouched and shares the buffers', () => {
    expect(b.meshes[0]?.draws[0]?.textures).toEqual([0, -1, 2]);
    expect(a.meshes[0]?.draws[0]?.textures).toEqual([0, 1]);
    expect(merged.scene.meshes[1]?.vertices).toBe(b.meshes[0]?.vertices);
    expect(merged.scene.meshes[1]?.indices).toBe(b.meshes[0]?.indices);
    expect(merged.scene.meshes[1]).not.toBe(b.meshes[0]);
  });

  it('records where each scene starts', () => {
    expect(merged.parts).toEqual([
      { meshStart: 0, meshCount: 1, textureStart: 0 },
      { meshStart: 1, meshCount: 2, textureStart: 2 },
    ]);
  });

  it('takes the union of the bounds and prefixes the problems', () => {
    expect(merged.scene.bounds).toEqual({ min: [-1, -2, 0], max: [3, 1, 2.5] });
    expect(merged.scene.problems).toEqual(['P1: helm missing', 'P2: sword']);
  });
});

describe('worldMatrix', () => {
  it('moves a fighter facing +X without turning it', () => {
    const m = worldMatrix(-2.2, 0, 1);
    const near = (p: number[], q: number[]) => p.forEach((v, i) => expect(v).toBeCloseTo(q[i]!, 6));
    near(transformPoint(m, [1, 0, 0]), [-1.2, 0, 0]);
    near(transformPoint(m, [0, 0, 1.5]), [-2.2, 0, 1.5]);
  });

  it('turns a fighter facing -X half way round about Z', () => {
    const m = worldMatrix(2.2, 0.5, -1);
    const [x, y, z] = transformPoint(m, [1, 0.25, 1]);
    expect(x).toBeCloseTo(1.2, 6);
    expect(y).toBeCloseTo(-0.25, 6);
    expect(z).toBeCloseTo(1.5, 6);
  });
});

describe('mergedPose', () => {
  it('premultiplies each part with its world matrix and uses the stage bounds', () => {
    const parts = [
      { meshStart: 0, meshCount: 1, textureStart: 0 },
      { meshStart: 1, meshCount: 2, textureStart: 2 },
    ];
    const bones = new Float32Array(16);
    const own = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, 1]);
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const poses = [
      [{ bones, transform: identity }],
      [{ bones, transform: identity }, { bones, transform: own }],
    ];
    const worlds = [worldMatrix(-2.2, 0, 1), worldMatrix(2.2, 0, -1)];
    const pose = mergedPose(parts, poses, worlds, STAGE_BOX);
    expect(pose.meshes.length).toBe(3);
    expect(pose.bounds).toBe(STAGE_BOX);
    expect(pose.meshes[0]?.bones).toBe(bones);
    expect(transformPoint(pose.meshes[0]!.transform, [0, 0, 0])[0]).toBeCloseTo(-2.2, 6);
    // The held thing sits 0.5 ahead of P2, who faces -X: at x = 1.7.
    const [x] = transformPoint(pose.meshes[2]!.transform, [0, 0, 0]);
    expect(x).toBeCloseTo(1.7, 6);
  });
});
