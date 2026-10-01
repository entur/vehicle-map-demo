import { describe, expect, it } from "vitest";
import { ViewBounds, vehiclesInView } from "./vehiclesInView.ts";

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
