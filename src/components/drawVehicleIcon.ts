import { EDGE_WHITE } from "../domain/dataColours.ts";

/** Pixels across a drawn icon: 2× the SVGs' 52px viewBox. */
export const VEHICLE_ICON_SIZE = 104;
/** Registered at this ratio, so an icon is 52 logical pixels across at icon-size 1. */
export const VEHICLE_ICON_PIXEL_RATIO = 2;

/** 2 logical px: the white half of the two-tone edge (dataColours.ts). */
const RING_WIDTH = 4;
const UNKNOWN_FILL = "#5b6272";
const UNKNOWN_DOT_RADIUS = 12;

/**
 * Draws one vehicle icon: the SVG (or, for `null`, the generic grey disc with
 * a white dot) clipped to its circle — which removes the files' white square
 * background — then a white ring, without which the dark mode fills vanish
 * against the dark base map.
 */
export function drawVehicleIcon(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  size: number = VEHICLE_ICON_SIZE,
): void {
  const centre = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, centre, 0, Math.PI * 2);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, 0, 0, size, size);
  } else {
    ctx.fillStyle = UNKNOWN_FILL;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(centre, centre, UNKNOWN_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(centre, centre, centre - RING_WIDTH / 2, 0, Math.PI * 2);
  ctx.lineWidth = RING_WIDTH;
  ctx.strokeStyle = EDGE_WHITE;
  ctx.stroke();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(VEHICLE_ICON_SIZE, VEHICLE_ICON_SIZE);
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Could not load vehicle icon ${url}`));
    image.src = url;
  });
}

/**
 * A vehicle icon as map image data. SVGs go through an HTMLImageElement and a
 * canvas because MapLibre's loadImage does not reliably decode SVG.
 */
export async function vehicleIconImageData(
  url: string | null,
): Promise<ImageData> {
  const canvas = document.createElement("canvas");
  canvas.width = VEHICLE_ICON_SIZE;
  canvas.height = VEHICLE_ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context for vehicle icons");
  drawVehicleIcon(ctx, url ? await loadImage(url) : null);
  return ctx.getImageData(0, 0, VEHICLE_ICON_SIZE, VEHICLE_ICON_SIZE);
}
