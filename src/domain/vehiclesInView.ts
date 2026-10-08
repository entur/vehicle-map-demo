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
