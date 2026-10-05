import { describe, expect, it } from "vitest";
import type { Call, EstimatedTimetableUpdate } from "../types.ts";
import {
  callsFor,
  journeyEnded,
  kioskWorld,
  lastArrivalAt,
  trackStillness,
  upcomingCalls,
} from "./kioskJourney.ts";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const HERE = { lon: 10.4, lat: 63.43 };
// 0.0002° of latitude is about 22 m; 0.0003° about 33 m.
const near = { lon: 10.4, lat: 63.4302 };
const away = { lon: 10.4, lat: 63.4303 };

function call(order: number, overrides: Partial<Call> = {}): Call {
  return {
    stopPoint: {
      id: `NSR:Quay:${order}`,
      name: `Stop ${order}`,
      location: { latitude: 63.43, longitude: 10.4 },
    },
    order,
    aimedArrivalTime: null,
    aimedDepartureTime: null,
    expectedArrivalTime: null,
    expectedDepartureTime: null,
    actualArrivalTime: null,
    actualDepartureTime: null,
    callType: "ESTIMATED",
    cancellation: false,
    forBoarding: null,
    occupancyStatus: null,
    situations: null,
    ...overrides,
  };
}

function timetable(id: string, calls: Call[]): EstimatedTimetableUpdate {
  return {
    serviceJourney: { id, date: "2026-10-05" },
    line: { lineRef: "ATB:Line:3", lineName: "3", publicCode: "3" },
    mode: "BUS",
    originName: "Lohove",
    destinationName: "Hallset",
    cancellation: false,
    calls,
    situations: null,
  };
}

describe("trackStillness", () => {
  it("starts at the first position", () => {
    expect(trackStillness(null, HERE, NOW)).toEqual({
      anchor: HERE,
      since: NOW,
    });
  });

  it("keeps the anchor while the vehicle stays within 25 m", () => {
    const prev = { anchor: HERE, since: NOW };
    expect(trackStillness(prev, near, NOW + 5_000)).toBe(prev);
  });

  it("moves the anchor once the vehicle leaves 25 m", () => {
    const prev = { anchor: HERE, since: NOW };
    expect(trackStillness(prev, away, NOW + 5_000)).toEqual({
      anchor: away,
      since: NOW + 5_000,
    });
  });
});

describe("journeyEnded", () => {
  it("is false with no calls or before the last arrival", () => {
    expect(journeyEnded([])).toBe(false);
    expect(
      journeyEnded([
        call(1, { actualArrivalTime: "2026-10-05T11:50:00Z" }),
        call(2),
      ]),
    ).toBe(false);
  });

  it("is true once the last call has an actual arrival", () => {
    expect(
      journeyEnded([
        call(1),
        call(2, { actualArrivalTime: "2026-10-05T11:59:00Z" }),
      ]),
    ).toBe(true);
  });
});

describe("lastArrivalAt", () => {
  it("is null with no actual arrivals", () => {
    expect(lastArrivalAt([call(1), call(2)])).toBeNull();
  });

  it("is the latest actual arrival, ignoring unparseable ones", () => {
    expect(
      lastArrivalAt([
        call(1, { actualArrivalTime: "2026-10-05T11:50:00Z" }),
        call(2, { actualArrivalTime: "2026-10-05T11:55:00Z" }),
        call(3, { actualArrivalTime: "garbage" }),
      ]),
    ).toBe(Date.parse("2026-10-05T11:55:00Z"));
  });
});

describe("upcomingCalls", () => {
  it("skips calls already departed and keeps the one at the stop", () => {
    const calls = [
      call(1, { actualDepartureTime: "2026-10-05T11:50:00Z" }),
      call(2, { actualArrivalTime: "2026-10-05T11:59:00Z" }),
      call(3),
    ];
    expect(upcomingCalls(calls).map((c) => c.order)).toEqual([2, 3]);
  });

  it("returns at most five by default", () => {
    const calls = [1, 2, 3, 4, 5, 6, 7].map((n) => call(n));
    expect(upcomingCalls(calls).map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("callsFor", () => {
  it("returns the calls of the target's own journey", () => {
    const calls = [call(1)];
    expect(callsFor(timetable("SJ:1", calls), "SJ:1")).toBe(calls);
  });

  it("ignores a timetable left over from another journey", () => {
    expect(callsFor(timetable("SJ:old", [call(1)]), "SJ:new")).toBeNull();
    expect(callsFor(null, "SJ:1")).toBeNull();
  });
});

describe("kioskWorld", () => {
  it("reports a vehicle missing from the feed", () => {
    const { world, stillness } = kioskWorld(null, null, null, NOW);
    expect(world).toEqual({
      targetInFeed: false,
      stillForMs: 0,
      journeyEnded: false,
      lastArrivalAt: null,
    });
    expect(stillness).toBeNull();
  });

  it("measures how long the vehicle has stood still", () => {
    const first = kioskWorld(HERE, null, null, NOW);
    const later = kioskWorld(near, null, first.stillness, NOW + 30_000);
    expect(later.world.stillForMs).toBe(30_000);
    expect(later.world.targetInFeed).toBe(true);
  });

  it("reads journey end and last arrival from the calls", () => {
    const calls = [
      call(1, { actualArrivalTime: "2026-10-05T11:58:00Z" }),
      call(2, { actualArrivalTime: "2026-10-05T11:59:00Z" }),
    ];
    const { world } = kioskWorld(HERE, calls, null, NOW);
    expect(world.journeyEnded).toBe(true);
    expect(world.lastArrivalAt).toBe(Date.parse("2026-10-05T11:59:00Z"));
  });
});
