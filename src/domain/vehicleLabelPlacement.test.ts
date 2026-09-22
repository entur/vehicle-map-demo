import { describe, expect, it } from "vitest";
import { expression, v8 } from "@maplibre/maplibre-gl-style-spec";
import {
  placementFor,
  quantiseMapBearing,
  vehicleLabelAnchor,
  vehicleLabelOffset,
} from "./vehicleLabelPlacement.ts";

function evaluate(
  exp: unknown,
  property: "text-anchor" | "text-offset",
  bearing: number | null,
): unknown {
  const compiled = expression.createPropertyExpression(
    exp,
    property,
    v8.layout_symbol[property] as never,
  );
  if (compiled.result !== "success") {
    throw new Error(JSON.stringify(compiled.value));
  }
  return compiled.value.evaluate({ zoom: 14 }, {
    type: "Point",
    properties: bearing === null ? {} : { bearing },
  } as never);
}

describe("placementFor", () => {
  it("puts the label on the side opposite the heading", () => {
    expect(placementFor(0, 0).anchor).toBe("top"); // heading up → below
    expect(placementFor(90, 0).anchor).toBe("right"); // heading right → left
    expect(placementFor(180, 0).anchor).toBe("bottom"); // heading down → above
    expect(placementFor(270, 0).anchor).toBe("left"); // heading left → right
  });

  it("splits the circle into quarters centred on the four sides", () => {
    expect(placementFor(44, 0).anchor).toBe("top");
    expect(placementFor(45, 0).anchor).toBe("right");
    expect(placementFor(315, 0).anchor).toBe("top");
    expect(placementFor(314, 0).anchor).toBe("left");
  });

  it("works relative to the screen when the map is rotated", () => {
    // Heading east on a map turned 90° clockwise points up on screen.
    expect(placementFor(90, 90).anchor).toBe("top");
    expect(placementFor(0, 90).anchor).toBe("left");
  });

  it("keeps the original spot for a vehicle without a bearing", () => {
    expect(placementFor(null, 0)).toEqual({
      anchor: "top-left",
      offset: [0, -2.8],
    });
    expect(placementFor(Number.NaN, 0).anchor).toBe("top-left");
  });
});

describe("label expressions", () => {
  const bearings = [
    null,
    0,
    30,
    44,
    45,
    100,
    135,
    180,
    224,
    225,
    300,
    315,
    359,
  ];
  const mapBearings = [0, 45, 90, 180, 315];

  it("agree with placementFor for every heading and map rotation", () => {
    for (const mapBearing of mapBearings) {
      for (const bearing of bearings) {
        const expected = placementFor(bearing, mapBearing);
        expect(
          evaluate(vehicleLabelAnchor(mapBearing), "text-anchor", bearing),
        ).toBe(expected.anchor);
        expect(
          evaluate(vehicleLabelOffset(mapBearing), "text-offset", bearing),
        ).toEqual(expected.offset);
      }
    }
  });
});

describe("quantiseMapBearing", () => {
  it("rounds to the step and normalises into [0, 360)", () => {
    expect(quantiseMapBearing(7)).toBe(0);
    expect(quantiseMapBearing(8)).toBe(15);
    expect(quantiseMapBearing(-30)).toBe(330);
    expect(quantiseMapBearing(358)).toBe(0);
  });
});
