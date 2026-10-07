import { EDGE_INK, EDGE_WHITE } from "../domain/dataColours.ts";
import { UNKNOWN_VEHICLE_COLOUR } from "../domain/vehicleIcons.ts";

/** Pixels across a drawn icon: 2× the SVGs' 52px viewBox. */
export const VEHICLE_ICON_SIZE = 104;
/** Registered at this ratio, so an icon is 52 logical pixels across at icon-size 1. */
export const VEHICLE_ICON_PIXEL_RATIO = 2;

/** 2 logical px: the white half of the two-tone edge (dataColours.ts). */
const RING_WIDTH = 4;
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
    ctx.fillStyle = UNKNOWN_VEHICLE_COLOUR;
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

/**
 * Pixels across the bearing arrow image. Drawn at the same pixel ratio as the
 * vehicle icons and centred on the same point, so at an equal icon-size the
 * arrow sits just outside the icon's circle at every zoom.
 */
export const BEARING_ARROW_SIZE = 200;

/** Device-pixel radii of the arrowhead, measured from the icon's centre. */
const ARROW_BASE_RADIUS = 56;
const ARROW_NOTCH_RADIUS = 65;
const ARROW_TIP_RADIUS = 90;
const ARROW_HALF_WIDTH = 24;
/** 2 logical px: the white outside of the two-tone edge. */
const ARROW_EDGE_WIDTH = 4;

/**
 * The arrowhead's outline, pointing up (north before icon-rotate), clear of
 * the icon's circle: tip, right barb, notch, left barb.
 */
export function bearingArrowPoints(
  size: number = BEARING_ARROW_SIZE,
): [x: number, y: number][] {
  const c = size / 2;
  return [
    [c, c - ARROW_TIP_RADIUS],
    [c + ARROW_HALF_WIDTH, c - ARROW_BASE_RADIUS],
    [c, c - ARROW_NOTCH_RADIUS],
    [c - ARROW_HALF_WIDTH, c - ARROW_BASE_RADIUS],
  ];
}

/**
 * Draws the bearing arrow: an ink arrowhead edged in white, the same two-tone
 * edge the other map marks carry, so it reads on both base maps.
 */
export function drawBearingArrow(
  ctx: CanvasRenderingContext2D,
  size: number = BEARING_ARROW_SIZE,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  bearingArrowPoints(size).forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = ARROW_EDGE_WIDTH * 2;
  ctx.strokeStyle = EDGE_WHITE;
  ctx.stroke();
  ctx.fillStyle = EDGE_INK;
  ctx.fill();
}

/** The bearing arrow as map image data. */
export function bearingArrowImageData(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = BEARING_ARROW_SIZE;
  canvas.height = BEARING_ARROW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context for the bearing arrow");
  drawBearingArrow(ctx);
  return ctx.getImageData(0, 0, BEARING_ARROW_SIZE, BEARING_ARROW_SIZE);
}

/**
 * Pixels across the follow badge image. Like the bearing arrow, drawn at the
 * icons' pixel ratio and centred on the vehicle, so at an equal icon-size the
 * badge sits on the icon's edge at every zoom.
 */
export const FOLLOW_BADGE_SIZE = 160;

/**
 * Device-pixel radius of the badge's ink disc: a bit over half the icon's
 * radius, so the glyph still reads at the icon's smallest size.
 */
export const FOLLOW_BADGE_RADIUS = 30;
/** 2.5 logical px: the white outside of the two-tone edge. */
const BADGE_EDGE_WIDTH = 5;
const GLYPH_RING_RADIUS = 12;
const GLYPH_TICK_END = 21;
const GLYPH_DOT_RADIUS = 5;
const GLYPH_LINE_WIDTH = 4.5;

/**
 * Where the badge is centred: on the icon's circle, at its top-right. The
 * line-code label only ever takes one of the icon's four sides, so a corner
 * stays clear of it.
 */
export function followBadgeCentre(
  size: number = FOLLOW_BADGE_SIZE,
): [x: number, y: number] {
  const c = size / 2;
  const offset = (VEHICLE_ICON_SIZE / 2) * Math.SQRT1_2;
  return [c + offset, c - offset];
}

/**
 * Draws the follow badge: an ink disc edged in white, like the other map
 * marks, holding the Follow button's crosshair in white. Neutral rather than
 * a data colour: following is a state of the view, not something the feed
 * says.
 */
export function drawFollowBadge(
  ctx: CanvasRenderingContext2D,
  size: number = FOLLOW_BADGE_SIZE,
): void {
  const [x, y] = followBadgeCentre(size);
  ctx.beginPath();
  ctx.arc(x, y, FOLLOW_BADGE_RADIUS + BADGE_EDGE_WIDTH, 0, Math.PI * 2);
  ctx.fillStyle = EDGE_WHITE;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, FOLLOW_BADGE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = EDGE_INK;
  ctx.fill();

  ctx.strokeStyle = EDGE_WHITE;
  ctx.lineWidth = GLYPH_LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, GLYPH_RING_RADIUS, 0, Math.PI * 2);
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    ctx.moveTo(x + dx * GLYPH_RING_RADIUS, y + dy * GLYPH_RING_RADIUS);
    ctx.lineTo(x + dx * GLYPH_TICK_END, y + dy * GLYPH_TICK_END);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, GLYPH_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = EDGE_WHITE;
  ctx.fill();
}

/** The follow badge as map image data. */
export function followBadgeImageData(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = FOLLOW_BADGE_SIZE;
  canvas.height = FOLLOW_BADGE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context for the follow badge");
  drawFollowBadge(ctx);
  return ctx.getImageData(0, 0, FOLLOW_BADGE_SIZE, FOLLOW_BADGE_SIZE);
}

/** Loads a vehicle icon SVG at the size it is drawn from; rejects if it fails. */
export function loadVehicleIconImage(url: string): Promise<HTMLImageElement> {
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
  drawVehicleIcon(ctx, url ? await loadVehicleIconImage(url) : null);
  return ctx.getImageData(0, 0, VEHICLE_ICON_SIZE, VEHICLE_ICON_SIZE);
}
