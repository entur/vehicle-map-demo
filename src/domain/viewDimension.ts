import type { TerrainSpecification } from "@maplibre/maplibre-gl-style-spec";

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

export const BASE_LAYERS = ["osm", ...VIEW_3D_LAYERS];

export const BASE_SOURCES = ["osm", "terrain", "hillshade", "openfreemap"];

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
 * The pitch the map eases to on entering a dimension. Kept below MapLibre's
 * default 60° limit on purpose: the vehicle subscription is bounded by
 * `getBounds()`, which grows sharply as the horizon comes into view.
 */
export function cameraFor(dimension: ViewDimension): { pitch: number } {
  return { pitch: dimension === "3d" ? 55 : 0 };
}
