import type { Geometry, MultiPolygon, Position } from "geojson";

/**
 * Colouring 3D buildings from the aerial photo: sample the photo's pixels
 * inside a building's footprint and take the median. MapLibre cannot texture
 * an extrusion, so this is one colour per building — the roof's, applied to
 * the walls as well.
 *
 * The photo is not a true orthophoto: a tall building leans, so its roof sits
 * a little off the footprint and some samples land on a wall, a shadow or the
 * street. A per-channel median shrugs off that minority where a mean would not.
 */

/** The finest imagery zoom sampled. */
export const ROOF_SAMPLE_ZOOM = 17;

/**
 * Imagery zoom to sample at for a map zoom: about the screen's resolution,
 * capped at `ROOF_SAMPLE_ZOOM`. MapLibre's zoom counts 512 px tiles and the
 * photo comes in 256 px ones, so one level up is roughly what the aerial layer
 * itself shows — the same tiles, often already in the browser's cache.
 *
 * A fixed z17 at map zoom 14 needed about 500 tiles for one screen, more than
 * the cache holds, so a single pass evicted tiles it still needed. A colour
 * is kept per building once sampled, so it does not change as you zoom.
 */
export function sampleZoomFor(mapZoom: number): number {
  return Math.min(ROOF_SAMPLE_ZOOM, Math.floor(mapZoom) + 1);
}

export const TILE_SIZE = 256;

/** At most this many sample points per axis of a footprint's bounding box. */
const MAX_SAMPLES_PER_AXIS = 10;

export type PhotoSample = {
  tileX: number;
  tileY: number;
  /** Pixel within the tile. */
  px: number;
  py: number;
};

/** Web Mercator world pixel of a longitude/latitude at `zoom`. */
export function worldPixel(
  [lng, lat]: Position,
  zoom: number,
): [number, number] {
  const size = TILE_SIZE * 2 ** zoom;
  const phi = (lat * Math.PI) / 180;
  return [
    ((lng + 180) / 360) * size,
    ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * size,
  ];
}

/** Even-odd test across all rings, so a courtyard (a hole) counts as outside. */
function insideRings(x: number, y: number, rings: [number, number][][]) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function polygonsOf(geometry: Geometry): Position[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/**
 * Photo pixels to read for a footprint: a grid over its bounding box at
 * `zoom`, kept where it falls inside. A footprint too small for
 * any grid point to land inside is sampled at its bounding box's centre.
 */
export function samplePoints(
  geometry: Geometry,
  zoom: number = ROOF_SAMPLE_ZOOM,
): PhotoSample[] {
  const samples: PhotoSample[] = [];
  const toSample = (x: number, y: number): PhotoSample => ({
    tileX: Math.floor(x / TILE_SIZE),
    tileY: Math.floor(y / TILE_SIZE),
    px: Math.floor(x) % TILE_SIZE,
    py: Math.floor(y) % TILE_SIZE,
  });

  for (const polygon of polygonsOf(geometry)) {
    const rings = polygon.map((ring) =>
      ring.map((position) => worldPixel(position, zoom)),
    );
    const xs = rings[0].map(([x]) => x);
    const ys = rings[0].map(([, y]) => y);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const stepX = Math.max(1, (maxX - minX) / MAX_SAMPLES_PER_AXIS);
    const stepY = Math.max(1, (maxY - minY) / MAX_SAMPLES_PER_AXIS);
    const before = samples.length;
    for (let y = minY + stepY / 2; y < maxY; y += stepY) {
      for (let x = minX + stepX / 2; x < maxX; x += stepX) {
        if (insideRings(x, y, rings)) samples.push(toSample(x, y));
      }
    }
    if (samples.length === before && Number.isFinite(minX)) {
      samples.push(toSample((minX + maxX) / 2, (minY + maxY) / 2));
    }
  }
  return samples;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Per-channel median of RGB samples as `#rrggbb`, or null with no samples. */
export function medianColour(rgbs: [number, number, number][]): string | null {
  if (rgbs.length === 0) return null;
  return (
    "#" +
    [0, 1, 2]
      .map((channel) =>
        median(rgbs.map((rgb) => rgb[channel]))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number];

export type Footprint = {
  geometry: MultiPolygon;
  bbox: Bbox;
};

/**
 * A building's footprint from every piece a query returned for it. Vector
 * tiles clip a footprint at tile edges, so one building can come back as
 * several fragments sharing an id; taking only the first would sample a
 * building from the part of it that happens to lie in one tile.
 */
export function footprintsById(
  fragments: Iterable<{ id?: string | number; geometry: Geometry }>,
): Map<string | number, Footprint> {
  const footprints = new Map<string | number, Footprint>();
  for (const { id, geometry } of fragments) {
    if (id === undefined) continue;
    const polygons = polygonsOf(geometry);
    if (polygons.length === 0) continue;
    let footprint = footprints.get(id);
    if (!footprint) {
      footprint = {
        geometry: { type: "MultiPolygon", coordinates: [] },
        bbox: [Infinity, Infinity, -Infinity, -Infinity],
      };
      footprints.set(id, footprint);
    }
    for (const polygon of polygons) {
      footprint.geometry.coordinates.push(polygon);
      for (const [lng, lat] of polygon[0] ?? []) {
        footprint.bbox[0] = Math.min(footprint.bbox[0], lng);
        footprint.bbox[1] = Math.min(footprint.bbox[1], lat);
        footprint.bbox[2] = Math.max(footprint.bbox[2], lng);
        footprint.bbox[3] = Math.max(footprint.bbox[3], lat);
      }
    }
  }
  return footprints;
}

/** Whether two bounding boxes overlap at all, edges included. */
export function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}
