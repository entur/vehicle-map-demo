import type { Polygon } from "geojson";
import { VehicleModeEnumeration } from "../types.ts";

export const METRES_PER_DEGREE_LAT = 111_320;

type Dimensions = { length: number; width: number; height: number };

/**
 * Nominal sizes in metres. The feed carries no vehicle dimensions, so these
 * are typical values per mode — a ferry in particular ranges from a 15 m
 * passenger boat to a 140 m car ferry.
 */
export const VEHICLE_DIMENSIONS: Partial<
  Record<VehicleModeEnumeration, Dimensions>
> = {
  BUS: { length: 12, width: 2.55, height: 3.2 },
  COACH: { length: 13, width: 2.55, height: 3.6 },
  TRAM: { length: 32, width: 2.65, height: 3.6 },
  METRO: { length: 60, width: 3.2, height: 3.7 },
  RAIL: { length: 75, width: 3.2, height: 4.2 },
  FERRY: { length: 40, width: 10, height: 6 },
};

const DEFAULT_DIMENSIONS: Dimensions = { length: 8, width: 2.5, height: 3 };

export function dimensionsFor(mode: VehicleModeEnumeration): Dimensions {
  return VEHICLE_DIMENSIONS[mode] ?? DEFAULT_DIMENSIONS;
}

/** Degrees clockwise from north in [0, 360), or null when unknown. */
export function normaliseBearing(bearing: number | null): number | null {
  if (bearing === null || !Number.isFinite(bearing)) return null;
  return ((bearing % 360) + 360) % 360;
}

/**
 * The ground outline of a vehicle model centred on its reported position:
 * a box with a pointed nose along the bearing. Without a bearing it is a
 * regular octagon instead, so that "direction unknown" can never be mistaken
 * for "heading north".
 *
 * Local offsets use an equirectangular approximation, which is exact enough
 * over the tens of metres a vehicle spans.
 */
export function vehicleFootprint(
  [lon, lat]: [number, number],
  bearing: number | null,
  mode: VehicleModeEnumeration,
): Polygon {
  const { length, width } = dimensionsFor(mode);
  const metresPerDegreeLon =
    METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const toLonLat = (east: number, north: number) => [
    lon + east / metresPerDegreeLon,
    lat + north / METRES_PER_DEGREE_LAT,
  ];

  const heading = normaliseBearing(bearing);
  let ring: number[][];

  if (heading === null) {
    const radius = width * 0.75;
    ring = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      return toLonLat(radius * Math.sin(angle), radius * Math.cos(angle));
    });
  } else {
    // x is to the vehicle's right, y is forward.
    const half = length / 2;
    const nose = Math.min(width, length * 0.15);
    const local: [number, number][] = [
      [-width / 2, -half],
      [width / 2, -half],
      [width / 2, half - nose],
      [0, half],
      [-width / 2, half - nose],
    ];
    const rad = (heading * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    ring = local.map(([x, y]) =>
      toLonLat(x * cos + y * sin, -x * sin + y * cos),
    );
  }

  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}
