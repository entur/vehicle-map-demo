import type {
  RasterLayerSpecification,
  RasterSourceSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/**
 * Aerial photography over the base map: Kartverket's Norge i bilder, from its
 * web mercator tile cache. Every tile needs a token bound to the page's origin
 * (see nibToken.ts), and the style is built once and never replaced, so the
 * source names tiles by a `norgeibilder://` URL and the protocol registered
 * in `src/utils/norgeIBilder.ts` adds the token when MapLibre asks for one.
 *
 * Drawn above the base map's fills and lines but beneath everything else —
 * transit network, hillshade, buildings, labels and data — so it replaces the
 * ground and nothing on it. Belongs to no mode; `AerialImageryLayers` is the
 * only writer of its visibility.
 */
export const AERIAL_SOURCE = "aerial";
export const AERIAL_LAYER = "aerial-layer";

export const NIB_PROTOCOL = "norgeibilder";

const NIB_TILE_CACHE =
  "https://tilecache.norgeibilder.no/arcgis/rest/services/Nibcache_web_mercator_v2/MapServer/tile";

export const AERIAL_SOURCE_SPEC: RasterSourceSpecification = {
  type: "raster",
  tiles: [`${NIB_PROTOCOL}://{z}/{x}/{y}`],
  tileSize: 256,
  // The service defines levels to 23, but from 20 it answers with a blank
  // placeholder PNG (measured over Oslo, Trondheim and rural Innlandet);
  // 19 is real everywhere and is overzoomed beyond.
  maxzoom: 19,
  attribution:
    '© <a href="https://www.norgeibilder.no/">Kartverket - Norge i bilder</a>',
};

export const AERIAL_LAYER_SPEC: RasterLayerSpecification = {
  id: AERIAL_LAYER,
  type: "raster",
  source: AERIAL_SOURCE,
  layout: { visibility: "none" },
  paint: { "raster-fade-duration": 150 },
};

export type TileAddress = { z: number; x: number; y: number };

/** The tile a `norgeibilder://z/x/y` URL names, or null if it names none. */
export function parseNibTileUrl(url: string): TileAddress | null {
  const match = new RegExp(`^${NIB_PROTOCOL}://(\\d+)/(\\d+)/(\\d+)$`).exec(
    url,
  );
  if (!match) return null;
  const [z, x, y] = match.slice(1).map(Number);
  return { z, x, y };
}

/** The tile cache's URL for one tile. Note the cache's row-before-column order. */
export function nibTileUrl({ z, x, y }: TileAddress, token: string): string {
  return `${NIB_TILE_CACHE}/${z}/${y}/${x}?token=${encodeURIComponent(token)}`;
}
