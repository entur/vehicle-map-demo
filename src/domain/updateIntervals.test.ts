import { describe, expect, it } from "vitest";
import { VehicleUpdate } from "../types.ts";
import {
  bucketIndex,
  FORGET_AFTER_MS,
  INTERVAL_BUCKETS,
  intervalHistogram,
  IntervalRecords,
  intervalsByCodespace,
  recordReports,
  recordsMatching,
} from "./updateIntervals.ts";

const T0 = Date.parse("2026-11-16T12:00:00Z");

function report(
  vehicleId: string,
  secondsAfterT0: number,
  codespaceId = "AAA",
  journey = "J1",
  operatorRef = "OP1",
  location = { latitude: 60, longitude: 10 },
): VehicleUpdate {
  return {
    vehicleId,
    codespace: { codespaceId },
    operator: { operatorRef, name: operatorRef },
    location,
    serviceJourney: { id: journey, date: "2026-11-16" },
    lastUpdated: new Date(T0 + secondsAfterT0 * 1000).toISOString(),
  } as VehicleUpdate;
}

function feed(records: IntervalRecords, ...frames: VehicleUpdate[][]) {
  frames.forEach((frame) => recordReports(records, frame, T0));
}

describe("recordReports", () => {
  it("records the gap between consecutive reports", () => {
    const records: IntervalRecords = new Map();
    feed(records, [report("v1", 0)], [report("v1", 3)], [report("v1", 7)]);
    expect(records.get("v1_J1")?.intervals).toEqual([3, 4]);
  });

  it("ignores the same report seen again in later frames", () => {
    const records: IntervalRecords = new Map();
    feed(records, [report("v1", 0)], [report("v1", 0)], [report("v1", 60)]);
    expect(records.get("v1_J1")?.intervals).toEqual([60]);
  });

  it("tracks one vehicle on two journeys separately", () => {
    const records: IntervalRecords = new Map();
    feed(records, [report("v1", 0, "AAA", "J1"), report("v1", 5, "AAA", "J2")]);
    expect(records.size).toBe(2);
  });

  it("keeps only the five most recent intervals", () => {
    const records: IntervalRecords = new Map();
    for (let i = 0; i <= 7; i++) feed(records, [report("v1", i * 10 + i)]);
    expect(records.get("v1_J1")?.intervals).toHaveLength(5);
  });

  it("drops a gap long enough to be a vehicle leaving and returning", () => {
    const records: IntervalRecords = new Map();
    const later = FORGET_AFTER_MS / 1000 + 1;
    feed(records, [report("v1", 0)]);
    recordReports(records, [report("v1", later)], T0 + later * 1000);
    expect(records.get("v1_J1")?.intervals).toEqual([]);
  });

  it("forgets vehicles silent for too long", () => {
    const records: IntervalRecords = new Map();
    feed(records, [report("v1", 0)]);
    recordReports(records, [], T0 + FORGET_AFTER_MS + 1);
    expect(records.size).toBe(0);
  });
});

describe("bucketIndex", () => {
  it("puts every interval in exactly one bucket", () => {
    expect(bucketIndex(0)).toBe(0);
    expect(bucketIndex(2)).toBe(1);
    expect(bucketIndex(60)).toBe(5);
    expect(bucketIndex(600)).toBe(INTERVAL_BUCKETS.length - 1);
  });
});

describe("intervalHistogram", () => {
  it("counts each vehicle once, by its median interval", () => {
    const records: IntervalRecords = new Map();
    feed(
      records,
      [report("fast", 0), report("slow", 0), report("new", 0)],
      [report("fast", 1), report("slow", 60)],
      // One outlier does not move the fast vehicle out of its bucket.
      [report("fast", 31)],
      [report("fast", 32)],
    );
    const { counts, pending } = intervalHistogram(records.values());
    expect(counts[bucketIndex(1)]).toBe(1);
    expect(counts[bucketIndex(60)]).toBe(1);
    expect(counts.reduce((a, b) => a + b)).toBe(2);
    expect(pending).toBe(1);
  });
});

describe("intervalsByCodespace", () => {
  it("gives the median interval per codespace, most vehicles first", () => {
    const records: IntervalRecords = new Map();
    feed(
      records,
      [report("a1", 0, "AAA"), report("a2", 0, "AAA"), report("b1", 0, "BBB")],
      [report("a1", 2, "AAA"), report("a2", 4, "AAA"), report("b1", 60, "BBB")],
    );
    expect(intervalsByCodespace(records.values())).toEqual([
      { codespaceId: "AAA", vehicles: 2, medianSeconds: 3 },
      { codespaceId: "BBB", vehicles: 1, medianSeconds: 60 },
    ]);
  });
});

describe("recordsMatching", () => {
  const records: IntervalRecords = new Map();
  feed(records, [
    report("a", 0, "AAA", "J1", "OP1", { latitude: 60, longitude: 10 }),
    report("b", 0, "BBB", "J1", "OP2", { latitude: 60, longitude: 10 }),
    report("c", 0, "AAA", "J1", "OP1", { latitude: 70, longitude: 25 }),
  ]);
  const box = [
    [5, 58],
    [12, 62],
  ];
  const ids = (filter: Parameters<typeof recordsMatching>[1]) =>
    recordsMatching(records, filter).map(
      (r) => `${r.codespaceId}${r.location}`,
    );

  it("keeps everything without a filter", () => {
    expect(recordsMatching(records, null)).toHaveLength(3);
  });

  it("narrows by the map's view", () => {
    expect(ids({ boundingBox: box })).toHaveLength(2);
  });

  it("narrows by codespace, like the map", () => {
    expect(ids({ boundingBox: box, codespaceId: "AAA" })).toEqual(["AAA10,60"]);
  });

  it("narrows by operator, like the map", () => {
    expect(ids({ boundingBox: box, operatorRef: "OP2" })).toEqual(["BBB10,60"]);
  });

  it("follows a vehicle to its latest position", () => {
    const moving: IntervalRecords = new Map();
    feed(
      moving,
      [report("m", 0, "AAA", "J1", "OP1", { latitude: 60, longitude: 10 })],
      [report("m", 5, "AAA", "J1", "OP1", { latitude: 70, longitude: 25 })],
    );
    expect(recordsMatching(moving, { boundingBox: box })).toHaveLength(0);
  });
});
