import { transformPoint } from '@mogshot/math/mat4';
import { PLACE_VERTEX_SIZE, type PlaceScene } from '@mogshot/world/place';

/*
 * The floor under the stage line. The fight itself is flat (every fighter's feet are at z = 0
 * in the engine), but the world under them is not quite: the ground along the line is read from
 * the place once, and the fighters and their shadows are drawn that much higher or lower so that
 * nobody floats or sinks on a lawn that leans.
 */

/** Heights of the floor at `STEP`-yard steps from -SPAN to +SPAN along the stage line. */
export interface FloorProfile {
  span: number;
  step: number;
  heights: Float32Array;
}

const SPAN = 7;
const STEP = 0.25;
/** A surface is the floor only if it is within this of the spot's own ground: steps, not roofs or the inside of a wall. */
const FLOOR_BAND = 1.2;

/** Read the floor along y = 0 from a place's terrain and buildings. Props (trees, crates) are not floor. */
export function floorProfile(place: PlaceScene): FloorProfile {
  const count = Math.round((2 * SPAN) / STEP) + 1;
  const heights = new Float32Array(count);
  const found = new Uint8Array(count);
  const consider = (vertices: Uint8Array, indices: Uint16Array, transform: Float32Array) => {
    const view = new DataView(vertices.buffer, vertices.byteOffset, vertices.byteLength);
    const positions = new Float32Array(vertices.length / PLACE_VERTEX_SIZE * 3);
    for (let v = 0; v * PLACE_VERTEX_SIZE < vertices.length; v++) {
      const at = v * PLACE_VERTEX_SIZE;
      const p = transformPoint(transform, [view.getFloat32(at, true), view.getFloat32(at + 4, true), view.getFloat32(at + 8, true)]);
      positions[v * 3] = p[0];
      positions[v * 3 + 1] = p[1];
      positions[v * 3 + 2] = p[2];
    }
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const a = indices[i]! * 3;
      const b = indices[i + 1]! * 3;
      const c = indices[i + 2]! * 3;
      const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
      const bx = positions[b]!, by = positions[b + 1]!, bz = positions[b + 2]!;
      const cx = positions[c]!, cy = positions[c + 1]!, cz = positions[c + 2]!;
      // Off the line, or too far above or below the spot to be its floor.
      if (Math.min(ay, by, cy) > 0 || Math.max(ay, by, cy) < 0) continue;
      if (Math.min(ax, bx, cx) > SPAN || Math.max(ax, bx, cx) < -SPAN) continue;
      if (Math.min(az, bz, cz) > FLOOR_BAND || Math.max(az, bz, cz) < -FLOOR_BAND) continue;
      // A triangle seen edge-on from above is a wall, not a floor.
      const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(d) < 1e-9) continue;
      const from = Math.max(0, Math.ceil((Math.min(ax, bx, cx) + SPAN) / STEP));
      const to = Math.min(count - 1, Math.floor((Math.max(ax, bx, cx) + SPAN) / STEP));
      for (let k = from; k <= to; k++) {
        const x = -SPAN + k * STEP;
        const u = ((bx - ax) * (0 - ay) - (by - ay) * (x - ax)) / d;
        const v = ((x - ax) * (cy - ay) - (0 - ay) * (cx - ax)) / d;
        // Barycentric: p = a + v*(b-a) + u*(c-a) with the determinant above.
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const z = az + v * (bz - az) + u * (cz - az);
        if (Math.abs(z) > FLOOR_BAND) continue;
        if (!found[k] || z > heights[k]!) {
          heights[k] = z;
          found[k] = 1;
        }
      }
    }
  };
  for (const mesh of place.terrain) consider(mesh.vertices, mesh.indices, mesh.transform);
  for (const mesh of place.meshes) consider(mesh.vertices, mesh.indices, mesh.transform);
  // Where nothing was found (a gap, the edge of the loaded ground) the nearest known height carries over.
  let last = 0;
  for (let k = 0; k < count; k++) {
    if (found[k]) last = heights[k]!;
    else heights[k] = last;
  }
  for (let k = count - 1, next = heights[count - 1]!; k >= 0; k--) {
    if (found[k]) next = heights[k]!;
    else heights[k] = next;
  }
  return { span: SPAN, step: STEP, heights };
}

/** The floor's height at x along the stage line, between samples. */
export function floorAt(profile: FloorProfile | undefined, x: number): number {
  if (!profile) return 0;
  const { span, step, heights } = profile;
  const t = Math.min(heights.length - 1, Math.max(0, (x + span) / step));
  const k = Math.floor(t);
  const a = heights[k]!;
  const b = heights[Math.min(heights.length - 1, k + 1)]!;
  return a + (b - a) * (t - k);
}
