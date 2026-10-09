import { describe, expect, it } from "vitest";
import {
  JourneyStopCall,
  journeyStopFeatures,
  polesInView,
  routeBearingAt,
  routeBearings,
  sameStopPoles,
  stopPoles,
} from "./journeyStops.ts";

function call(
  order: number,
  name: string,
  longitude: number,
  latitude: number,
  overrides: Partial<JourneyStopCall> = {},
): JourneyStopCall {
  return {
    stopPoint: {
      id: `NSR:Quay:${order}`,
      name,
      location: { latitude, longitude },
    },
    order,
    callType: "ESTIMATED",
    cancellation: false,
    ...overrides,
  };
}

describe("journeyStopFeatures", () => {
  it("is empty without calls", () => {
    expect(journeyStopFeatures(null).features).toEqual([]);
    expect(journeyStopFeatures([]).features).toEqual([]);
  });

  it("draws one point per call, at the stop's location", () => {
    const { features } = journeyStopFeatures([
      call(1, "Jernbanetorget", 10.75, 59.91),
      call(2, "Stortinget", 10.74, 59.913),
    ]);

    expect(features).toHaveLength(2);
    expect(features[0].geometry).toEqual({
      type: "Point",
      coordinates: [10.75, 59.91],
    });
    expect(features[1].properties).toMatchObject({
      name: "Stortinget",
      stopId: "NSR:Quay:2",
      order: 2,
    });
  });

  it("marks recorded calls as passed and cancelled calls as cancelled", () => {
    const { features } = journeyStopFeatures([
      call(1, "A", 10.7, 59.9, { callType: "RECORDED" }),
      call(2, "B", 10.71, 59.9, { cancellation: true }),
      call(3, "C", 10.72, 59.9),
    ]);

    expect(features.map((f) => f.properties)).toMatchObject([
      { passed: true, cancelled: false },
      { passed: false, cancelled: true },
      { passed: false, cancelled: false },
    ]);
  });

  it("keeps a stop the journey visits twice as two calls", () => {
    const { features } = journeyStopFeatures([
      call(1, "Loop", 10.7, 59.9),
      call(2, "Middle", 10.71, 59.9),
      call(3, "Loop", 10.7, 59.9, {
        stopPoint: {
          id: "NSR:Quay:1",
          name: "Loop",
          location: { latitude: 59.9, longitude: 10.7 },
        },
      }),
    ]);

    expect(features.map((f) => f.properties?.order)).toEqual([1, 2, 3]);
  });

  it("skips a call whose stop has no usable location", () => {
    const missing = call(2, "Nowhere", 0, 0);
    // The type promises a location; the feed does not always deliver one.
    (missing.stopPoint as { location: unknown }).location = null;

    const { features } = journeyStopFeatures([
      call(1, "A", 10.7, 59.9),
      missing,
      call(3, "B", Number.NaN, 59.9),
    ]);

    expect(features.map((f) => f.properties?.name)).toEqual(["A"]);
  });
});

describe("routeBearingAt", () => {
  // An L: east along the equator-ish parallel, then north.
  const route = [
    [10.7, 59.9],
    [10.71, 59.9],
    [10.71, 59.91],
  ];

  it("is the bearing of the route's nearest segment", () => {
    expect(routeBearingAt(route, [10.705, 59.9001])).toBeCloseTo(90, 0);
    expect(routeBearingAt(route, [10.7101, 59.905])).toBeCloseTo(0, 0);
  });

  it("follows the route's direction, not just its line", () => {
    const reversed = [...route].reverse();
    expect(routeBearingAt(reversed, [10.705, 59.9001])).toBeCloseTo(270, 0);
  });

  it("is null without a route to measure", () => {
    expect(routeBearingAt(null, [10.7, 59.9])).toBeNull();
    expect(routeBearingAt([[10.7, 59.9]], [10.7, 59.9])).toBeNull();
  });
});

describe("stopPoles", () => {
  const route = [
    [10.7, 59.9],
    [10.72, 59.9],
  ];

  it("places a pole at each stop, facing along the route", () => {
    const stops = journeyStopFeatures([
      call(1, "A", 10.705, 59.9),
      call(2, "B", 10.715, 59.9, { callType: "RECORDED" }),
    ]);
    const poles = stopPoles(stops, routeBearings(route));

    expect(poles).toHaveLength(2);
    expect(poles[0]).toMatchObject({ name: "A", position: [10.705, 59.9] });
    expect(poles[0].bearing).toBeCloseTo(90, 5);
    expect(poles[1]).toMatchObject({ name: "B", passed: true });
  });

  it("faces north with no route", () => {
    const poles = stopPoles(
      journeyStopFeatures([call(1, "A", 10.7, 59.9)]),
      routeBearings(null),
    );
    expect(poles[0].bearing).toBe(0);
  });

  it("keys two calls apart even when the feed numbers them alike", () => {
    const poles = stopPoles(
      journeyStopFeatures([call(1, "A", 10.7, 59.9), call(1, "A", 10.7, 59.9)]),
      routeBearings(null),
    );
    expect(new Set(poles.map((pole) => pole.key)).size).toBe(2);
  });
});

describe("routeBearings", () => {
  it("scans the route once per stop position", () => {
    let reads = 0;
    const route = new Proxy(
      [
        [10.7, 59.9],
        [10.72, 59.9],
      ],
      {
        get(target, property, receiver) {
          if (property === "length") reads++;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const bearingAt = routeBearings(route);
    bearingAt([10.71, 59.9]);
    const afterFirst = reads;
    expect(bearingAt([10.71, 59.9])).toBeCloseTo(90, 5);
    expect(reads).toBe(afterFirst);
  });
});

describe("sameStopPoles", () => {
  const poles = () =>
    stopPoles(
      journeyStopFeatures([
        call(1, "A", 10.7, 59.9),
        call(2, "B", 10.71, 59.9),
      ]),
      routeBearings(null),
    );

  it("holds for a new frame that changes nothing a pole shows", () => {
    expect(sameStopPoles(poles(), poles())).toBe(true);
  });

  it("fails when a call is recorded, cancelled or added", () => {
    const passed = poles();
    passed[0] = { ...passed[0], passed: true };
    const cancelled = poles();
    cancelled[1] = { ...cancelled[1], cancelled: true };
    expect(sameStopPoles(poles(), passed)).toBe(false);
    expect(sameStopPoles(poles(), cancelled)).toBe(false);
    expect(sameStopPoles(poles(), poles().slice(1))).toBe(false);
  });
});

describe("polesInView", () => {
  it("keeps the poles in the view and drops the rest", () => {
    const poles = stopPoles(
      journeyStopFeatures([
        call(1, "In", 10.75, 59.91),
        call(2, "Far", 11.5, 60.5),
      ]),
      routeBearings(null),
    );
    const inView = polesInView(poles, [
      [10.74, 59.9],
      [10.76, 59.92],
    ]);
    expect(inView.map((pole) => pole.name)).toEqual(["In"]);
  });
});
