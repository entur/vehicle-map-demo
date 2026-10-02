import { describe, expect, it } from "vitest";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";
import {
  MODEL_REACH_METRES,
  ViewBounds,
  padBounds,
  vehiclesInView,
} from "./vehiclesInView.ts";

/** A 1°×1° view south-west at 10°E 63°N. */
const VIEW: ViewBounds = [
  [10, 63],
  [11, 64],
];

const at = (longitude: number, latitude: number) => ({
  location: { longitude, latitude },
});

describe("vehiclesInView", () => {
  it("keeps vehicles inside the view", () => {
    const inside = at(10.5, 63.5);
    expect(vehiclesInView([inside], VIEW)).toEqual([inside]);
  });

  // The jump that froze the page: the data still held the whole country while
  // the view showed one street.
  it("drops vehicles far outside the view", () => {
    expect(vehiclesInView([at(5.3, 60.4), at(10.5, 66)], VIEW)).toEqual([]);
  });

  it("keeps a vehicle just past the edge, whose model can still reach into view", () => {
    const justEast = at(11.05, 63.5);
    const justSouth = at(10.5, 62.95);
    expect(vehiclesInView([justEast, justSouth], VIEW)).toEqual([
      justEast,
      justSouth,
    ]);
  });

  it("keeps the vehicles' order and identity", () => {
    const a = at(10.2, 63.2);
    const b = at(10.8, 63.8);
    const result = vehiclesInView([a, b], VIEW);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });
});

/** About 75 m × 75 m at Skøyen: street zoom, where a train outgrows a tenth of the view. */
const STREET: ViewBounds = [
  [10.6786, 59.9221],
  [10.68, 59.9228],
];

describe("vehiclesInView at street zoom", () => {
  it("keeps a train whose centre is off screen but within half its length", () => {
    // 30 m west of the view: more than a tenth of it, less than half a train.
    const west = at(
      10.6786 -
        30 / (METRES_PER_DEGREE_LAT * Math.cos((59.9228 * Math.PI) / 180)),
      59.9225,
    );
    const south = at(10.679, 59.9221 - 30 / METRES_PER_DEGREE_LAT);
    expect(vehiclesInView([west, south], STREET)).toEqual([west, south]);
  });

  it("drops a vehicle beyond any model's reach", () => {
    expect(vehiclesInView([at(10.6786 - 0.002, 59.9225)], STREET)).toEqual([]);
  });
});

describe("padBounds", () => {
  it("widens every side by at least the given distance", () => {
    const [[w, s], [e, n]] = padBounds(STREET, 37.5);
    const lonMetres = (deg: number, lat: number) =>
      deg * METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
    expect((STREET[0][1] - s) * METRES_PER_DEGREE_LAT).toBeCloseTo(37.5);
    expect((n - STREET[1][1]) * METRES_PER_DEGREE_LAT).toBeCloseTo(37.5);
    // Checked at the southern edge, where a degree of longitude is the most metres.
    expect(lonMetres(STREET[0][0] - w, STREET[0][1])).toBeGreaterThanOrEqual(
      37.5,
    );
    expect(lonMetres(e - STREET[1][0], STREET[0][1])).toBeGreaterThanOrEqual(
      37.5,
    );
  });

  it("reaches half the longest vehicle", () => {
    expect(MODEL_REACH_METRES).toBe(37.5);
  });
});
