/**
 * The camera a fixed-view kiosk holds, as `?kioskView=<lat>,<lon>,<zoom>,
 * <pitch>,<bearing>` carries it.
 */
export type FixedCamera = {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

/**
 * The 3D view's ceiling: the vehicle subscription is bounded by
 * `getBounds()`, which grows sharply as the horizon comes into view.
 */
export const MAX_FIXED_PITCH = 60;
const MAX_ZOOM = 24;

/** Five decimals is about a metre; a zoom to 0.01 and whole degrees. */
const DECIMALS = { position: 5, zoom: 2 } as const;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // `+ 0` turns a -0 into 0, so a link never says "-0".
  return Math.round(value * factor) / factor + 0;
}

/** Degrees in (-180, 180]. */
function normaliseBearing(bearing: number): number {
  const turned = ((bearing % 360) + 360) % 360;
  return (turned > 180 ? turned - 360 : turned) + 0;
}

/** `camera` as precise as a link carries it, so a run and its link agree. */
export function roundCamera(camera: FixedCamera): FixedCamera {
  return {
    latitude: round(camera.latitude, DECIMALS.position),
    longitude: round(camera.longitude, DECIMALS.position),
    zoom: round(camera.zoom, DECIMALS.zoom),
    pitch: Math.min(MAX_FIXED_PITCH, round(camera.pitch, 0)),
    bearing: normaliseBearing(round(camera.bearing, 0)),
  };
}

/**
 * `?kioskView` as a camera, or null for anything but five numbers in range.
 * A pitch above the 3D view's ceiling is capped rather than refused, and the
 * bearing is brought into (-180, 180].
 */
export function parseFixedCamera(raw: string | null): FixedCamera | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 5 || parts.some((part) => part.trim() === "")) {
    return null;
  }
  const [latitude, longitude, zoom, pitch, bearing] = parts.map(Number);
  if (![latitude, longitude, zoom, pitch, bearing].every(Number.isFinite)) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (zoom < 0 || zoom > MAX_ZOOM || pitch < 0) return null;
  return {
    latitude,
    longitude,
    zoom,
    pitch: Math.min(MAX_FIXED_PITCH, pitch),
    bearing: normaliseBearing(bearing),
  };
}

/** The `?kioskView` value for `camera`, rounded and without trailing zeros. */
export function formatFixedCamera(camera: FixedCamera): string {
  const { latitude, longitude, zoom, pitch, bearing } = roundCamera(camera);
  return [latitude, longitude, zoom, pitch, bearing].join(",");
}
