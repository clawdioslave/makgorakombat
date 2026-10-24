import type { Image } from '@mogshot/formats/blp';

/** A decoded game picture (straight RGBA, rows top to bottom) as something an <img> can show. */
export function pictureUrl(image: Image): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  const pixels = new Uint8ClampedArray(image.width * image.height * 4);
  pixels.set(image.pixels.subarray(0, pixels.length));
  const data = new ImageData(pixels, image.width, image.height);
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

/** A rough hash of a string, for seeding a match from the champions' names. */
export function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}
