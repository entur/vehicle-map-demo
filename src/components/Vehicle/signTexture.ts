import { SIGN_TEXTURE_ASPECT } from "../../domain/vehicleMeshes.ts";

type RGB = [number, number, number];

const HEIGHT = 96;
const WIDTH = HEIGHT * SIGN_TEXTURE_ASPECT;
/** The unlit display behind the text. */
const BACKGROUND = "#141414";
/** Clear background at each end and above and below, which the mesh's out-of-range texture coordinates clamp to. */
const MARGIN_X = 16;
const FONT_SIZE = 60;
/** How far a long destination is condensed before it is set smaller instead. */
const MIN_CONDENSE = 0.7;
const FONT_FAMILY = '"Helvetica Neue", Arial, sans-serif';
/** Enough for every destination in view many times over; beyond it the oldest is dropped. */
const MAX_CACHED = 256;

const cache = new Map<string, HTMLCanvasElement>();

/**
 * A destination sign's texture: the text lit in `colour` on a dark display,
 * condensed and then set smaller as it gets long, with a blank margin all
 * round. Cached by text and colour, so a layer keeps the same canvas from
 * frame to frame and deck.gl does not upload it again.
 */
export function signTexture(text: string, colour: RGB): HTMLCanvasElement {
  const key = `${colour.join(",")}|${text}`;
  const cached = cache.get(key);
  if (cached) {
    // Refresh its place, so the oldest-used is what gets dropped.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (text) {
      ctx.font = `bold ${FONT_SIZE}px ${FONT_FAMILY}`;
      const fit = (WIDTH - 2 * MARGIN_X) / ctx.measureText(text).width;
      const condense = Math.min(1, Math.max(fit, MIN_CONDENSE));
      const size = FONT_SIZE * Math.min(1, fit / condense);
      ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      ctx.fillStyle = `rgb(${colour.join(",")})`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.setTransform(condense, 0, 0, 1, WIDTH / 2, HEIGHT / 2);
      ctx.fillText(text, 0, 0);
    }
  }

  cache.set(key, canvas);
  if (cache.size > MAX_CACHED) {
    cache.delete(cache.keys().next().value!);
  }
  return canvas;
}
