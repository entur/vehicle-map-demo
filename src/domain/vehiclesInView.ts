import {
  METRES_PER_DEGREE_LAT,
  VEHICLE_DIMENSIONS,
} from "./vehicleFootprint.ts";

/** South-west and north-east corners as [longitude, latitude], like the Filter's box. */
export type ViewBounds = [[number, number], [number, number]];

/**
 * How far a model reaches from its reported position, which is its centre:
 * half the longest vehicle. A vehicle this far outside the view can still
 * have most of its model on screen, so every view test widens the view by
 * at least this much. Without it a train vanished at street zoom as soon as
 * its centre left the view, with its front half still showing.
 */
export const MODEL_REACH_METRES =
  Math.max(...Object.values(VEHICLE_DIMENSIONS).map(({ length }) => length)) /
  2;

/**
 * Each side of the view is widened by this share of its span, so the view
 * tests keep their slack zoomed out, where `MODEL_REACH_METRES` is nothing.
 */
const MARGIN = 0.1;

/**
 * `bounds` widened on every side by `metres`. Longitude is widened for the
 * latitude nearer the pole, where a metre is the most degrees, so the
 * widening is never short of `metres` anywhere in the box.
 */
export function padBounds(
  [[west, south], [east, north]]: ViewBounds,
  metres: number,
): ViewBounds {
  const dLat = metres / METRES_PER_DEGREE_LAT;
  const maxAbsLat = Math.min(89, Math.max(Math.abs(south), Math.abs(north)));
  const dLon = dLat / Math.cos((maxAbsLat * Math.PI) / 180);
  return [
    [west - dLon, south - dLat],
    [east + dLon, north + dLat],
  ];
}

/** A level, north-up camera, as `getBounds()` would see it on arrival. */
export type LevelCamera = {
  longitude: number;
  latitude: number;
  zoom: number;
  /** The canvas in CSS pixels. */
  width: number;
  height: number;
  /** As `getPadding()` returns it: a side it leaves out is unpadded. */
  padding: { top?: number; bottom?: number; left?: number; right?: number };
};

/** Earth's circumference at the equator, which MapLibre's 512 px world spans. */
const EQUATOR_METRES = 40_075_016.686;

/**
 * The bounds a level, north-up camera will show, for a view the map has not
 * reached yet. MapLibre centres the camera in the unpadded part of the
 * canvas, so the bounds reach further on a padded side. Linear in latitude,
 * which at street zoom is a few metres out at most.
 */
export function viewBoundsAt({
  longitude,
  latitude,
  zoom,
  width,
  height,
  padding: { top = 0, bottom = 0, left = 0, right = 0 },
}: LevelCamera): ViewBounds {
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const metresPerPixel = (EQUATOR_METRES * cosLat) / (512 * 2 ** zoom);
  const latPerPixel = metresPerPixel / METRES_PER_DEGREE_LAT;
  const lonPerPixel = latPerPixel / cosLat;
  return [
    [
      longitude - ((width + left - right) / 2) * lonPerPixel,
      latitude - ((height - top + bottom) / 2) * latPerPixel,
    ],
    [
      longitude + ((width - left + right) / 2) * lonPerPixel,
      latitude + ((height + top - bottom) / 2) * latPerPixel,
    ],
  ];
}

/**
 * The steepest the 3D view tilts. Past 60° the horizon comes on screen and
 * `getBounds()` reaches tens of kilometres, so everything that reads the
 * view's bounds reads them through `capViewBounds`.
 */
export const MAX_VIEW_PITCH = 80;

/** Up to this pitch a view's bounds are used whole; `capViewBounds` holds them to its reach. */
export const BOUNDS_REFERENCE_PITCH = 60;

/** A camera's centre, zoom and canvas, whatever its pitch and bearing. */
export type ViewCamera = {
  longitude: number;
  latitude: number;
  zoom: number;
  /** The canvas in CSS pixels. */
  width: number;
  height: number;
  /** The vertical field of view in degrees. */
  fov: number;
  /** As `getPadding()` returns it: a side it leaves out is unpadded. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
};

/**
 * How far, in metres over level ground, the view's far corners are from the
 * camera's centre at `BOUNDS_REFERENCE_PITCH`. MapLibre puts the centre in
 * the middle of the unpadded part of the canvas, so top padding, which moves
 * it down, lengthens the reach. `Infinity` when padding puts the horizon in
 * even the reference view, which then has no far corner.
 */
export function referenceReachMetres({
  latitude,
  zoom,
  width,
  height,
  fov,
  padding: { top = 0, bottom = 0, left = 0, right = 0 } = {},
}: Omit<ViewCamera, "longitude">): number {
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const metresPerPixel = (EQUATOR_METRES * cosLat) / (512 * 2 ** zoom);
  const pitch = (BOUNDS_REFERENCE_PITCH * Math.PI) / 180;
  // The camera's distance from the centre in px, which the canvas's height
  // and the field of view fix, and the far corner's offset from the centre.
  const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
  const up = (height + top - bottom) / 2;
  const across = Math.max(width + left - right, width - left + right) / 2;
  // The angle from straight down of the ray through the canvas's top edge.
  const topRay = pitch + Math.atan(up / focal);
  if (topRay >= MAX_RAY) return Infinity;
  const distance = focal * metresPerPixel;
  const ahead =
    distance * (Math.cos(pitch) * Math.tan(topRay) - Math.sin(pitch));
  const sideways =
    ((distance * Math.cos(pitch)) / Math.cos(topRay)) *
    (across / Math.hypot(focal, up));
  return Math.hypot(ahead, sideways);
}

/** A ray this close to level is treated as never meeting the ground. */
const MAX_RAY = (89 * Math.PI) / 180;

/**
 * `bounds` held to a square around the camera's centre, reaching as far as
 * `referenceReachMetres`. The view's far corners can lie along any compass
 * direction once the map is turned, hence a square rather than a shape that
 * follows the bearing. A view at or below the reference pitch fits inside it
 * and comes back unchanged; a steeper one stops growing, and the strip
 * towards the horizon is left out.
 */
export function capViewBounds(
  bounds: ViewBounds,
  camera: ViewCamera,
): ViewBounds {
  const reach = referenceReachMetres(camera);
  if (reach === Infinity) return bounds;
  const [[west, south], [east, north]] = bounds;
  const { longitude, latitude } = camera;
  const dLat = reach / METRES_PER_DEGREE_LAT;
  const dLon = dLat / Math.cos((latitude * Math.PI) / 180);
  return [
    [Math.max(west, longitude - dLon), Math.max(south, latitude - dLat)],
    [Math.min(east, longitude + dLon), Math.min(north, latitude + dLat)],
  ];
}

/**
 * The vehicles inside the view, widened by `MARGIN` or `MODEL_REACH_METRES`,
 * whichever is more, in their original order.
 *
 * Normally the subscription's bounding box already keeps the data to the
 * view, and this changes nothing. Straight after a jump from the whole
 * country to one street it does not: the data is the country until the new
 * subscription's first frame, and models built from it came to over a
 * thousand layers and froze the page for seconds.
 */
export function vehiclesInView<
  T extends { location: { longitude: number; latitude: number } },
>(vehicles: T[], bounds: ViewBounds): T[] {
  const [[west, south], [east, north]] = bounds;
  const [[reachWest, reachSouth], [reachEast, reachNorth]] = padBounds(
    bounds,
    MODEL_REACH_METRES,
  );
  const minWest = Math.min(reachWest, west - (east - west) * MARGIN);
  const maxEast = Math.max(reachEast, east + (east - west) * MARGIN);
  const minSouth = Math.min(reachSouth, south - (north - south) * MARGIN);
  const maxNorth = Math.max(reachNorth, north + (north - south) * MARGIN);
  return vehicles.filter(
    ({ location: { longitude, latitude } }) =>
      longitude >= minWest &&
      longitude <= maxEast &&
      latitude >= minSouth &&
      latitude <= maxNorth,
  );
}
