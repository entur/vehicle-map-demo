import { LIGHT_POOL_REACH, LIGHT_POOL_WIDTH } from "../../domain/lightPool.ts";

/** Pixels per metre of road; the light is soft, so this can be coarse. */
const SCALE = 8;
const WIDTH = LIGHT_POOL_WIDTH * SCALE;
const HEIGHT = LIGHT_POOL_REACH * SCALE;
/** Warm white, like the headlight lamps themselves. */
const LIGHT = "255, 241, 200";
/** At the lamps; fades to nothing at the far end and the edges. */
const PEAK_ALPHA = 0.28;
/** Half the width the beam has at the lamps, as a share of the texture's. */
const NEAR_HALF_WIDTH = 0.09;

let texture: HTMLCanvasElement | null = null;

/**
 * The pool's texture: a wedge of warm light widening from the lamps at the
 * bottom row to the far end at the top, brightest at the lamps. Only its alpha
 * varies. Built once and shared, so deck.gl uploads it once.
 */
export function lightPoolTexture(): HTMLCanvasElement {
  if (texture) return texture;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT,
      0,
      WIDTH / 2,
      HEIGHT,
      HEIGHT,
    );
    gradient.addColorStop(0, `rgba(${LIGHT}, ${PEAK_ALPHA})`);
    gradient.addColorStop(0.5, `rgba(${LIGHT}, ${PEAK_ALPHA * 0.4})`);
    gradient.addColorStop(1, `rgba(${LIGHT}, 0)`);
    ctx.filter = `blur(${SCALE / 2}px)`;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(WIDTH * (0.5 - NEAR_HALF_WIDTH), HEIGHT);
    ctx.lineTo(WIDTH * (0.5 + NEAR_HALF_WIDTH), HEIGHT);
    ctx.lineTo(WIDTH - SCALE, SCALE);
    ctx.lineTo(SCALE, SCALE);
    ctx.closePath();
    ctx.fill();
  }
  texture = canvas;
  return canvas;
}
