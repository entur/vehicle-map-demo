import { describe, expect, it } from "vitest";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";
import {
  GhostCall,
  buildSchedule,
  locateCalls,
  measureRoute,
  pointAlong,
  scheduledDistance,
} from "./scheduleGhost.ts";

const LAT = 59.91;
const METRES_PER_DEGREE_LON =
  METRES_PER_DEGREE_LAT * Math.cos((LAT * Math.PI) / 180);

/** A point `east` metres east and `north` metres north of [10.7, LAT]. */
function at(east: number, north = 0): [number, number] {
  return [
    10.7 + east / METRES_PER_DEGREE_LON,
    LAT + north / METRES_PER_DEGREE_LAT,
  ];
}

/** Due east, 2 km, a vertex every 500 m. */
const STRAIGHT = [at(0), at(500), at(1000), at(1500), at(2000)];

const T0 = Date.parse("2026-10-02T12:00:00Z");
const minutes = (n: number) => new Date(T0 + n * 60_000).toISOString();

function call(
  position: [number, number],
  arrival: string | null,
  departure: string | null = arrival,
): GhostCall {
  return {
    stopPoint: {
      location: { longitude: position[0], latitude: position[1] },
    },
    aimedArrivalTime: arrival,
    aimedDepartureTime: departure,
  };
}

describe("measureRoute", () => {
  it("accumulates the length of each segment", () => {
    const route = measureRoute(STRAIGHT);
    expect(route.cumulative).toHaveLength(5);
    expect(route.cumulative[0]).toBe(0);
    expect(route.cumulative[4]).toBeCloseTo(2000, -1);
  });
});

describe("locateCalls", () => {
  const route = measureRoute(STRAIGHT);

  it("places each stop at its distance along the route", () => {
    const located = locateCalls(route, [
      call(at(0), null, minutes(0)),
      call(at(750, 40), minutes(2), minutes(3)),
      call(at(2000), minutes(5), null),
    ]);
    expect(located.map((c) => Math.round(c.distance / 10) * 10)).toEqual([
      0, 750, 2000,
    ]);
    expect(located[1].arrival).toBe(T0 + 2 * 60_000);
    expect(located[1].departure).toBe(T0 + 3 * 60_000);
  });

  it("uses whichever aimed time a stop has for both", () => {
    const [first, last] = locateCalls(route, [
      call(at(0), null, minutes(0)),
      call(at(2000), minutes(5), null),
    ]);
    expect(first.arrival).toBe(T0);
    expect(last.departure).toBe(T0 + 5 * 60_000);
  });

  it("drops a stop too far from the route", () => {
    const located = locateCalls(route, [
      call(at(0), minutes(0)),
      call(at(1000, 500), minutes(2)),
      call(at(2000), minutes(5)),
    ]);
    expect(located).toHaveLength(2);
  });

  it("drops a stop with no aimed time", () => {
    const located = locateCalls(route, [
      call(at(0), minutes(0)),
      call(at(1000), null, null),
      call(at(2000), minutes(5)),
    ]);
    expect(located).toHaveLength(2);
  });

  it("drops a stop whose time runs backwards", () => {
    const located = locateCalls(route, [
      call(at(0), minutes(0)),
      call(at(1000), minutes(-3)),
      call(at(2000), minutes(5)),
    ]);
    expect(located.map((c) => c.arrival)).toEqual([T0, T0 + 5 * 60_000]);
  });

  it("finds a stop on the return leg of a route that doubles back", () => {
    // Out 2 km east, then back west 50 m further north.
    const loop = measureRoute([
      ...STRAIGHT,
      at(2000, 50),
      at(1000, 50),
      at(0, 50),
    ]);
    const located = locateCalls(loop, [
      call(at(0), minutes(0)),
      call(at(2000), minutes(5)),
      call(at(200, 50), minutes(9)),
    ]);
    // 2000 out, 50 across, 1800 back.
    expect(located[2].distance).toBeCloseTo(3850, -1);
  });
});

describe("scheduledDistance", () => {
  const route = measureRoute(STRAIGHT);
  const calls = locateCalls(route, [
    call(at(0), null, minutes(0)),
    call(at(1000), minutes(4), minutes(6)),
    call(at(2000), minutes(10), null),
  ]);
  const now = (n: number) => T0 + n * 60_000;

  it("waits at the origin before the first departure", () => {
    expect(scheduledDistance(calls, now(-5))).toBeCloseTo(0, 0);
  });

  it("moves at constant speed between stops", () => {
    expect(scheduledDistance(calls, now(2))).toBeCloseTo(500, -1);
    expect(scheduledDistance(calls, now(8))).toBeCloseTo(1500, -1);
  });

  it("waits at a stop between its arrival and departure", () => {
    expect(scheduledDistance(calls, now(4))).toBeCloseTo(1000, -1);
    expect(scheduledDistance(calls, now(5))).toBeCloseTo(1000, -1);
    expect(scheduledDistance(calls, now(6))).toBeCloseTo(1000, -1);
  });

  it("stays at the destination after the last arrival", () => {
    expect(scheduledDistance(calls, now(30))).toBeCloseTo(2000, -1);
  });

  it("has nothing to say with fewer than two stops", () => {
    expect(scheduledDistance(calls.slice(0, 1), now(2))).toBeNull();
    expect(scheduledDistance([], now(2))).toBeNull();
  });

  it("jumps rather than divides by zero when two stops share a time", () => {
    const sameTime = locateCalls(route, [
      call(at(0), minutes(0)),
      call(at(1000), minutes(0)),
    ]);
    expect(scheduledDistance(sameTime, now(0))).not.toBeNaN();
  });
});

describe("pointAlong", () => {
  const route = measureRoute(STRAIGHT);

  it("interpolates within a segment and heads along it", () => {
    const { coordinates, bearing } = pointAlong(route, 750);
    expect(coordinates[0]).toBeCloseTo(at(750)[0], 6);
    expect(coordinates[1]).toBeCloseTo(LAT, 6);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it("clamps to the ends", () => {
    expect(pointAlong(route, -10).coordinates).toEqual(STRAIGHT[0]);
    expect(pointAlong(route, 1e6).coordinates).toEqual(STRAIGHT[4]);
    expect(pointAlong(route, 1e6).bearing).toBeCloseTo(90, 0);
  });

  it("takes the heading past a repeated vertex", () => {
    const repeated = measureRoute([at(0), at(0), at(0, 500)]);
    expect(pointAlong(repeated, 0).bearing).toBeCloseTo(0, 0);
  });

  it("has no heading on a route of one point", () => {
    expect(pointAlong(measureRoute([at(0)]), 0).bearing).toBeNull();
  });
});

describe("buildSchedule", () => {
  const calls = [call(at(0), minutes(0)), call(at(2000), minutes(5))];

  it("follows a running trip with a route and two placed stops", () => {
    const schedule = buildSchedule(STRAIGHT, { cancellation: false, calls });
    expect(schedule?.calls).toHaveLength(2);
  });

  it("is null without a route or a timetable", () => {
    expect(buildSchedule(null, { cancellation: false, calls })).toBeNull();
    expect(buildSchedule([at(0)], { cancellation: false, calls })).toBeNull();
    expect(buildSchedule(STRAIGHT, null)).toBeNull();
  });

  it("is null for a cancelled trip", () => {
    expect(buildSchedule(STRAIGHT, { cancellation: true, calls })).toBeNull();
  });

  it("is null with fewer than two stops on the route", () => {
    const offRoute = [call(at(0), minutes(0)), call(at(2000, 900), minutes(5))];
    expect(
      buildSchedule(STRAIGHT, { cancellation: false, calls: offRoute }),
    ).toBeNull();
  });
});
