import type { TerrainSpecification } from "@maplibre/maplibre-gl-style-spec";
import {
  BASE_MAP_SOURCES,
  baseMapLayerIds,
} from "../components/basemap/basemap.ts";
import { TRANSIT_NETWORK_LAYERS } from "./transitNetwork.ts";

/**
 * Whether the map is drawn flat or tilted over terrain with extruded
 * buildings. Independent of `AppMode` — both feeds render the same way in
 * either — and deliberately not a `MapViewOptions` key: those are layer
 * switches owned by one mode each, and changing them re-opens the vehicle
 * subscription.
 */
export type ViewDimension = "2d" | "3d";

export const VIEW_DIMENSIONS: ViewDimension[] = ["2d", "3d"];

export function parseViewDimension(
  value: string | null | undefined,
): ViewDimension {
  return VIEW_DIMENSIONS.find((dimension) => dimension === value) ?? "2d";
}

/**
 * Layers belonging to no mode: never hidden or cleared on a mode switch. The
 * ones in `VIEW_3D_LAYERS` are governed by the view dimension instead.
 */
export const VIEW_3D_LAYERS = ["hillshade-layer", "buildings-3d-layer"];

/**
 * Derived, not listed: both base maps' layers, the 3D-only ones, and the
 * transit network drawn from the base map's tiles (see transitNetwork.ts).
 */
export const BASE_LAYERS = [
  ...baseMapLayerIds(),
  ...VIEW_3D_LAYERS,
  ...TRANSIT_NETWORK_LAYERS,
];

export const BASE_SOURCES = [
  ...Object.keys(BASE_MAP_SOURCES),
  "terrain",
  "hillshade",
];

/**
 * Terrain reads its own `raster-dem` source rather than sharing the
 * hillshade's: MapLibre warns that one source serving both degrades caching.
 */
export function terrainFor(
  dimension: ViewDimension,
): TerrainSpecification | null {
  return dimension === "3d" ? { source: "terrain", exaggeration: 1.2 } : null;
}

/**
 * The camera the map eases to on entering a dimension. The 3D pitch is kept
 * below MapLibre's default 60° limit on purpose: the vehicle subscription is
 * bounded by `getBounds()`, which grows sharply as the horizon comes into view.
 * 2D is also turned north-up, since a rotated flat map is almost always left
 * over from 3D or a chase; 3D keeps whatever bearing the map has.
 */
export function cameraFor(dimension: ViewDimension): {
  pitch: number;
  bearing?: number;
} {
  return dimension === "3d" ? { pitch: 55 } : { pitch: 0, bearing: 0 };
}

/** Degrees one click of the 3D view's rotate buttons turns the map. */
export const ROTATION_STEP = 45;

export type RotationDirection = "clockwise" | "counterclockwise";

/** Within this of a step, a bearing counts as on it; easing lands a hair off. */
const STEP_TOLERANCE = 0.5;

/**
 * The bearing one rotate click turns to: the next multiple of `ROTATION_STEP`
 * in the direction of turn, so repeated clicks settle on round headings even
 * after a free drag. Normalised to MapLibre's (-180, 180].
 */
export function rotatedBearing(
  bearing: number,
  direction: RotationDirection,
): number {
  const steps =
    direction === "clockwise"
      ? Math.floor((bearing + STEP_TOLERANCE) / ROTATION_STEP) + 1
      : Math.ceil((bearing - STEP_TOLERANCE) / ROTATION_STEP) - 1;
  const normalised = (((steps * ROTATION_STEP) % 360) + 360) % 360;
  return normalised > 180 ? normalised - 360 : normalised;
}
