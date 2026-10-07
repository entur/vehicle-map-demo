import { describe, expect, it } from "vitest";
import {
  CandidatePool,
  FRESH_REPORT_MS,
  KioskVehicle,
  SnapshotVehicle,
  isGoodCandidate,
  maxDataAgeSecondsOf,
  pickCandidate,
  toKioskVehicle,
  vehicleKey,
} from "./kioskCandidates.ts";

const NOW = Date.parse("2026-10-05T12:00:00Z");

function vehicle(
  id: string,
  overrides: Partial<KioskVehicle> = {},
): KioskVehicle {
  const vehicleId = overrides.vehicleId ?? id;
  const serviceJourneyId = overrides.serviceJourneyId ?? `SJ:${id}`;
  return {
    vehicleId,
    serviceJourneyId,
    date: "2026-10-05",
    codespaceId: "ATB",
    mode: "BUS",
    lineCode: "3",
    destinationName: "Hallset",
    lon: 10.4,
    lat: 63.43,
    lastUpdated: NOW - 2_000,
    monitored: true,
    ...overrides,
    key: vehicleKey(vehicleId, serviceJourneyId),
  };
}

// 0.001° of latitude is about 111 m; 0.0008° about 89 m.
function moved(v: KioskVehicle, dLat: number): KioskVehicle {
  return { ...v, lat: v.lat + dLat };
}

function pool(
  current: KioskVehicle[] | null,
  previous: KioskVehicle[] | null = null,
  maxDataAgeSeconds = 30,
): CandidatePool {
  return {
    current: current && { fetchedAt: NOW, vehicles: current },
    previous: previous && { fetchedAt: NOW - 60_000, vehicles: previous },
    maxDataAgeSeconds,
  };
}

function byKey(vehicles: KioskVehicle[]) {
  return new Map(vehicles.map((v) => [v.key, v]));
}

describe("toKioskVehicle", () => {
  const raw: SnapshotVehicle = {
    vehicleId: "V1",
    serviceJourney: { id: "SJ:1", date: "2026-10-05" },
    codespace: { codespaceId: "ATB" },
    mode: "BUS",
    line: { publicCode: "3" },
    destinationName: "Hallset",
    lastUpdated: "2026-10-05T11:59:58Z",
    monitored: true,
    location: { latitude: 63.43, longitude: 10.4 },
  };

  it("maps a snapshot record", () => {
    expect(toKioskVehicle(raw)).toEqual({
      key: "V1_SJ:1",
      vehicleId: "V1",
      serviceJourneyId: "SJ:1",
      date: "2026-10-05",
      codespaceId: "ATB",
      mode: "BUS",
      lineCode: "3",
      destinationName: "Hallset",
      lon: 10.4,
      lat: 63.43,
      lastUpdated: NOW - 2_000,
      monitored: true,
    });
  });

  it("drops a record with no usable location", () => {
    expect(toKioskVehicle({ ...raw, location: null })).toBeNull();
    expect(
      toKioskVehicle({ ...raw, location: { latitude: 0, longitude: 0 } }),
    ).toBeNull();
    expect(
      toKioskVehicle({ ...raw, location: { latitude: 91, longitude: 10 } }),
    ).toBeNull();
  });

  it("drops a record whose lastUpdated does not parse", () => {
    expect(toKioskVehicle({ ...raw, lastUpdated: "soon" })).toBeNull();
  });

  it("treats a missing monitored flag as not monitored", () => {
    expect(toKioskVehicle({ ...raw, monitored: null })?.monitored).toBe(false);
  });
});

describe("maxDataAgeSecondsOf", () => {
  it("defaults to the live subscription's 30 s", () => {
    expect(maxDataAgeSecondsOf({})).toBe(30);
  });

  it("reads a number or the string the URL leaves", () => {
    expect(maxDataAgeSecondsOf({ maxDataAge: 120 })).toBe(120);
    expect(maxDataAgeSecondsOf({ maxDataAge: "90" as unknown as number })).toBe(
      90,
    );
  });

  it("falls back on zero or garbage", () => {
    expect(maxDataAgeSecondsOf({ maxDataAge: 0 })).toBe(30);
    expect(
      maxDataAgeSecondsOf({ maxDataAge: "abc" as unknown as number }),
    ).toBe(30);
  });
});

describe("isGoodCandidate", () => {
  const before = vehicle("a");

  it("accepts a monitored, fresh vehicle that moved at least 100 m", () => {
    expect(isGoodCandidate(moved(before, 0.001), byKey([before]), NOW)).toBe(
      true,
    );
  });

  it("rejects one that moved less than 100 m", () => {
    expect(isGoodCandidate(moved(before, 0.0008), byKey([before]), NOW)).toBe(
      false,
    );
  });

  it("rejects one not in the previous snapshot, or with none", () => {
    expect(isGoodCandidate(moved(before, 0.001), new Map(), NOW)).toBe(false);
    expect(isGoodCandidate(moved(before, 0.001), null, NOW)).toBe(false);
  });

  it("does not compare a vehicle with itself on another journey", () => {
    const old = vehicle("a", { serviceJourneyId: "SJ:old" });
    const now = moved(vehicle("a", { serviceJourneyId: "SJ:new" }), 0.001);
    expect(isGoodCandidate(now, byKey([old]), NOW)).toBe(false);
  });

  it("rejects an unmonitored vehicle", () => {
    expect(
      isGoodCandidate(
        moved({ ...before, monitored: false }, 0.001),
        byKey([before]),
        NOW,
      ),
    ).toBe(false);
  });

  it("accepts a report exactly 10 s old and rejects an older one", () => {
    const at = (lastUpdated: number) =>
      isGoodCandidate(
        moved({ ...before, lastUpdated }, 0.001),
        byKey([before]),
        NOW,
      );
    expect(at(NOW - FRESH_REPORT_MS)).toBe(true);
    expect(at(NOW - FRESH_REPORT_MS - 1)).toBe(false);
  });
});

describe("pickCandidate", () => {
  it("returns null with no snapshot", () => {
    expect(pickCandidate(pool(null), [], 0)).toBeNull();
  });

  it("returns null when nothing is younger than maxDataAge", () => {
    const stale = vehicle("a", { lastUpdated: NOW - 31_000 });
    expect(pickCandidate(pool([stale]), [], 0)).toBeNull();
  });

  it("judges age against the snapshot's fetch, not the time of the pick", () => {
    // The pick is made 40 s after this fetch: the snapshot is polled every
    // 60 s, so a pick usually is. Ages are what they were when fetched.
    const fetchedAt = NOW - 40_000;
    const recent = vehicle("a", { lastUpdated: fetchedAt - 5_000 });
    const old = vehicle("b", { lastUpdated: fetchedAt - 31_000 });
    const fetched = (vehicles: KioskVehicle[]): CandidatePool => ({
      current: { fetchedAt, vehicles },
      previous: null,
      maxDataAgeSeconds: 30,
    });
    expect(pickCandidate(fetched([recent]), [], 0)?.key).toBe(recent.key);
    expect(pickCandidate(fetched([old]), [], 0)).toBeNull();
  });

  it("prefers a good candidate over a vehicle standing still", () => {
    const still = vehicle("a");
    const going = vehicle("b");
    const current = [still, moved(going, 0.001)];
    for (const random of [0, 0.5, 0.999]) {
      expect(
        pickCandidate(pool(current, [still, going]), [], random)?.key,
      ).toBe(going.key);
    }
  });

  it("falls back to any eligible vehicle when none is good", () => {
    const current = [vehicle("a"), vehicle("b")];
    expect(pickCandidate(pool(current), [], 0)?.vehicleId).toBe("a");
    expect(pickCandidate(pool(current), [], 0.5)?.vehicleId).toBe("b");
    expect(pickCandidate(pool(current), [], 0.999)?.vehicleId).toBe("b");
  });

  it("skips recent picks while anything else is eligible", () => {
    const a = vehicle("a");
    const b = vehicle("b");
    expect(pickCandidate(pool([a, b]), [a.key], 0)?.key).toBe(b.key);
  });

  it("allows a recent pick back when it is all there is", () => {
    const a = vehicle("a");
    expect(pickCandidate(pool([a]), [a.key], 0)?.key).toBe(a.key);
  });

  // About a third of the feed publishes no line code, whole codespaces at a
  // time, and a caption without one says nothing to a passer-by.
  it("prefers a vehicle that publishes a line code", () => {
    const unlabelled = vehicle("a", { lineCode: "", destinationName: null });
    const labelled = vehicle("b");
    for (const random of [0, 0.5, 0.999]) {
      expect(pickCandidate(pool([unlabelled, labelled]), [], random)?.key).toBe(
        labelled.key,
      );
    }
  });

  it("prefers a line code over moving", () => {
    const unlabelled = vehicle("a", { lineCode: "" });
    const still = vehicle("b");
    const current = [moved(unlabelled, 0.001), still];
    expect(pickCandidate(pool(current, [unlabelled, still]), [], 0)?.key).toBe(
      still.key,
    );
  });

  it("prefers a moving vehicle among those with a line code", () => {
    const unlabelled = vehicle("a", { lineCode: "" });
    const still = vehicle("b");
    const going = vehicle("c");
    const current = [moved(unlabelled, 0.001), still, moved(going, 0.001)];
    const previous = [unlabelled, still, going];
    for (const random of [0, 0.5, 0.999]) {
      expect(pickCandidate(pool(current, previous), [], random)?.key).toBe(
        going.key,
      );
    }
  });

  it("falls back to a vehicle without a line code when it is all there is", () => {
    const unlabelled = vehicle("a", { lineCode: "" });
    expect(pickCandidate(pool([unlabelled]), [], 0)?.key).toBe(unlabelled.key);
  });

  it("never picks a vehicle older than maxDataAge, however good", () => {
    const before = vehicle("a", { lastUpdated: NOW - 70_000 });
    const after = moved({ ...before, lastUpdated: NOW - 40_000 }, 0.001);
    const fallback = vehicle("b");
    expect(pickCandidate(pool([after, fallback], [before]), [], 0)?.key).toBe(
      fallback.key,
    );
  });
});
