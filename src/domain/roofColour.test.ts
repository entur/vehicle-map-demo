import { describe, expect, it } from "vitest";
import type { Polygon } from "geojson";
import {
  ROOF_SAMPLE_ZOOM,
  TILE_SIZE,
  medianColour,
  bboxesIntersect,
  footprintsById,
  samplePoints,
  sampleZoomFor,
  worldPixel,
} from "./roofColour.ts";

/** An axis-aligned box of `size` world pixels at the sample zoom, as lng/lat. */
function box(
  x0: number,
  y0: number,
  size: number,
  hole?: [number, number, number],
): Polygon {
  const world = TILE_SIZE * 2 ** ROOF_SAMPLE_ZOOM;
  const lngLat = (x: number, y: number) => {
    const lng = (x / world) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y) / world;
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    return [lng, lat];
  };
  const ring = (x: number, y: number, s: number) => [
    lngLat(x, y),
    lngLat(x + s, y),
    lngLat(x + s, y + s),
    lngLat(x, y + s),
    lngLat(x, y),
  ];
  return {
    type: "Polygon",
    coordinates: hole
      ? [ring(x0, y0, size), ring(...hole)]
      : [ring(x0, y0, size)],
  };
}

describe("worldPixel", () => {
  it("puts null island at the middle of the world", () => {
    const half = (TILE_SIZE * 2 ** 3) / 2;
    const [x, y] = worldPixel([0, 0], 3);
    expect(x).toBeCloseTo(half);
    expect(y).toBeCloseTo(half);
  });
});

describe("samplePoints", () => {
  const origin = 1_000 * TILE_SIZE + 10;

  it("samples only inside the footprint, in the tile it falls in", () => {
    const samples = samplePoints(box(origin, origin, 40));
    expect(samples.length).toBeGreaterThan(50);
    for (const s of samples) {
      expect([s.tileX, s.tileY]).toEqual([1_000, 1_000]);
      expect(s.px).toBeGreaterThanOrEqual(10);
      expect(s.px).toBeLessThan(50);
      expect(s.py).toBeGreaterThanOrEqual(10);
      expect(s.py).toBeLessThan(50);
    }
  });

  it("leaves a courtyard out", () => {
    const samples = samplePoints(
      box(origin, origin, 40, [origin + 10, origin + 10, 20]),
    );
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      const inCourtyard = s.px > 21 && s.px < 39 && s.py > 21 && s.py < 39;
      expect(inCourtyard).toBe(false);
    }
  });

  it("still samples a footprint smaller than a pixel", () => {
    expect(samplePoints(box(origin + 0.2, origin + 0.2, 0.3))).toHaveLength(1);
  });

  it("samples nothing for a geometry that is not a polygon", () => {
    expect(samplePoints({ type: "Point", coordinates: [10, 60] })).toEqual([]);
  });
});

describe("medianColour", () => {
  it("ignores a minority of shadow and glare", () => {
    expect(
      medianColour([
        [160, 60, 40],
        [158, 62, 42],
        [162, 58, 38],
        [10, 10, 10],
        [250, 250, 250],
      ]),
    ).toBe("#a03c28");
  });

  it("is null with nothing to sample", () => {
    expect(medianColour([])).toBeNull();
  });
});

describe("sampleZoomFor", () => {
  it("samples one level above the map zoom, about the screen's resolution", () => {
    expect(sampleZoomFor(14)).toBe(15);
    expect(sampleZoomFor(15.7)).toBe(16);
  });

  it("never samples finer than ROOF_SAMPLE_ZOOM", () => {
    expect(sampleZoomFor(16)).toBe(ROOF_SAMPLE_ZOOM);
    expect(sampleZoomFor(19)).toBe(ROOF_SAMPLE_ZOOM);
  });
});

describe("footprintsById", () => {
  const square = (x: number, y: number, s: number): Polygon => ({
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + s, y],
        [x + s, y + s],
        [x, y + s],
        [x, y],
      ],
    ],
  });

  it("joins a building's tile-clipped fragments into one footprint", () => {
    const footprints = footprintsById([
      { id: 7, geometry: square(10, 60, 1) },
      { id: 7, geometry: square(11, 60, 1) },
    ]);
    const footprint = footprints.get(7)!;
    expect(footprint.geometry.coordinates).toHaveLength(2);
    expect(footprint.bbox).toEqual([10, 60, 12, 61]);
  });

  it("keeps buildings apart and skips pieces without an id or an area", () => {
    const footprints = footprintsById([
      { id: 1, geometry: square(0, 0, 1) },
      { id: 2, geometry: square(5, 5, 1) },
      { geometry: square(9, 9, 1) },
      { id: 3, geometry: { type: "Point", coordinates: [1, 1] } },
    ]);
    expect([...footprints.keys()]).toEqual([1, 2]);
  });
});

describe("bboxesIntersect", () => {
  const view: [number, number, number, number] = [10, 59, 11, 60];

  it("counts a building reaching into view, whichever corner is outside", () => {
    expect(bboxesIntersect([9.5, 59.5, 10.2, 59.6], view)).toBe(true);
    expect(bboxesIntersect([10.9, 59.9, 11.5, 60.5], view)).toBe(true);
  });

  it("counts one covering the whole view, and one wholly inside it", () => {
    expect(bboxesIntersect([9, 58, 12, 61], view)).toBe(true);
    expect(bboxesIntersect([10.4, 59.4, 10.5, 59.5], view)).toBe(true);
  });

  it("does not count one entirely beside the view", () => {
    expect(bboxesIntersect([11.1, 59.5, 11.2, 59.6], view)).toBe(false);
    expect(bboxesIntersect([10.4, 60.1, 10.5, 60.2], view)).toBe(false);
  });
});
