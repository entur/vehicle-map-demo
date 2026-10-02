import type {
  RasterLayerSpecification,
  RasterSourceSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/**
 * Aerial photography over the base map, as an experiment. Esri World Imagery
 * is keyless and CORS-open; Kartverket's open "Norge i bilder" cache no longer
 * answers and its current cache needs an agreement.
 *
 * Drawn above the base map's fills and lines but beneath everything else —
 * transit network, hillshade, buildings, labels and data — so it replaces the
 * ground and nothing on it. Belongs to no mode; `AerialImageryLayers` is the
 * only writer of its visibility.
 */
export const AERIAL_SOURCE = "aerial";
export const AERIAL_LAYER = "aerial-layer";

export const AERIAL_SOURCE_SPEC: RasterSourceSpecification = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  // Esri has z19 over Oslo but serves "Map data not yet available" placeholder
  // tiles for it over Trondheim; 18 is real in both and is overzoomed beyond.
  maxzoom: 18,
  attribution:
    "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

export const AERIAL_LAYER_SPEC: RasterLayerSpecification = {
  id: AERIAL_LAYER,
  type: "raster",
  source: AERIAL_SOURCE,
  layout: { visibility: "none" },
  paint: { "raster-fade-duration": 150 },
};

/** URL of one aerial photo tile, from the same template the source reads. */
export function aerialTileUrl(z: number, x: number, y: number): string {
  return AERIAL_SOURCE_SPEC.tiles![0].replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}
