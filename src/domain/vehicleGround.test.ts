import { describe, expect, it } from "vitest";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";
import { ElevationAt, pointAlong, vehicleGround } from "./vehicleGround.ts";

const OSLO: [number, number] = [10.75, 59.91];

/** Metres north of OSLO, which is where the test hills rise. */
const northOf = ([, latitude]: [number, number]) =>
  (latitude - OSLO[1]) * METRES_PER_DEGREE_LAT;

describe("pointAlong", () => {
  it("goes north at bearing 0 and east at 90, in metres", () => {
    const north = pointAlong(OSLO, 0, 100);
    expect(north[0]).toBeCloseTo(OSLO[0], 9);
    expect(northOf(north)).toBeCloseTo(100, 6);

    const east = pointAlong(OSLO, 90, 100);
    expect(east[1]).toBeCloseTo(OSLO[1], 9);
    const metresEast =
      (east[0] - OSLO[0]) *
      METRES_PER_DEGREE_LAT *
      Math.cos((OSLO[1] * Math.PI) / 180);
    expect(metresEast).toBeCloseTo(100, 6);
  });

  it("goes backwards for negative distances", () => {
    expect(northOf(pointAlong(OSLO, 0, -6))).toBeCloseTo(-6, 6);
  });
});

describe("vehicleGround", () => {
  // A 10% grade rising to the north.
  const hill: ElevationAt = (lngLat) => 100 + 0.1 * northOf(lngLat);
  const grade = (Math.atan(0.1) * 180) / Math.PI;

  it("pitches the nose up when heading uphill, and down when heading down", () => {
    const up = vehicleGround(hill, OSLO, 0, 12, 16)!;
    expect(up.elevation).toBeCloseTo(100, 6);
    expect(up.pitch).toBeCloseTo(grade, 4);
    expect(up.poolPitch).toBeCloseTo(grade, 4);
    expect(up.complete).toBe(true);

    const down = vehicleGround(hill, OSLO, 180, 12, 16)!;
    expect(down.pitch).toBeCloseTo(-grade, 4);
    expect(down.poolPitch).toBeCloseTo(-grade, 4);
  });

  it("stays level across the slope", () => {
    const across = vehicleGround(hill, OSLO, 90, 12, 16)!;
    expect(across.pitch).toBeCloseTo(0, 4);
    expect(across.poolPitch).toBeCloseTo(0, 4);
  });

  // Flat under the bus, rising steeply from just past its front.
  it("lifts the pool on its own when only the road ahead rises", () => {
    const foot: ElevationAt = (lngLat) => 50 + Math.max(0, northOf(lngLat) - 6);
    const ground = vehicleGround(foot, OSLO, 0, 12, 16)!;
    expect(ground.pitch).toBeCloseTo(0, 4);
    expect(ground.poolPitch).toBeGreaterThan(30);
  });

  it("has no ground where the position's height is unknown", () => {
    expect(vehicleGround(() => null, OSLO, 0, 12, 16)).toBeNull();
  });

  it("is level without a bearing, without looking further", () => {
    const looked: [number, number][] = [];
    const ground = vehicleGround(
      (lngLat) => (looked.push(lngLat), 7),
      OSLO,
      null,
      12,
      16,
    );
    expect(ground).toEqual({
      elevation: 7,
      pitch: 0,
      poolPitch: 0,
      complete: true,
    });
    expect(looked).toEqual([OSLO]);
  });

  it("is level but incomplete where a slope sample is missing", () => {
    const onlyHere: ElevationAt = (lngLat) =>
      lngLat === OSLO ? 100 : undefined;
    expect(vehicleGround(onlyHere, OSLO, 0, 12, 16)).toEqual({
      elevation: 100,
      pitch: 0,
      poolPitch: 0,
      complete: false,
    });
  });
});
