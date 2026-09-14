import { describe, expect, it } from "vitest";
import {
  METRES_PER_DEGREE_LAT,
  dimensionsFor,
  normaliseBearing,
  vehicleFootprint,
} from "./vehicleFootprint.ts";

const OSLO: [number, number] = [10.75, 59.91];

/** Offset of a coordinate from the origin, in metres east and north. */
function metresFrom(origin: [number, number], [lon, lat]: number[]) {
  const east =
    (lon - origin[0]) *
    METRES_PER_DEGREE_LAT *
    Math.cos((origin[1] * Math.PI) / 180);
  const north = (lat - origin[1]) * METRES_PER_DEGREE_LAT;
  return { east, north };
}

/**
 * Mean of the ring's distinct vertices. A box is symmetric about its centre,
 * so the nose alone pulls this off-centre, and only in its own direction.
 */
function vertexCentroid(ring: number[][]) {
  const vertices = ring.slice(0, -1).map((vertex) => metresFrom(OSLO, vertex));
  return {
    east: vertices.reduce((sum, v) => sum + v.east, 0) / vertices.length,
    north: vertices.reduce((sum, v) => sum + v.north, 0) / vertices.length,
  };
}

describe("normaliseBearing", () => {
  it("folds any finite angle into [0, 360)", () => {
    expect(normaliseBearing(0)).toBe(0);
    expect(normaliseBearing(360)).toBe(0);
    expect(normaliseBearing(-90)).toBe(270);
    expect(normaliseBearing(450)).toBe(90);
  });

  it("treats null and non-finite values as unknown", () => {
    expect(normaliseBearing(null)).toBeNull();
    expect(normaliseBearing(Number.NaN)).toBeNull();
  });
});

describe("vehicleFootprint", () => {
  it("returns a closed ring", () => {
    const ring = vehicleFootprint(OSLO, 45, "BUS").coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("points the nose along the bearing", () => {
    for (const [bearing, east, north] of [
      [0, 0, 1],
      [90, 1, 0],
      [180, 0, -1],
      [270, -1, 0],
    ]) {
      const ring = vehicleFootprint(OSLO, bearing, "BUS").coordinates[0];
      const centroid = vertexCentroid(ring);
      const length = Math.hypot(centroid.east, centroid.north);
      expect(centroid.east / length).toBeCloseTo(east, 5);
      expect(centroid.north / length).toBeCloseTo(north, 5);
    }
  });

  it("is as long as the mode's nominal length, centred on the position", () => {
    const ring = vehicleFootprint(OSLO, 0, "BUS").coordinates[0];
    const norths = ring.map((vertex) => metresFrom(OSLO, vertex).north);
    expect(Math.max(...norths) - Math.min(...norths)).toBeCloseTo(
      dimensionsFor("BUS").length,
      3,
    );
    expect(Math.max(...norths)).toBeCloseTo(-Math.min(...norths), 3);
  });

  // A vehicle with no bearing must not be drawn pointing somewhere: a nose
  // aimed north would be indistinguishable from a real bearing of 0.
  it("draws a directionless, symmetric shape when the bearing is unknown", () => {
    const ring = vehicleFootprint(OSLO, null, "BUS").coordinates[0];
    const radii = ring.map((vertex) => {
      const { east, north } = metresFrom(OSLO, vertex);
      return Math.hypot(east, north);
    });
    for (const radius of radii) expect(radius).toBeCloseTo(radii[0], 3);
  });

  it("falls back to a default size for modes without dimensions", () => {
    expect(() => vehicleFootprint(OSLO, 0, "TAXI")).not.toThrow();
  });
});
