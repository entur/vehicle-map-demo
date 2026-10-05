# Kiosk Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?kiosk=<seconds>` makes vehicles mode run unattended on a wall screen: pick a vehicle the filter allows, chase it, move on at a stop after the dwell, pause when touched and resume — with its own setup restored — when left alone.

**Architecture:** All decisions are pure TypeScript in `src/domain/` — candidate choice (`kioskCandidates.ts`), journey signals (`kioskJourney.ts`) and a state machine with a pure `step` reducer plus an `effectsOf(prev, next)` list of side effects (`kioskSchedule.ts`). One hook, `useKiosk`, feeds the machine ticks and input and performs the effects through callbacks `MapView` already has (select, start/stop chase, switch mode, set filter). `KioskOverlay` draws the band, the transition caption and the paused pill.

**Tech Stack:** React 19, TypeScript, MUI 9, react-map-gl/maplibre (MapLibre 6), Vitest (node env, `src/**/*.test.ts` only), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-kiosk-mode-design.md`

## Global Constraints

- Local imports carry the explicit `.ts`/`.tsx` extension.
- ESM only; `import type` for type-only imports where the file already does so.
- Lint is `npm run lint -- --max-warnings 0`; a warning fails CI. `react-refresh/only-export-components` warns on a `.tsx` that exports anything but components — put exported functions in `.ts` files.
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` checks nothing).
- Vitest collects only `src/**/*.test.ts` in a node environment; all logic worth testing lives in `.ts`.
- Stage files by explicit path, never `git add -A` (`build/` and `*.iml` are untracked and not ignored).
- Work on the branch `kiosk-mode-spec`. Never push to `master`.
- Commit messages carry no AI attribution.
- Default dwell **180 s**; snapshot poll **60 s**; good candidate: moved **≥ 100 m**, `lastUpdated` **≤ 10 s** before fetch, `monitored`; recent picks **10**; lock-on timeout **15 s**; **3** misses → wait for next snapshot; stop-wait cap **dwell + 120 s**; stationary **≤ 25 m for 90 s**; idle before resume **120 s**; arrive zoom **14**.
- `MapBottomPadding` stays the only writer of the map's bottom padding.
- The attribution strip is never hidden.

## Deliberate deviations from the spec

- **Candidate query.** The spec names `useVehiclePositionsSnapshotFetcher`; its query selects every field of `VehicleUpdateComplete`, which polled unfiltered every minute is several MB. `useKioskCandidates` sends a lean query of the ten fields the kiosk reads through the same `graphqlRequest` util.
- **Leaving + arriving camera.** Rather than a `fitBounds` overview followed by a `flyTo`, there is one `flyTo`: MapLibre's flight already zooms out over long distances and back in, which is the overview the spec describes. The `leaving` phase remains as a fixed 1.5 s wait so the chase's exit ease and any 2D switch finish before the flight starts (a later ease in the same commit cancels an earlier one — see CLAUDE.md "Phone layout").
- **Playwright restore check** uses the mode (switch to situations while paused → `mode=vehicles` after resume) instead of the codespace, because the codespace control is an MUI `Select` inside a tool panel. Codespace restore is pinned by `restoredFilter` unit tests.
- **Band caption** shows the codespace, not the operator: the live subscription does not reliably select the operator's name.

## Review Focus

1. **Kiosk loaded on `?mode=situations&kiosk`** — expected to end up in vehicles mode once the first vehicle is picked. Pinned in Task 8 (Playwright).
2. **The flight's `moveend` arriving after a visitor already paused the kiosk** — expected to be ignored, not to jump the paused kiosk into lock-on. Pinned in Task 3 (`arrived` while paused).
3. **A timetable still in state for the previous journey** when the target changes — expected to be ignored, so the old journey's last stop cannot end the new chase. Pinned in Task 2 (`callsFor`).
4. **The same vehicle on a new journey between two snapshots** — expected not to count as "moved". Pinned in Task 1.
5. **Resume when the visitor changed nothing** — expected to keep the filter object, so the vehicle subscription is not reopened needlessly. Pinned in Task 3 (`restoredFilter` returns `prev`).

---

### Task 1: Candidate selection

**Files:**

- Create: `src/domain/kioskCandidates.ts`
- Test: `src/domain/kioskCandidates.test.ts`

**Interfaces:**

- Consumes: `distanceMetres(a: LngLat, b: LngLat): number` from `src/domain/chaseCamera.ts`; `Filter`, `VehicleModeEnumeration` from `src/types.ts`.
- Produces:
  - `type KioskVehicle = { key: string; vehicleId: string; serviceJourneyId: string; date: string; codespaceId: string | null; mode: VehicleModeEnumeration; lineCode: string; destinationName: string | null; lon: number; lat: number; lastUpdated: number; monitored: boolean }`
  - `type KioskSnapshot = { fetchedAt: number; vehicles: KioskVehicle[] }`
  - `type CandidatePool = { current: KioskSnapshot | null; previous: KioskSnapshot | null; maxDataAgeSeconds: number }`
  - `type SnapshotVehicle` (the GraphQL record)
  - `vehicleKey(vehicleId: string, serviceJourneyId: string): string`
  - `toKioskVehicle(raw: SnapshotVehicle): KioskVehicle | null`
  - `maxDataAgeSecondsOf(filter: Partial<Filter>): number`
  - `isGoodCandidate(vehicle: KioskVehicle, previous: Map<string, KioskVehicle> | null, fetchedAt: number): boolean`
  - `pickCandidate(pool: CandidatePool, recent: readonly string[], now: number, random: number): KioskVehicle | null`
  - constants `SNAPSHOT_INTERVAL_MS`, `MIN_MOVE_METRES`, `FRESH_REPORT_MS`, `RECENT_PICKS`, `DEFAULT_MAX_DATA_AGE_SECONDS`

- [ ] **Step 1: Write the failing test**

`src/domain/kioskCandidates.test.ts`:

```ts
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
    expect(pickCandidate(pool(null), [], NOW, 0)).toBeNull();
  });

  it("returns null when nothing is younger than maxDataAge", () => {
    const stale = vehicle("a", { lastUpdated: NOW - 31_000 });
    expect(pickCandidate(pool([stale]), [], NOW, 0)).toBeNull();
  });

  it("prefers a good candidate over a vehicle standing still", () => {
    const still = vehicle("a");
    const going = vehicle("b");
    const current = [still, moved(going, 0.001)];
    for (const random of [0, 0.5, 0.999]) {
      expect(
        pickCandidate(pool(current, [still, going]), [], NOW, random)?.key,
      ).toBe(going.key);
    }
  });

  it("falls back to any eligible vehicle when none is good", () => {
    const current = [vehicle("a"), vehicle("b")];
    expect(pickCandidate(pool(current), [], NOW, 0)?.vehicleId).toBe("a");
    expect(pickCandidate(pool(current), [], NOW, 0.5)?.vehicleId).toBe("b");
    expect(pickCandidate(pool(current), [], NOW, 0.999)?.vehicleId).toBe("b");
  });

  it("skips recent picks while anything else is eligible", () => {
    const a = vehicle("a");
    const b = vehicle("b");
    expect(pickCandidate(pool([a, b]), [a.key], NOW, 0)?.key).toBe(b.key);
  });

  it("allows a recent pick back when it is all there is", () => {
    const a = vehicle("a");
    expect(pickCandidate(pool([a]), [a.key], NOW, 0)?.key).toBe(a.key);
  });

  it("never picks a vehicle older than maxDataAge, however good", () => {
    const before = vehicle("a", { lastUpdated: NOW - 70_000 });
    const after = moved({ ...before, lastUpdated: NOW - 40_000 }, 0.001);
    const fallback = vehicle("b");
    expect(
      pickCandidate(pool([after, fallback], [before]), [], NOW, 0)?.key,
    ).toBe(fallback.key);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/kioskCandidates.test.ts`
Expected: FAIL — cannot resolve `./kioskCandidates.ts`.

- [ ] **Step 3: Write the implementation**

`src/domain/kioskCandidates.ts`:

```ts
import type { Filter, VehicleModeEnumeration } from "../types.ts";
import { distanceMetres } from "./chaseCamera.ts";

/** How often the kiosk refetches the vehicles it can pick from. */
export const SNAPSHOT_INTERVAL_MS = 60_000;
/** Moved at least this far since the previous snapshot to count as moving. */
export const MIN_MOVE_METRES = 100;
/**
 * Seen at most this long before the snapshot was fetched. A proxy for
 * reporting often: a vehicle that reports once a minute is usually seen with
 * an older timestamp. Sometimes wrong, and harmless when it is.
 */
export const FRESH_REPORT_MS = 10_000;
/** How many of the latest picks are skipped while anything else is eligible. */
export const RECENT_PICKS = 10;
/** The live subscription's own default when the filter sets no maxDataAge. */
export const DEFAULT_MAX_DATA_AGE_SECONDS = 30;

/** One vehicle as the kiosk sees it in a snapshot. */
export type KioskVehicle = {
  /** `vehicleId + "_" + serviceJourneyId`, the live cache's key. */
  key: string;
  vehicleId: string;
  serviceJourneyId: string;
  date: string;
  codespaceId: string | null;
  mode: VehicleModeEnumeration;
  lineCode: string;
  destinationName: string | null;
  lon: number;
  lat: number;
  /** ms since the epoch. */
  lastUpdated: number;
  monitored: boolean;
};

export type KioskSnapshot = { fetchedAt: number; vehicles: KioskVehicle[] };

/**
 * The two latest snapshots, so a vehicle can be compared with itself, and the
 * filter's maxDataAge, which the snapshot query does not take.
 */
export type CandidatePool = {
  current: KioskSnapshot | null;
  previous: KioskSnapshot | null;
  maxDataAgeSeconds: number;
};

/** A record from the kiosk's snapshot query (`useKioskCandidates`). */
export type SnapshotVehicle = {
  vehicleId: string;
  serviceJourney: { id: string; date: string };
  codespace: { codespaceId: string } | null;
  mode: VehicleModeEnumeration;
  line: { publicCode: string } | null;
  destinationName: string | null;
  lastUpdated: string;
  monitored: boolean | null;
  location: { latitude: number; longitude: number } | null;
};

export function vehicleKey(vehicleId: string, serviceJourneyId: string) {
  return vehicleId + "_" + serviceJourneyId;
}

function isUsableLocation(lon: number, lat: number) {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lon === 0 && lat === 0)
  );
}

/** The record as a `KioskVehicle`, or null when it has nowhere to fly to. */
export function toKioskVehicle(raw: SnapshotVehicle): KioskVehicle | null {
  const lastUpdated = Date.parse(raw.lastUpdated);
  if (!raw.location || Number.isNaN(lastUpdated)) return null;
  const { longitude: lon, latitude: lat } = raw.location;
  if (!isUsableLocation(lon, lat)) return null;
  return {
    key: vehicleKey(raw.vehicleId, raw.serviceJourney.id),
    vehicleId: raw.vehicleId,
    serviceJourneyId: raw.serviceJourney.id,
    date: raw.serviceJourney.date,
    codespaceId: raw.codespace?.codespaceId ?? null,
    mode: raw.mode,
    lineCode: raw.line?.publicCode ?? "",
    destinationName: raw.destinationName,
    lon,
    lat,
    lastUpdated,
    monitored: raw.monitored === true,
  };
}

/**
 * The filter's maxDataAge in seconds. A filter read from the URL carries it
 * as a string, so it is converted rather than trusted.
 */
export function maxDataAgeSecondsOf(filter: Partial<Filter>): number {
  const value = Number(filter.maxDataAge);
  return value > 0 ? value : DEFAULT_MAX_DATA_AGE_SECONDS;
}

/** Worth watching: monitored, reporting often, and moving. */
export function isGoodCandidate(
  vehicle: KioskVehicle,
  previous: Map<string, KioskVehicle> | null,
  fetchedAt: number,
): boolean {
  if (!vehicle.monitored) return false;
  if (fetchedAt - vehicle.lastUpdated > FRESH_REPORT_MS) return false;
  const before = previous?.get(vehicle.key);
  if (!before) return false;
  return distanceMetres(before, vehicle) >= MIN_MOVE_METRES;
}

/**
 * The next vehicle to chase: a random good candidate, else a random eligible
 * vehicle, else null. Recent picks are left out unless nothing else is
 * eligible. `random` is in [0, 1), passed in so tests are deterministic.
 */
export function pickCandidate(
  pool: CandidatePool,
  recent: readonly string[],
  now: number,
  random: number,
): KioskVehicle | null {
  const { current, previous, maxDataAgeSeconds } = pool;
  if (!current) return null;
  const eligible = current.vehicles.filter(
    (v) => now - v.lastUpdated <= maxDataAgeSeconds * 1000,
  );
  const unseen = eligible.filter((v) => !recent.includes(v.key));
  const fresh = unseen.length > 0 ? unseen : eligible;
  const before = previous
    ? new Map(previous.vehicles.map((v) => [v.key, v]))
    : null;
  const good = fresh.filter((v) =>
    isGoodCandidate(v, before, current.fetchedAt),
  );
  const from = good.length > 0 ? good : fresh;
  if (from.length === 0) return null;
  return from[Math.min(from.length - 1, Math.floor(random * from.length))];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/kioskCandidates.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/domain/kioskCandidates.ts src/domain/kioskCandidates.test.ts
git add src/domain/kioskCandidates.ts src/domain/kioskCandidates.test.ts
git commit -m "Add kiosk candidate selection"
```

---

### Task 2: Journey signals

**Files:**

- Create: `src/domain/kioskJourney.ts`
- Test: `src/domain/kioskJourney.test.ts`

**Interfaces:**

- Consumes: `distanceMetres`, `LngLat` from `src/domain/chaseCamera.ts`; `Call`, `EstimatedTimetableUpdate` from `src/types.ts`.
- Produces:
  - `type KioskWorld = { targetInFeed: boolean; stillForMs: number; journeyEnded: boolean; lastArrivalAt: number | null }`
  - `type Stillness = { anchor: LngLat; since: number }`
  - `STATIONARY_METRES = 25`, `UPCOMING_STOPS = 5`
  - `trackStillness(prev: Stillness | null, position: LngLat, now: number): Stillness`
  - `journeyEnded(calls: Call[]): boolean`
  - `lastArrivalAt(calls: Call[]): number | null`
  - `upcomingCalls(calls: Call[], count?: number): Call[]`
  - `callsFor(timetable: EstimatedTimetableUpdate | null, serviceJourneyId: string): Call[] | null`
  - `kioskWorld(position: LngLat | null, calls: Call[] | null, stillness: Stillness | null, now: number): { world: KioskWorld; stillness: Stillness | null }`

- [ ] **Step 1: Write the failing test**

`src/domain/kioskJourney.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/kioskJourney.test.ts`
Expected: FAIL — cannot resolve `./kioskJourney.ts`.

- [ ] **Step 3: Write the implementation**

`src/domain/kioskJourney.ts`:

```ts
import type { Call, EstimatedTimetableUpdate } from "../types.ts";
import { LngLat, distanceMetres } from "./chaseCamera.ts";

/** Moving less than this counts as standing still. */
export const STATIONARY_METRES = 25;
/** How many stops the kiosk band lists ahead. */
export const UPCOMING_STOPS = 5;

/** What the kiosk knows about its target on one tick. */
export type KioskWorld = {
  /** The target is in the live vehicle data. */
  targetInFeed: boolean;
  /** How long it has stayed within STATIONARY_METRES; 0 when unknown. */
  stillForMs: number;
  /** Its journey's last call has an actual arrival. */
  journeyEnded: boolean;
  /** The latest actual arrival on its journey, ms; null without one. */
  lastArrivalAt: number | null;
};

/** Where the vehicle was when it last moved, and since when it has not. */
export type Stillness = { anchor: LngLat; since: number };

export function trackStillness(
  prev: Stillness | null,
  position: LngLat,
  now: number,
): Stillness {
  if (prev && distanceMetres(prev.anchor, position) <= STATIONARY_METRES) {
    return prev;
  }
  return { anchor: position, since: now };
}

export function journeyEnded(calls: Call[]): boolean {
  const last = calls.at(-1);
  return last !== undefined && last.actualArrivalTime !== null;
}

export function lastArrivalAt(calls: Call[]): number | null {
  let latest: number | null = null;
  for (const call of calls) {
    if (!call.actualArrivalTime) continue;
    const at = Date.parse(call.actualArrivalTime);
    if (Number.isNaN(at)) continue;
    if (latest === null || at > latest) latest = at;
  }
  return latest;
}

/**
 * The calls not yet departed from, nearest first. The first is the stop the
 * vehicle is at or heading for.
 */
export function upcomingCalls(calls: Call[], count = UPCOMING_STOPS): Call[] {
  return calls
    .filter((call) => call.actualDepartureTime === null)
    .slice(0, count);
}

/**
 * The timetable's calls if it is the target's journey. The subscription in
 * `MapView` follows the selection, so for a moment after a switch it still
 * holds the previous journey — whose last stop must not end the new chase.
 */
export function callsFor(
  timetable: EstimatedTimetableUpdate | null,
  serviceJourneyId: string,
): Call[] | null {
  return timetable?.serviceJourney.id === serviceJourneyId
    ? timetable.calls
    : null;
}

/** One tick's world, and the stillness to carry to the next tick. */
export function kioskWorld(
  position: LngLat | null,
  calls: Call[] | null,
  stillness: Stillness | null,
  now: number,
): { world: KioskWorld; stillness: Stillness | null } {
  const next = position ? trackStillness(stillness, position, now) : stillness;
  return {
    world: {
      targetInFeed: position !== null,
      stillForMs: position && next ? now - next.since : 0,
      journeyEnded: calls ? journeyEnded(calls) : false,
      lastArrivalAt: calls ? lastArrivalAt(calls) : null,
    },
    stillness: next,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/kioskJourney.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/domain/kioskJourney.ts src/domain/kioskJourney.test.ts
git add src/domain/kioskJourney.ts src/domain/kioskJourney.test.ts
git commit -m "Add kiosk journey signals"
```

---

### Task 3: The kiosk state machine

**Files:**

- Create: `src/domain/kioskSchedule.ts`
- Test: `src/domain/kioskSchedule.test.ts`

**Interfaces:**

- Consumes: from Task 1 `CandidatePool`, `KioskVehicle`, `RECENT_PICKS`, `pickCandidate`, `vehicleKey`; from Task 2 `KioskWorld`; `Filter` from `src/types.ts`.
- Produces:
  - constants `DEFAULT_DWELL_MS`, `LEAVE_MS`, `ARRIVE_TIMEOUT_MS`, `LOCK_ON_TIMEOUT_MS`, `MAX_MISSES`, `STOP_WAIT_CAP_MS`, `STATIONARY_MS`, `IDLE_MS`
  - `parseKioskParam(search: string): number | null` (dwell in ms)
  - `type KioskConfig = { dwellMs: number; idleMs: number }`
  - `type WaitReason = "noSnapshot" | "noMatch" | "misses"`
  - `type KioskPhase` (union below), `type KioskState = { phase: KioskPhase; recent: string[] }`
  - `type KioskEvent` (union below), `INITIAL_KIOSK_STATE`
  - `step(state: KioskState, event: KioskEvent, config: KioskConfig): KioskState` — returns the **same object** when nothing changes
  - `type KioskEffect = "restoreSetup" | "leave" | "flyToTarget" | "startChase"`, `effectsOf(prev: KioskPhase, next: KioskPhase): KioskEffect[]`
  - `targetOf(phase: KioskPhase): KioskVehicle | null`
  - `type KioskView`, `kioskView(state: KioskState, now: number, config: KioskConfig): KioskView`
  - `formatCountdown(ms: number): string`
  - `restoredFilter(prev: Filter | null, setup: Partial<Filter>): Filter | null`

- [ ] **Step 1: Write the failing test**

`src/domain/kioskSchedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskVehicle,
  RECENT_PICKS,
  vehicleKey,
} from "./kioskCandidates.ts";
import type { KioskWorld } from "./kioskJourney.ts";
import {
  ARRIVE_TIMEOUT_MS,
  DEFAULT_DWELL_MS,
  INITIAL_KIOSK_STATE,
  KioskConfig,
  KioskEvent,
  KioskPhase,
  KioskState,
  LEAVE_MS,
  LOCK_ON_TIMEOUT_MS,
  MAX_MISSES,
  STATIONARY_MS,
  STOP_WAIT_CAP_MS,
  effectsOf,
  formatCountdown,
  kioskView,
  parseKioskParam,
  restoredFilter,
  step,
  targetOf,
} from "./kioskSchedule.ts";

const T0 = Date.parse("2026-10-05T12:00:00Z");
const CONFIG: KioskConfig = { dwellMs: 180_000, idleMs: 120_000 };

function vehicle(id: string): KioskVehicle {
  return {
    key: vehicleKey(id, `SJ:${id}`),
    vehicleId: id,
    serviceJourneyId: `SJ:${id}`,
    date: "2026-10-05",
    codespaceId: "ATB",
    mode: "BUS",
    lineCode: "3",
    destinationName: "Hallset",
    lon: 10.4,
    lat: 63.43,
    lastUpdated: T0 - 1_000,
    monitored: true,
  };
}

const TARGET = vehicle("a");
const NO_WORLD: KioskWorld = {
  targetInFeed: false,
  stillForMs: 0,
  journeyEnded: false,
  lastArrivalAt: null,
};
const IN_FEED: KioskWorld = { ...NO_WORLD, targetInFeed: true };
const EMPTY_POOL: CandidatePool = {
  current: null,
  previous: null,
  maxDataAgeSeconds: 30,
};
const POOL: CandidatePool = {
  current: { fetchedAt: T0, vehicles: [TARGET] },
  previous: null,
  maxDataAgeSeconds: 30,
};
const NO_MATCH_POOL: CandidatePool = {
  current: { fetchedAt: T0, vehicles: [] },
  previous: null,
  maxDataAgeSeconds: 30,
};

function tick(
  now: number,
  world: KioskWorld = NO_WORLD,
  pool: CandidatePool = POOL,
): KioskEvent {
  return { type: "tick", now, world, pool, random: 0 };
}

function at(phase: KioskPhase, recent: string[] = []): KioskState {
  return { phase, recent };
}

const CHASING = at({ kind: "chasing", target: TARGET, since: T0 });
const WAITING_FOR_STOP = at({
  kind: "waitingForStop",
  target: TARGET,
  chaseSince: T0,
  since: T0 + CONFIG.dwellMs,
});

describe("parseKioskParam", () => {
  it("is off without the param", () => {
    expect(parseKioskParam("")).toBeNull();
    expect(parseKioskParam("?codespaceId=ATB")).toBeNull();
  });

  it("reads whole seconds as a dwell in ms", () => {
    expect(parseKioskParam("?kiosk=60")).toBe(60_000);
    expect(parseKioskParam("?codespaceId=ATB&kiosk=30")).toBe(30_000);
  });

  it("falls back to the default dwell on anything else", () => {
    for (const search of [
      "?kiosk",
      "?kiosk=",
      "?kiosk=0",
      "?kiosk=-5",
      "?kiosk=abc",
      "?kiosk=1.5",
    ]) {
      expect(parseKioskParam(search)).toBe(DEFAULT_DWELL_MS);
    }
  });
});

describe("step: finding a vehicle", () => {
  it("waits for the first snapshot", () => {
    const state = step(
      INITIAL_KIOSK_STATE,
      tick(T0, NO_WORLD, EMPTY_POOL),
      CONFIG,
    );
    expect(state).toBe(INITIAL_KIOSK_STATE);
    expect(step(INITIAL_KIOSK_STATE, tick(T0), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("after no match, waits for a newer snapshot", () => {
    const waiting = at({ kind: "waiting", reason: "noMatch", since: T0 });
    expect(step(waiting, tick(T0 + 1_000), CONFIG)).toBe(waiting);
    const newer: CandidatePool = {
      ...POOL,
      current: { fetchedAt: T0 + 60_000, vehicles: [TARGET] },
    };
    expect(
      step(waiting, tick(T0 + 61_000, NO_WORLD, newer), CONFIG).phase.kind,
    ).toBe("picking");
  });

  it("picks a vehicle and leaves for it", () => {
    const picking = at({ kind: "picking", misses: 2 });
    expect(step(picking, tick(T0 + 1_000), CONFIG).phase).toEqual({
      kind: "leaving",
      target: TARGET,
      since: T0 + 1_000,
      misses: 2,
    });
  });

  it("waits when nothing matches, keyed to that snapshot", () => {
    const picking = at({ kind: "picking", misses: 0 });
    expect(
      step(picking, tick(T0 + 1_000, NO_WORLD, NO_MATCH_POOL), CONFIG).phase,
    ).toEqual({ kind: "waiting", reason: "noMatch", since: T0 });
  });
});

describe("step: travelling", () => {
  const leaving = at({ kind: "leaving", target: TARGET, since: T0, misses: 1 });
  const arriving = at({
    kind: "arriving",
    target: TARGET,
    since: T0,
    misses: 1,
  });

  it("leaves for LEAVE_MS before flying", () => {
    expect(step(leaving, tick(T0 + LEAVE_MS - 1), CONFIG)).toBe(leaving);
    expect(step(leaving, tick(T0 + LEAVE_MS), CONFIG).phase).toEqual({
      kind: "arriving",
      target: TARGET,
      since: T0 + LEAVE_MS,
      misses: 1,
    });
  });

  it("locks on when the flight ends", () => {
    expect(
      step(arriving, { type: "arrived", now: T0 + 4_000 }, CONFIG).phase,
    ).toEqual({
      kind: "lockingOn",
      target: TARGET,
      since: T0 + 4_000,
      misses: 1,
    });
  });

  it("locks on anyway if the flight never reports its end", () => {
    expect(
      step(arriving, tick(T0 + ARRIVE_TIMEOUT_MS), CONFIG).phase.kind,
    ).toBe("lockingOn");
  });

  it("ignores a flight ending after the kiosk was paused", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(step(paused, { type: "arrived", now: T0 + 1 }, CONFIG)).toBe(paused);
  });
});

describe("step: locking on", () => {
  const lockingOn = (misses: number, recent: string[] = []) =>
    at({ kind: "lockingOn", target: TARGET, since: T0, misses }, recent);

  it("starts the chase once the target is in the feed", () => {
    const state = step(lockingOn(0, ["x"]), tick(T0 + 2_000, IN_FEED), CONFIG);
    expect(state.phase).toEqual({
      kind: "chasing",
      target: TARGET,
      since: T0 + 2_000,
    });
    expect(state.recent).toEqual([TARGET.key, "x"]);
  });

  it("keeps recent picks unique and capped", () => {
    const many = Array.from({ length: RECENT_PICKS }, (_, i) => `k${i}`);
    const state = step(
      lockingOn(0, [...many.slice(0, 3), TARGET.key, ...many.slice(3)]),
      tick(T0 + 2_000, IN_FEED),
      CONFIG,
    );
    expect(state.recent).toHaveLength(RECENT_PICKS);
    expect(state.recent[0]).toBe(TARGET.key);
    expect(state.recent.filter((k) => k === TARGET.key)).toHaveLength(1);
  });

  it("picks again after LOCK_ON_TIMEOUT_MS, counting a miss", () => {
    expect(
      step(lockingOn(0), tick(T0 + LOCK_ON_TIMEOUT_MS - 1), CONFIG),
    ).toEqual(lockingOn(0));
    const state = step(lockingOn(0), tick(T0 + LOCK_ON_TIMEOUT_MS), CONFIG);
    expect(state.phase).toEqual({ kind: "picking", misses: 1 });
    expect(state.recent).toEqual([]);
  });

  it(`waits for a new snapshot after ${MAX_MISSES} misses`, () => {
    const state = step(
      lockingOn(MAX_MISSES - 1),
      tick(T0 + LOCK_ON_TIMEOUT_MS),
      CONFIG,
    );
    expect(state.phase).toEqual({
      kind: "waiting",
      reason: "misses",
      since: T0,
    });
  });
});

describe("step: chasing", () => {
  it("chases for the dwell, then waits for a stop", () => {
    expect(step(CHASING, tick(T0 + CONFIG.dwellMs - 1, IN_FEED), CONFIG)).toBe(
      CHASING,
    );
    expect(
      step(CHASING, tick(T0 + CONFIG.dwellMs, IN_FEED), CONFIG).phase,
    ).toEqual({
      kind: "waitingForStop",
      target: TARGET,
      chaseSince: T0,
      since: T0 + CONFIG.dwellMs,
    });
  });

  it.each([
    ["the vehicle left the feed", NO_WORLD],
    ["the journey ended", { ...IN_FEED, journeyEnded: true }],
    ["it stood still too long", { ...IN_FEED, stillForMs: STATIONARY_MS }],
  ])("moves on early when %s", (_, world) => {
    expect(step(CHASING, tick(T0 + 5_000, world), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
    expect(
      step(WAITING_FOR_STOP, tick(T0 + CONFIG.dwellMs + 5_000, world), CONFIG)
        .phase,
    ).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("keeps chasing a vehicle that has stood still a little less", () => {
    const world = { ...IN_FEED, stillForMs: STATIONARY_MS - 1 };
    expect(step(CHASING, tick(T0 + 5_000, world), CONFIG)).toBe(CHASING);
  });
});

describe("step: waiting for a stop", () => {
  const waitStart = T0 + CONFIG.dwellMs;

  it("moves on at an arrival after the wait began", () => {
    const world = { ...IN_FEED, lastArrivalAt: waitStart + 10_000 };
    expect(
      step(WAITING_FOR_STOP, tick(waitStart + 12_000, world), CONFIG).phase,
    ).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("does not count an arrival from before the wait", () => {
    const world = { ...IN_FEED, lastArrivalAt: waitStart - 1 };
    expect(
      step(WAITING_FOR_STOP, tick(waitStart + 12_000, world), CONFIG),
    ).toBe(WAITING_FOR_STOP);
  });

  it("moves on at the cap with no arrival", () => {
    const cap = T0 + CONFIG.dwellMs + STOP_WAIT_CAP_MS;
    expect(step(WAITING_FOR_STOP, tick(cap - 1, IN_FEED), CONFIG)).toBe(
      WAITING_FOR_STOP,
    );
    expect(step(WAITING_FOR_STOP, tick(cap, IN_FEED), CONFIG).phase.kind).toBe(
      "picking",
    );
  });
});

describe("step: pause and resume", () => {
  const phases: KioskPhase[] = [
    { kind: "waiting", reason: "noSnapshot", since: -Infinity },
    { kind: "picking", misses: 0 },
    { kind: "leaving", target: TARGET, since: T0, misses: 0 },
    { kind: "arriving", target: TARGET, since: T0, misses: 0 },
    { kind: "lockingOn", target: TARGET, since: T0, misses: 0 },
    { kind: "chasing", target: TARGET, since: T0 },
    { kind: "waitingForStop", target: TARGET, chaseSince: T0, since: T0 },
    { kind: "paused", lastInputAt: T0 - 50_000 },
  ];

  it.each(phases.map((p) => [p.kind, p] as const))(
    "pauses on input from %s",
    (_, phase) => {
      expect(
        step(at(phase), { type: "input", now: T0 + 1 }, CONFIG).phase,
      ).toEqual({ kind: "paused", lastInputAt: T0 + 1 });
    },
  );

  it("resumes after the idle period, picking afresh", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(step(paused, tick(T0 + CONFIG.idleMs - 1), CONFIG)).toBe(paused);
    expect(step(paused, tick(T0 + CONFIG.idleMs), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
  });
});

describe("effectsOf", () => {
  const paused: KioskPhase = { kind: "paused", lastInputAt: T0 };
  const picking: KioskPhase = { kind: "picking", misses: 0 };
  const leaving: KioskPhase = {
    kind: "leaving",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const arriving: KioskPhase = {
    kind: "arriving",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const lockingOn: KioskPhase = {
    kind: "lockingOn",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const chasing: KioskPhase = { kind: "chasing", target: TARGET, since: T0 };

  it("restores the setup on resume", () => {
    expect(effectsOf(paused, picking)).toEqual(["restoreSetup"]);
  });

  it("leaves, flies and chases on the way to a vehicle", () => {
    expect(effectsOf(picking, leaving)).toEqual(["leave"]);
    expect(effectsOf(leaving, arriving)).toEqual(["flyToTarget"]);
    expect(effectsOf(lockingOn, chasing)).toEqual(["startChase"]);
  });

  it("does nothing on pausing, on more input, or without a change", () => {
    expect(effectsOf(chasing, paused)).toEqual([]);
    expect(effectsOf(paused, { kind: "paused", lastInputAt: T0 + 1 })).toEqual(
      [],
    );
    expect(effectsOf(chasing, chasing)).toEqual([]);
  });
});

describe("targetOf", () => {
  it("is the target of a travelling or chasing phase, else null", () => {
    expect(targetOf({ kind: "chasing", target: TARGET, since: T0 })).toBe(
      TARGET,
    );
    expect(targetOf({ kind: "picking", misses: 0 })).toBeNull();
    expect(targetOf({ kind: "paused", lastInputAt: T0 })).toBeNull();
  });
});

describe("kioskView", () => {
  it("counts down to resuming", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(kioskView(paused, T0 + 15_000, CONFIG)).toEqual({
      kind: "paused",
      resumesInMs: 105_000,
    });
    expect(kioskView(paused, T0 + 999_999, CONFIG)).toEqual({
      kind: "paused",
      resumesInMs: 0,
    });
  });

  it("names why it is waiting", () => {
    const view = (reason: "noSnapshot" | "noMatch" | "misses") =>
      kioskView(at({ kind: "waiting", reason, since: T0 }), T0, CONFIG);
    expect(view("noMatch")).toEqual({
      kind: "message",
      text: "No vehicles match this filter right now",
    });
    expect(view("noSnapshot")).toEqual({
      kind: "message",
      text: "Waiting for vehicles…",
    });
    expect(view("misses")).toEqual({
      kind: "message",
      text: "Waiting for vehicles…",
    });
  });

  it("shows the next vehicle while travelling", () => {
    expect(
      kioskView(
        at({ kind: "arriving", target: TARGET, since: T0, misses: 0 }),
        T0,
        CONFIG,
      ),
    ).toEqual({ kind: "travelling", target: TARGET });
  });

  it("reports progress through the dwell, full while waiting for a stop", () => {
    expect(kioskView(CHASING, T0 + 90_000, CONFIG)).toEqual({
      kind: "chasing",
      target: TARGET,
      progress: 0.5,
      waitingForStop: false,
    });
    expect(kioskView(WAITING_FOR_STOP, T0 + 200_000, CONFIG)).toEqual({
      kind: "chasing",
      target: TARGET,
      progress: 1,
      waitingForStop: true,
    });
  });
});

describe("formatCountdown", () => {
  it("is minutes and seconds, rounded up", () => {
    expect(formatCountdown(105_000)).toBe("1:45");
    expect(formatCountdown(59_001)).toBe("1:00");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("restoredFilter", () => {
  const box = [
    [10, 63],
    [11, 64],
  ];

  it("leaves a filter not yet set alone", () => {
    expect(restoredFilter(null, { codespaceId: "ATB" })).toBeNull();
  });

  it("puts back the kiosk's codespace and keeps the viewport", () => {
    const prev: Filter = {
      boundingBox: box,
      codespaceId: "RUT",
      operatorRef: "RUT:Operator:1",
    };
    expect(restoredFilter(prev, { codespaceId: "ATB" })).toEqual({
      boundingBox: box,
      codespaceId: "ATB",
    });
  });

  it("returns the same filter when the visitor changed nothing", () => {
    const prev: Filter = { boundingBox: box, codespaceId: "ATB" };
    expect(restoredFilter(prev, { codespaceId: "ATB" })).toBe(prev);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/kioskSchedule.test.ts`
Expected: FAIL — cannot resolve `./kioskSchedule.ts`.

- [ ] **Step 3: Write the implementation**

`src/domain/kioskSchedule.ts`:

```ts
import type { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskVehicle,
  RECENT_PICKS,
  pickCandidate,
} from "./kioskCandidates.ts";
import type { KioskWorld } from "./kioskJourney.ts";

/** Dwell when `?kiosk` has no usable value. */
export const DEFAULT_DWELL_MS = 180_000;
/** Time for the chase's exit ease (and any 2D switch) before the flight. */
export const LEAVE_MS = 1_500;
/** Lock on anyway if the flight's moveend never comes. */
export const ARRIVE_TIMEOUT_MS = 15_000;
/** Pick again if the target has not appeared in the live feed by then. */
export const LOCK_ON_TIMEOUT_MS = 15_000;
/** Misses in a row before waiting for a newer snapshot. */
export const MAX_MISSES = 3;
/** Past the dwell, how long to wait for a stop before switching anyway. */
export const STOP_WAIT_CAP_MS = 120_000;
/** Switch early after standing still this long. */
export const STATIONARY_MS = 90_000;
/** Resume after this long without input. */
export const IDLE_MS = 120_000;

/**
 * `?kiosk=<seconds>` as a dwell in ms; null when kiosk mode is off. Anything
 * but a positive whole number of seconds means the default dwell.
 */
export function parseKioskParam(search: string): number | null {
  const params = new URLSearchParams(search);
  if (!params.has("kiosk")) return null;
  const raw = params.get("kiosk") ?? "";
  const seconds = /^\d+$/.test(raw) ? Number(raw) : 0;
  return seconds > 0 ? seconds * 1000 : DEFAULT_DWELL_MS;
}

export type KioskConfig = { dwellMs: number; idleMs: number };

export type WaitReason = "noSnapshot" | "noMatch" | "misses";

export type KioskPhase =
  /** Until a snapshot newer than `since` (its fetchedAt) arrives. */
  | { kind: "waiting"; reason: WaitReason; since: number }
  | { kind: "picking"; misses: number }
  | { kind: "leaving"; target: KioskVehicle; since: number; misses: number }
  | { kind: "arriving"; target: KioskVehicle; since: number; misses: number }
  | { kind: "lockingOn"; target: KioskVehicle; since: number; misses: number }
  | { kind: "chasing"; target: KioskVehicle; since: number }
  | {
      kind: "waitingForStop";
      target: KioskVehicle;
      chaseSince: number;
      since: number;
    }
  | { kind: "paused"; lastInputAt: number };

export type KioskState = {
  phase: KioskPhase;
  /** Keys of the latest vehicles locked on to, newest first. */
  recent: string[];
};

export type KioskEvent =
  | {
      type: "tick";
      now: number;
      world: KioskWorld;
      pool: CandidatePool;
      /** In [0, 1); passed in so the reducer stays pure. */
      random: number;
    }
  /** The flight to the target ended. */
  | { type: "arrived"; now: number }
  /** A person touched the screen, the mouse or the keyboard. */
  | { type: "input"; now: number };

export const INITIAL_KIOSK_STATE: KioskState = {
  phase: { kind: "waiting", reason: "noSnapshot", since: -Infinity },
  recent: [],
};

function withPhase(state: KioskState, phase: KioskPhase): KioskState {
  return { ...state, phase };
}

const PICK_AFRESH: KioskPhase = { kind: "picking", misses: 0 };

function shouldLeaveEarly(world: KioskWorld) {
  return (
    !world.targetInFeed ||
    world.journeyEnded ||
    world.stillForMs >= STATIONARY_MS
  );
}

/**
 * The kiosk's next state. Returns `state` itself when nothing changes, so a
 * caller can skip the render and the effects.
 */
export function step(
  state: KioskState,
  event: KioskEvent,
  config: KioskConfig,
): KioskState {
  const { phase } = state;
  if (event.type === "input") {
    return withPhase(state, { kind: "paused", lastInputAt: event.now });
  }
  if (event.type === "arrived") {
    return phase.kind === "arriving"
      ? withPhase(state, {
          kind: "lockingOn",
          target: phase.target,
          since: event.now,
          misses: phase.misses,
        })
      : state;
  }

  const { now, world, pool, random } = event;
  const snapshotAt = pool.current?.fetchedAt ?? -Infinity;
  switch (phase.kind) {
    case "paused":
      return now - phase.lastInputAt >= config.idleMs
        ? withPhase(state, PICK_AFRESH)
        : state;
    case "waiting":
      return snapshotAt > phase.since ? withPhase(state, PICK_AFRESH) : state;
    case "picking": {
      const target = pickCandidate(pool, state.recent, now, random);
      if (!target) {
        return withPhase(state, {
          kind: "waiting",
          reason: pool.current ? "noMatch" : "noSnapshot",
          since: snapshotAt,
        });
      }
      return withPhase(state, {
        kind: "leaving",
        target,
        since: now,
        misses: phase.misses,
      });
    }
    case "leaving":
      return now - phase.since >= LEAVE_MS
        ? withPhase(state, { ...phase, kind: "arriving", since: now })
        : state;
    case "arriving":
      return now - phase.since >= ARRIVE_TIMEOUT_MS
        ? withPhase(state, { ...phase, kind: "lockingOn", since: now })
        : state;
    case "lockingOn": {
      if (world.targetInFeed) {
        const key = phase.target.key;
        return {
          phase: { kind: "chasing", target: phase.target, since: now },
          recent: [key, ...state.recent.filter((k) => k !== key)].slice(
            0,
            RECENT_PICKS,
          ),
        };
      }
      if (now - phase.since < LOCK_ON_TIMEOUT_MS) return state;
      const misses = phase.misses + 1;
      return withPhase(
        state,
        misses >= MAX_MISSES
          ? { kind: "waiting", reason: "misses", since: snapshotAt }
          : { kind: "picking", misses },
      );
    }
    case "chasing":
      if (shouldLeaveEarly(world)) return withPhase(state, PICK_AFRESH);
      return now - phase.since >= config.dwellMs
        ? withPhase(state, {
            kind: "waitingForStop",
            target: phase.target,
            chaseSince: phase.since,
            since: now,
          })
        : state;
    case "waitingForStop":
      if (shouldLeaveEarly(world)) return withPhase(state, PICK_AFRESH);
      if (world.lastArrivalAt !== null && world.lastArrivalAt >= phase.since) {
        return withPhase(state, PICK_AFRESH);
      }
      return now - phase.chaseSince >= config.dwellMs + STOP_WAIT_CAP_MS
        ? withPhase(state, PICK_AFRESH)
        : state;
  }
}

export type KioskEffect =
  "restoreSetup" | "leave" | "flyToTarget" | "startChase";

/** What has to happen in the app for the kiosk to go from `prev` to `next`. */
export function effectsOf(prev: KioskPhase, next: KioskPhase): KioskEffect[] {
  if (prev === next) return [];
  const effects: KioskEffect[] = [];
  if (prev.kind === "paused" && next.kind !== "paused") {
    effects.push("restoreSetup");
  }
  if (next.kind === "leaving") effects.push("leave");
  if (next.kind === "arriving") effects.push("flyToTarget");
  if (next.kind === "chasing" && prev.kind === "lockingOn") {
    effects.push("startChase");
  }
  return effects;
}

export function targetOf(phase: KioskPhase): KioskVehicle | null {
  return "target" in phase ? phase.target : null;
}

export type KioskView =
  | { kind: "paused"; resumesInMs: number }
  | { kind: "message"; text: string }
  | { kind: "travelling"; target: KioskVehicle }
  | {
      kind: "chasing";
      target: KioskVehicle;
      /** Share of the dwell gone, 0–1. */
      progress: number;
      waitingForStop: boolean;
    };

/** What the overlay shows at `now`. */
export function kioskView(
  state: KioskState,
  now: number,
  config: KioskConfig,
): KioskView {
  const { phase } = state;
  switch (phase.kind) {
    case "paused":
      return {
        kind: "paused",
        resumesInMs: Math.max(0, config.idleMs - (now - phase.lastInputAt)),
      };
    case "waiting":
      return {
        kind: "message",
        text:
          phase.reason === "noMatch"
            ? "No vehicles match this filter right now"
            : "Waiting for vehicles…",
      };
    case "picking":
      return { kind: "message", text: "Finding a vehicle…" };
    case "leaving":
    case "arriving":
    case "lockingOn":
      return { kind: "travelling", target: phase.target };
    case "chasing":
      return {
        kind: "chasing",
        target: phase.target,
        progress: Math.min(
          1,
          Math.max(0, (now - phase.since) / config.dwellMs),
        ),
        waitingForStop: false,
      };
    case "waitingForStop":
      return {
        kind: "chasing",
        target: phase.target,
        progress: 1,
        waitingForStop: true,
      };
  }
}

/** `m:ss`, rounded up so it never shows 0:00 while time remains. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The filter with the kiosk's own codespace, operator and maxDataAge put
 * back and the viewport kept. Returns `prev` when they already match, so an
 * untouched kiosk does not reopen the vehicle subscription on every resume.
 */
export function restoredFilter(
  prev: Filter | null,
  setup: Partial<Filter>,
): Filter | null {
  if (!prev) return prev;
  const unchanged =
    prev.codespaceId === setup.codespaceId &&
    prev.operatorRef === setup.operatorRef &&
    prev.maxDataAge === setup.maxDataAge;
  return unchanged ? prev : { ...setup, boundingBox: prev.boundingBox };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/kioskSchedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Format, type-check and commit**

```bash
npx prettier --write src/domain/kioskSchedule.ts src/domain/kioskSchedule.test.ts
npx tsc -p tsconfig.app.json --noEmit
git add src/domain/kioskSchedule.ts src/domain/kioskSchedule.test.ts
git commit -m "Add the kiosk state machine"
```

Expected: `tsc` prints nothing.

---

### Task 4: Build a selection from a live vehicle

The kiosk selects a vehicle it found in `data`, not one clicked on the map, so it needs the selection that a click produces. `createFeature` in `VehicleMarkers.tsx` already builds it; moving it to a `.ts` makes it importable without a `react-refresh/only-export-components` warning, and testable.

**Files:**

- Create: `src/components/Vehicle/vehicleFeature.ts`
- Test: `src/components/Vehicle/vehicleFeature.test.ts`
- Modify: `src/components/Vehicle/VehicleMarkers.tsx` (remove `SelectedVehicleProperties`, `SelectedVehicle` and `createFeature`; import them)

**Interfaces:**

- Produces:
  - `type SelectedVehicleProperties` (moved unchanged), `type SelectedVehicle` (moved unchanged; still re-exported from `VehicleMarkers.tsx`, so no other importer changes)
  - `createVehicleFeature(vehicle: VehicleUpdate, isFollowed: boolean): Feature<Point, SelectedVehicleProperties>`
  - `selectedVehicleFrom(vehicle: VehicleUpdate): SelectedVehicle`

- [ ] **Step 1: Write the failing test**

`src/components/Vehicle/vehicleFeature.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { VehicleUpdate } from "../../types.ts";
import { selectedVehicleFrom } from "./vehicleFeature.ts";

const vehicle: VehicleUpdate = {
  vehicleId: "ATB:Vehicle:1",
  codespace: { codespaceId: "ATB" },
  operator: { operatorRef: "ATB:Operator:1", name: "AtB" },
  mode: "BUS",
  line: {
    lineRef: "ATB:Line:3",
    lineName: "3",
    publicCode: "3",
    presentation: { colour: "76A300", textColour: "FFFFFF" },
  },
  delay: 120,
  location: { latitude: 63.43, longitude: 10.4 },
  serviceJourney: { id: "ATB:ServiceJourney:1", date: "2026-10-05" },
  lastUpdated: "2026-10-05T12:00:00Z",
  occupancyStatus: "noData",
  bearing: -90,
  destinationName: "Hallset",
};

describe("selectedVehicleFrom", () => {
  it("is the selection a click on the vehicle makes", () => {
    const selected = selectedVehicleFrom(vehicle);
    expect(selected.coordinates).toEqual([10.4, 63.43]);
    expect(selected.properties).toMatchObject({
      id: "ATB:Vehicle:1",
      mode: "BUS",
      lineCode: "3",
      codespaceId: "ATB",
      delay: 120,
      followed: false,
      serviceJourneyId: "ATB:ServiceJourney:1",
      date: "2026-10-05",
      bearing: 270,
    });
    expect(selected.properties.lineTextColour).not.toBeNull();
    expect(selected.properties.lineHaloColour).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Vehicle/vehicleFeature.test.ts`
Expected: FAIL — cannot resolve `./vehicleFeature.ts`.

- [ ] **Step 3: Move the code**

Create `src/components/Vehicle/vehicleFeature.ts` with the type `SelectedVehicleProperties`, the type `SelectedVehicle` and the body of `createFeature`, cut verbatim from `VehicleMarkers.tsx` (lines 23–79 today), with these changes only:

```ts
import type { Feature, Point } from "geojson";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { normaliseBearing } from "../../domain/vehicleFootprint.ts";
import { labelColoursFor } from "../../domain/vehiclePaint.ts";

export type SelectedVehicleProperties = {
  // …unchanged fields…
};

export type SelectedVehicle = {
  coordinates: number[];
  properties: SelectedVehicleProperties;
};

/** A vehicle as a map feature: the properties a click selects it by. */
export const createVehicleFeature = (
  vehicle: VehicleUpdate,
  isFollowed: boolean,
): Feature<Point, SelectedVehicleProperties> => {
  // …unchanged body of createFeature…
};

/**
 * The selection a click on `vehicle` makes, for selecting a vehicle found in
 * the data rather than on the map — the kiosk's next chase.
 */
export function selectedVehicleFrom(vehicle: VehicleUpdate): SelectedVehicle {
  const feature = createVehicleFeature(vehicle, false);
  return {
    coordinates: feature.geometry.coordinates,
    properties: feature.properties,
  };
}
```

(`SelectedVehicleProperties` already contains `followed: boolean`, so the old `& { followed: boolean }` in the return type is dropped as redundant.)

In `VehicleMarkers.tsx`:

- Delete the moved type and function.
- Remove the now-unused imports `VehicleModeEnumeration`, `normaliseBearing`, `labelColoursFor` and the `Point` part of the `geojson` import if nothing else uses them (`Polygon` and `Feature` are still used by `createModelFeature`; `dimensionsFor` and `vehicleFootprint` still used).
- Add:

```ts
import {
  SelectedVehicleProperties,
  createVehicleFeature,
} from "./vehicleFeature.ts";

export type { SelectedVehicle } from "./vehicleFeature.ts";
```

- Replace the call `createFeature(vehicle, vehicle.vehicleId === followedVehicleId)` with `createVehicleFeature(vehicle, vehicle.vehicleId === followedVehicleId)`.
- `createModelFeature` keeps `point: Feature<Point, SelectedVehicleProperties>` — keep `Point` imported if so.

- [ ] **Step 4: Run tests, type-check and lint**

```bash
npx vitest run src/components/Vehicle/vehicleFeature.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint -- --max-warnings 0
```

Expected: test PASS; `tsc` prints nothing; lint exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/Vehicle/vehicleFeature.ts src/components/Vehicle/vehicleFeature.test.ts src/components/Vehicle/VehicleMarkers.tsx
git commit -m "Build a vehicle selection from live data"
```

---

### Task 5: Kiosk hooks

**Files:**

- Create: `src/hooks/useKioskQueryParam.ts`
- Create: `src/hooks/useKioskCandidates.ts`
- Create: `src/hooks/useKiosk.ts`

**Interfaces:**

- Consumes: Tasks 1–3; `filterFromQueryParams` from `src/domain/filterQueryParams.ts`; `useConfig`, `useRequestHeaders`, `graphqlRequest`; `VehicleData` from `src/hooks/useVehiclePositionsData.ts`.
- Produces:
  - `useKioskQueryParam(): number | null`
  - `useKioskCandidates(filter: Partial<Filter>, enabled: boolean): CandidatePool`
  - `type KioskSetup = { filter: Partial<Filter>; mapViewOptions: MapViewOptions; showTransitNetwork: boolean }`
  - `type KioskActions = { leave: () => void; chase: (vehicle: VehicleUpdate) => void; restore: (setup: KioskSetup) => void }`
  - `useKiosk(args: { dwellMs: number | null; mapRef: RefObject<MapLibreMap | null>; data: VehicleData[]; timetable: EstimatedTimetableUpdate | null; actions: KioskActions; initialSetup: Omit<KioskSetup, "filter"> }): { state: KioskState | null; config: KioskConfig }` — `state` is null when kiosk mode is off.
  - Development builds only: `window.__kiosk = { phase }` mirrors the phase; `window.__kioskIdleMs`, if a positive number when the kiosk starts, replaces `IDLE_MS` (for Playwright).

These are thin wiring over the tested domain modules; per `vitest.config.ts` they have no unit tests. They are exercised by Task 8.

- [ ] **Step 1: Write `useKioskQueryParam`**

`src/hooks/useKioskQueryParam.ts`:

```ts
import { useState } from "react";
import { parseKioskParam } from "../domain/kioskSchedule.ts";

/**
 * `?kiosk=<seconds>` as a dwell in ms, or null when kiosk mode is off.
 *
 * Read once and never written. Kiosk mode is set up by loading a link, not
 * toggled in the app, and keeping it out of `Filter` keeps it out of the
 * vehicle subscription's variables.
 */
export function useKioskQueryParam(): number | null {
  const [dwellMs] = useState(() => parseKioskParam(window.location.search));
  return dwellMs;
}
```

- [ ] **Step 2: Write `useKioskCandidates`**

`src/hooks/useKioskCandidates.ts`:

```ts
import { useEffect, useMemo, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { graphqlRequest } from "../utils/graphqlRequest.ts";
import { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskSnapshot,
  KioskVehicle,
  SNAPSHOT_INTERVAL_MS,
  SnapshotVehicle,
  maxDataAgeSecondsOf,
  toKioskVehicle,
} from "../domain/kioskCandidates.ts";

// Only what choosing a vehicle and captioning it need. The full snapshot
// query (useVehiclePositionsSnapshotFetcher) selects every field and is
// several MB unfiltered, which a wall screen would fetch every minute.
const query = `
  query ($codespaceId: String, $operatorRef: String) {
    vehicles(codespaceId: $codespaceId, operatorRef: $operatorRef) {
      vehicleId
      serviceJourney {
        id
        date
      }
      codespace {
        codespaceId
      }
      mode
      line {
        publicCode
      }
      destinationName
      lastUpdated
      monitored
      location {
        latitude
        longitude
      }
    }
  }
`;

type Snapshots = {
  current: KioskSnapshot | null;
  previous: KioskSnapshot | null;
};

/**
 * The vehicles the kiosk may pick from: the filter's codespace and operator,
 * anywhere, refetched every SNAPSHOT_INTERVAL_MS. The previous snapshot is
 * kept so a vehicle can be compared with itself. Not the live subscription,
 * whose box is only the few kilometres around the chased vehicle.
 */
export function useKioskCandidates(
  filter: Partial<Filter>,
  enabled: boolean,
): CandidatePool {
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  const [snapshots, setSnapshots] = useState<Snapshots>({
    current: null,
    previous: null,
  });
  const { codespaceId, operatorRef } = filter;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const fetchSnapshot = async () => {
      try {
        const response = await graphqlRequest<{ vehicles: SnapshotVehicle[] }>({
          url: config["vehicle-positions-graphql-endpoint"],
          query,
          variables: { codespaceId, operatorRef },
          headers: requestHeaders,
          signal: controller.signal,
        });
        const snapshot: KioskSnapshot = {
          fetchedAt: Date.now(),
          vehicles: response.vehicles
            .map(toKioskVehicle)
            .filter((v): v is KioskVehicle => v !== null),
        };
        setSnapshots((prev) => ({ current: snapshot, previous: prev.current }));
      } catch {
        // Keep the snapshots already held; the next poll tries again. Also
        // reached when the effect is torn down mid-request.
      }
    };
    fetchSnapshot();
    const id = window.setInterval(fetchSnapshot, SNAPSHOT_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [enabled, config, requestHeaders, codespaceId, operatorRef]);

  return useMemo(
    () => ({ ...snapshots, maxDataAgeSeconds: maxDataAgeSecondsOf(filter) }),
    [snapshots, filter],
  );
}
```

- [ ] **Step 3: Write `useKiosk`**

`src/hooks/useKiosk.ts`:

```ts
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  EstimatedTimetableUpdate,
  Filter,
  MapViewOptions,
  VehicleUpdate,
} from "../types.ts";
import { VehicleData } from "./useVehiclePositionsData.ts";
import { useKioskCandidates } from "./useKioskCandidates.ts";
import { filterFromQueryParams } from "../domain/filterQueryParams.ts";
import { vehicleKey } from "../domain/kioskCandidates.ts";
import { Stillness, callsFor, kioskWorld } from "../domain/kioskJourney.ts";
import {
  DEFAULT_DWELL_MS,
  IDLE_MS,
  INITIAL_KIOSK_STATE,
  KioskConfig,
  KioskEffect,
  KioskEvent,
  KioskPhase,
  KioskState,
  effectsOf,
  step,
  targetOf,
} from "../domain/kioskSchedule.ts";

/** Close enough that the subscription's box holds the target and a few neighbours. */
export const ARRIVE_ZOOM = 14;
const TICK_MS = 1000;
/** Upper bound for the flight across the country. */
const MAX_FLIGHT_MS = 10_000;
const INPUT_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/** What the kiosk puts back when it resumes after a visitor. */
export type KioskSetup = {
  filter: Partial<Filter>;
  mapViewOptions: MapViewOptions;
  showTransitNetwork: boolean;
};

/** The app's own state changes, which `MapView` provides. */
export type KioskActions = {
  /** Vehicles mode, nothing selected, nothing followed or chased. */
  leave: () => void;
  /** Select `vehicle` and chase it. */
  chase: (vehicle: VehicleUpdate) => void;
  restore: (setup: KioskSetup) => void;
};

type UseKioskArgs = {
  /** From `useKioskQueryParam`; null turns everything off. */
  dwellMs: number | null;
  mapRef: RefObject<MapLibreMap | null>;
  data: VehicleData[];
  timetable: EstimatedTimetableUpdate | null;
  actions: KioskActions;
  /** Read once, on the first render. */
  initialSetup: Omit<KioskSetup, "filter">;
};

function liveVehicle(data: VehicleData[], key: string) {
  return (
    data.find(
      ({ vehicleUpdate: v }) =>
        vehicleKey(v.vehicleId, v.serviceJourney.id) === key,
    )?.vehicleUpdate ?? null
  );
}

/**
 * Runs the kiosk: ticks the state machine in `kioskSchedule.ts` once a
 * second with what it needs to know, pauses it on any input, and performs
 * the effects of each transition through `actions` and the map. The effects
 * run where the transition happens — in the tick, listener or moveend
 * callback — rather than in a React effect, so each happens exactly once.
 */
export function useKiosk({
  dwellMs,
  mapRef,
  data,
  timetable,
  actions,
  initialSetup,
}: UseKioskArgs): { state: KioskState | null; config: KioskConfig } {
  const enabled = dwellMs !== null;
  const [config] = useState<KioskConfig>(() => ({
    dwellMs: dwellMs ?? DEFAULT_DWELL_MS,
    idleMs: devIdleOverride() ?? IDLE_MS,
  }));
  // The setup the screen was loaded with: the filter from the URL, since the
  // filter state is only filled from it in an effect after this render.
  const [setup] = useState<KioskSetup>(() => ({
    ...initialSetup,
    filter: filterFromQueryParams(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    ),
  }));
  const pool = useKioskCandidates(setup.filter, enabled);

  const [state, setState] = useState<KioskState>(INITIAL_KIOSK_STATE);
  const stateRef = useRef(state);
  const stillness = useRef<Stillness | null>(null);
  const latest = useRef({ data, timetable, actions, pool });
  useEffect(() => {
    latest.current = { data, timetable, actions, pool };
  });

  const send = useCallback(
    function send(event: KioskEvent) {
      const prev = stateRef.current;
      const next = step(prev, event, config);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      for (const effect of effectsOf(prev.phase, next.phase)) {
        perform(effect, next.phase);
      }

      function perform(effect: KioskEffect, phase: KioskPhase) {
        const { actions, data } = latest.current;
        const target = targetOf(phase);
        switch (effect) {
          case "restoreSetup":
            actions.restore(setup);
            return;
          case "leave":
            stillness.current = null;
            actions.leave();
            return;
          case "flyToTarget": {
            const map = mapRef.current;
            if (!map || !target) return;
            map.flyTo({
              center: [target.lon, target.lat],
              zoom: ARRIVE_ZOOM,
              bearing: 0,
              essential: true,
              maxDuration: MAX_FLIGHT_MS,
            });
            // Registered after flyTo: starting a flight stops any camera move
            // in progress, and that move's moveend is not this arrival.
            map.once("moveend", () =>
              send({ type: "arrived", now: Date.now() }),
            );
            return;
          }
          case "startChase": {
            const vehicle = target && liveVehicle(data, target.key);
            if (vehicle) actions.chase(vehicle);
            return;
          }
        }
      }
    },
    [config, setup, mapRef],
  );

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const { data, timetable, pool } = latest.current;
      const target = targetOf(stateRef.current.phase);
      const vehicle = target && liveVehicle(data, target.key);
      const { world, stillness: next } = kioskWorld(
        vehicle
          ? { lon: vehicle.location.longitude, lat: vehicle.location.latitude }
          : null,
        target ? callsFor(timetable, target.serviceJourneyId) : null,
        stillness.current,
        now,
      );
      stillness.current = next;
      send({ type: "tick", now, world, pool, random: Math.random() });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, send]);

  // Captured, so input reaches the kiosk before anything that stops it. The
  // kiosk's own camera moves raise none of these events.
  useEffect(() => {
    if (!enabled) return;
    const onInput = () => send({ type: "input", now: Date.now() });
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    return () => {
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [enabled, send]);

  // Lets the Playwright tests see the phase. Development builds only.
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    (window as unknown as { __kiosk?: { phase: string } }).__kiosk = {
      phase: state.phase.kind,
    };
  }, [enabled, state]);

  return { state: enabled ? state : null, config };
}

/** A shorter idle period for the Playwright tests. Development builds only. */
function devIdleOverride(): number | null {
  if (!import.meta.env.DEV) return null;
  const value = (window as unknown as { __kioskIdleMs?: unknown })
    .__kioskIdleMs;
  return typeof value === "number" && value > 0 ? value : null;
}
```

- [ ] **Step 4: Type-check and lint**

```bash
npx prettier --write src/hooks/useKioskQueryParam.ts src/hooks/useKioskCandidates.ts src/hooks/useKiosk.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint -- --max-warnings 0
```

Expected: `tsc` prints nothing; lint exits 0. If `react-hooks` flags reading `latest.current`/`stateRef.current` inside the callbacks, it is wrong to — they are read in event callbacks, not during render — but do not suppress it: report it, since `ChaseCamera` uses the same ref-in-effect pattern (`onStopRef`) without complaint.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKioskQueryParam.ts src/hooks/useKioskCandidates.ts src/hooks/useKiosk.ts
git commit -m "Add the kiosk hooks"
```

---

### Task 6: Run the kiosk in MapView

**Files:**

- Modify: `src/components/MapView.tsx`
- Modify: `src/components/Vehicle/ChaseCamera.tsx` (add `hudHidden`)

**Interfaces:**

- Consumes: `useKiosk`, `KioskActions` (Task 5); `useKioskQueryParam` (Task 5); `restoredFilter` (Task 3); `selectedVehicleFrom` (Task 4).
- Produces (inside `MapView`, used by Task 7): `kiosk` (`{ state, config }`), `kioskRunning: boolean` (kiosk on and not paused), and `startChase(vehicle: ChasedVehicle)`.

- [ ] **Step 1: Let ChaseCamera hide its HUD**

In `src/components/Vehicle/ChaseCamera.tsx`, add to `Props` after `onCoveredChange`:

```ts
/**
 * The kiosk hides the HUD while it runs; its caption band says what is
 * chased. Hidden, the HUD covers nothing and reports 0.
 */
hudHidden: boolean;
```

Destructure `hudHidden` in the component's parameters. In the HUD-measuring layout effect, after `if (!hud) return;`, add:

```ts
if (hudHidden) {
  onCoveredChange(0);
  return;
}
```

and add `hudHidden` to its dependency array: `[bottomInset, onCoveredChange, hudHidden]`.

Replace the HUD `<div>`'s `style` prop with:

```tsx
      style={{
        ...(bottomInset > 0 && { bottom: bottomInset + HUD_SHEET_GAP }),
        // Not the `hidden` attribute: `.chase-hud` sets display, which wins.
        ...(hudHidden && { display: "none" }),
      }}
```

- [ ] **Step 2: Extract `startChase` in MapView**

In `src/components/MapView.tsx`, replace `handleChaseToggle` with:

```ts
// A chase is a view from behind the vehicle, which only reads with terrain
// and buildings. ViewDimensionLayers' pitch ease is superseded by the
// chase's own fly-in, which starts on the next animation frame.
const startChase = useCallback(
  (vehicle: ChasedVehicle) => {
    clearFollowedVehicle();
    if (viewDimension !== "3d") {
      chaseSwitchedTo3d.current = true;
      setViewDimension("3d");
    }
    setChasedVehicle(vehicle);
  },
  [clearFollowedVehicle, viewDimension, setViewDimension],
);

const handleChaseToggle = () => {
  if (!selectedVehicle) return;
  const { id, serviceJourneyId } = selectedVehicle.properties;
  if (
    chasedVehicle?.vehicleId === id &&
    chasedVehicle.serviceJourneyId === serviceJourneyId
  ) {
    stopChase();
    return;
  }
  startChase({ vehicleId: id, serviceJourneyId });
};
```

- [ ] **Step 3: Move the timetable above the sheet block and add the kiosk**

Move the block starting `// The selected journey's timetable and route, here rather than in the panel` (the `selectedJourneyId`, `timetable`, `route` and `ghostSchedule` declarations) up to directly after `switchMode`, unchanged. Then, directly after it, add:

```ts
// Kiosk mode (`?kiosk=<seconds>`): the kiosk drives the same selection and
// chase a person does, through these, so everything that follows a chase —
// 3D, padding, route, timetable — behaves as it does for a person.
const kioskDwellMs = useKioskQueryParam();
const kioskActions: KioskActions = {
  leave: () => {
    switchMode("vehicles");
    setSelectedVehicle(null);
    clearFollowedVehicle();
    stopChase();
  },
  chase: (vehicle) => {
    setSelectedVehicle(selectedVehicleFrom(vehicle));
    startChase({
      vehicleId: vehicle.vehicleId,
      serviceJourneyId: vehicle.serviceJourney.id,
    });
  },
  restore: (setup) => {
    switchMode("vehicles");
    setCurrentFilter((prev) => restoredFilter(prev, setup.filter));
    setMapViewOptions(setup.mapViewOptions);
    setShowTransitNetwork(setup.showTransitNetwork);
  },
};
const kiosk = useKiosk({
  dwellMs: kioskDwellMs,
  mapRef,
  data,
  timetable,
  actions: kioskActions,
  initialSetup: { mapViewOptions, showTransitNetwork },
});
// Running and not paused: the app's own controls are hidden.
const kioskRunning =
  kiosk.state !== null && kiosk.state.phase.kind !== "paused";
```

Add the imports:

```ts
import { KioskActions, useKiosk } from "../hooks/useKiosk.ts";
import { useKioskQueryParam } from "../hooks/useKioskQueryParam.ts";
import { restoredFilter } from "../domain/kioskSchedule.ts";
import { selectedVehicleFrom } from "./Vehicle/vehicleFeature.ts";
```

- [ ] **Step 4: Hide the chrome while the kiosk runs**

In the JSX:

```tsx
{
  !kioskRunning && (
    <>
      <NavigationControl position="top-left" />
      <GeolocateControl position="top-left" />
      <ViewDimensionControl
        dimension={viewDimension}
        setDimension={setViewDimension}
      />
      {viewDimension === "3d" && <RotateControl />}
    </>
  );
}
```

replacing the four existing control lines; wrap `<RightMenu … />` in `{!kioskRunning && ( … )}`; pass `hudHidden={kioskRunning}` to `<ChaseCamera>`; and change the panel condition to

```tsx
      {mode === "vehicles" && !(kioskRunning && !narrow) && (
        <SelectedVehiclePanel
```

(On a phone the sheet stays: the spec uses it at `peek` instead of the band.) `<MapAttribution>` is not touched.

- [ ] **Step 5: Type-check, lint, run the unit tests, and try it**

```bash
npx prettier --write src/components/MapView.tsx src/components/Vehicle/ChaseCamera.tsx
npx tsc -p tsconfig.app.json --noEmit
npm run lint -- --max-warnings 0
npm test
```

Expected: `tsc` silent, lint 0, all tests pass.

Then `npm run dev` and open `http://localhost:5173/?kiosk=30&codespaceId=ATB` in a wide window. Expect: no toolbar or map controls; within about a minute the map flies to Trøndelag and a chase starts; after 30 s plus a stop arrival (at most 150 s) it flies to another ATB vehicle. Press a key: the toolbar comes back. Leave it for 2 minutes: the toolbar goes and it flies to a new vehicle. There is no caption yet — that is Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.tsx src/components/Vehicle/ChaseCamera.tsx
git commit -m "Run the kiosk from MapView"
```

---

### Task 7: The kiosk overlay

**Files:**

- Create: `src/components/KioskOverlay.tsx`
- Modify: `src/components/SelectedVehiclePanel/callTimes.ts` (gain `formatTime`)
- Modify: `src/components/SelectedVehiclePanel/StopRow.tsx` (import `formatTime` instead of defining it)
- Modify: `src/components/MapView.tsx` (render the overlay; band height into the padding)

**Interfaces:**

- Consumes: `kioskView`, `formatCountdown`, `KioskState`, `KioskConfig` (Task 3); `KioskVehicle`, `vehicleKey` (Task 1); `upcomingCalls`, `callsFor` (Task 2); `kiosk`, `kioskRunning` (Task 6).
- Produces: `KioskOverlay` with props `{ state: KioskState; config: KioskConfig; vehicle: VehicleUpdate | null; calls: Call[] | null; narrow: boolean; bottom: number; onCoveredChange: (px: number) => void }`; `formatTime(iso: string | null): string | null` exported from `callTimes.ts`.

- [ ] **Step 1: Share `formatTime`**

Cut `formatTime` from `StopRow.tsx` (lines 43–52 today) into `callTimes.ts` as `export function formatTime`, with this doc comment:

```ts
/** `HH:MM` in the viewer's locale, 24-hour; null for a missing or bad time. */
```

In `StopRow.tsx`, change the import to `import { formatTime, resolveCallTimes } from "./callTimes.ts";`.

Run: `npx vitest run src/components/SelectedVehiclePanel` — Expected: PASS (existing tests unchanged).

- [ ] **Step 2: Write `KioskOverlay`**

`src/components/KioskOverlay.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Call, VehicleUpdate } from "../types.ts";
import { FloatingCard } from "./FloatingCard.tsx";
import { VehicleIconCanvas } from "./VehicleIconCanvas.tsx";
import { VEHICLE_ICON_URLS } from "./vehicleIconImages.ts";
import { SURFACE_INSET } from "./theme.ts";
import { vehicleIconName } from "../domain/vehicleIcons.ts";
import { labelColoursFor } from "../domain/vehiclePaint.ts";
import { KioskVehicle } from "../domain/kioskCandidates.ts";
import { upcomingCalls } from "../domain/kioskJourney.ts";
import {
  KioskConfig,
  KioskState,
  formatCountdown,
  kioskView,
} from "../domain/kioskSchedule.ts";
import {
  delayBucket,
  delayColour,
  formatDelay,
} from "./SelectedVehiclePanel/delayThresholds.ts";
import {
  formatTime,
  resolveCallTimes,
} from "./SelectedVehiclePanel/callTimes.ts";

const CLOCK_MS = 1000;
/** Clear space kept between the band's top edge and the chased vehicle. */
const BAND_VEHICLE_GAP = 12;
const ICON_SIZE = 56;

type KioskOverlayProps = {
  state: KioskState;
  config: KioskConfig;
  /** The target's latest live report, once it is in the feed. */
  vehicle: VehicleUpdate | null;
  /** The target journey's calls, or null without its timetable. */
  calls: Call[] | null;
  narrow: boolean;
  /** px off the map's bottom edge, clear of the attribution (`sheetBottom`). */
  bottom: number;
  /** px of the map's bottom edge the band hides, 0 when it is gone. */
  onCoveredChange: (px: number) => void;
};

/**
 * What a wall screen shows: a band across the bottom with the chased
 * vehicle and its next stops, "Next: …" while flying to another, and a small
 * pill while a visitor has paused it. On a phone only the pill; the detail
 * sheet stays.
 */
export function KioskOverlay({
  state,
  config,
  vehicle,
  calls,
  narrow,
  bottom,
  onCoveredChange,
}: KioskOverlayProps) {
  const now = useNow(CLOCK_MS);
  const view = kioskView(state, now, config);

  if (view.kind === "paused") {
    return (
      <KioskPill>
        Kiosk paused · resumes in {formatCountdown(view.resumesInMs)}
      </KioskPill>
    );
  }
  if (narrow) {
    if (view.kind === "message") return <KioskPill>{view.text}</KioskPill>;
    if (view.kind === "travelling") {
      return (
        <KioskPill>
          Next: {view.target.lineCode} {view.target.destinationName ?? ""}
        </KioskPill>
      );
    }
    return null;
  }
  return (
    <KioskBand
      bottom={bottom}
      onCoveredChange={onCoveredChange}
      progress={view.kind === "chasing" ? view.progress : null}
      pulsing={view.kind === "chasing" && view.waitingForStop}
    >
      {view.kind === "message" ? (
        <Typography variant="h5">{view.text}</Typography>
      ) : (
        <>
          <Caption
            target={view.target}
            vehicle={view.kind === "chasing" ? vehicle : null}
            next={view.kind === "travelling"}
          />
          {view.kind === "chasing" && calls && (
            <StopStrip calls={upcomingCalls(calls)} />
          )}
        </>
      )}
    </KioskBand>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function KioskBand({
  bottom,
  onCoveredChange,
  progress,
  pulsing,
  children,
}: {
  bottom: number;
  onCoveredChange: (px: number) => void;
  progress: number | null;
  pulsing: boolean;
  children: ReactNode;
}) {
  // Reported like the HUD's, so MapBottomPadding — still the only writer of
  // the bottom padding — centres the chase in the map above the band.
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const band = ref.current;
    if (!band) return;
    const report = () =>
      onCoveredChange(Math.ceil(bottom + band.offsetHeight + BAND_VEHICLE_GAP));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(band);
    return () => {
      observer.disconnect();
      onCoveredChange(0);
    };
  }, [bottom, onCoveredChange]);

  return (
    <Box
      ref={ref}
      sx={{
        position: "absolute",
        left: SURFACE_INSET,
        right: SURFACE_INSET,
        bottom,
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      <FloatingCard
        role="region"
        aria-label="Kiosk"
        sx={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 4,
          minHeight: 96,
          px: 3,
          py: 2.5,
          boxSizing: "border-box",
        }}
      >
        {progress !== null && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 3,
              width: `${progress * 100}%`,
              bgcolor: "selection.main",
              transition: "width 1s linear",
              ...(pulsing && {
                animation: "kiosk-pulse 1.6s ease-in-out infinite",
                "@keyframes kiosk-pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.35 },
                },
              }),
            }}
          />
        )}
        {children}
      </FloatingCard>
    </Box>
  );
}

function Caption({
  target,
  vehicle,
  next,
}: {
  target: KioskVehicle;
  vehicle: VehicleUpdate | null;
  next: boolean;
}) {
  const mode = vehicle?.mode ?? target.mode;
  const lineCode = vehicle?.line.publicCode ?? target.lineCode;
  const destination = vehicle?.destinationName ?? target.destinationName;
  // Only as a pair, as on the map (labelColoursFor).
  const colours = vehicle ? labelColoursFor(vehicle.line) : null;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        minWidth: 0,
        flexShrink: 0,
        maxWidth: "45%",
      }}
    >
      <VehicleIconCanvas
        url={VEHICLE_ICON_URLS[vehicleIconName(mode)] ?? null}
        size={ICON_SIZE}
      />
      <Box sx={{ minWidth: 0 }}>
        {next && (
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", lineHeight: 1.2 }}
          >
            Next
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
          <Typography
            component="span"
            variant="h4"
            sx={{
              fontWeight: 700,
              px: 1,
              borderRadius: "var(--mui-shape-borderRadius)",
              ...(colours && {
                color: colours.text,
                backgroundColor: colours.halo,
              }),
            }}
          >
            {lineCode}
          </Typography>
          <Typography component="span" variant="h4" noWrap>
            {destination ?? ""}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          {target.codespaceId}
          {vehicle && (
            <>
              {" · "}
              <Box
                component="span"
                sx={{ color: delayColour(delayBucket(vehicle.delay)) }}
              >
                {formatDelay(vehicle.delay)}
              </Box>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

function StopStrip({ calls }: { calls: Call[] }) {
  if (calls.length === 0) return null;
  return (
    <Box
      component="ol"
      sx={{
        display: "flex",
        gap: 1,
        m: 0,
        p: 0,
        listStyle: "none",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {calls.map((call, i) => {
        const times = resolveCallTimes(call);
        const current = i === 0;
        return (
          <Box
            component="li"
            key={call.order}
            sx={{
              flex: "1 1 0",
              minWidth: 0,
              px: 1.5,
              py: 1,
              borderRadius: "var(--mui-shape-borderRadius)",
              ...(current && {
                bgcolor: "selection.bg",
                color: "selection.main",
              }),
            }}
          >
            <Typography variant="h6" noWrap>
              {formatTime(times.realtime ?? times.aimed) ?? "–"}
            </Typography>
            <Typography
              variant="body1"
              noWrap
              sx={{ color: current ? "inherit" : "text.secondary" }}
            >
              {call.stopPoint.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function KioskPill({ children }: { children: ReactNode }) {
  return (
    <FloatingCard
      role="status"
      sx={{
        position: "absolute",
        top: SURFACE_INSET,
        left: 0,
        right: 0,
        mx: "auto",
        width: "fit-content",
        maxWidth: `calc(100% - ${8 * SURFACE_INSET}px)`,
        zIndex: 4,
        px: 2,
        py: 1,
      }}
    >
      <Typography variant="body2" noWrap>
        {children}
      </Typography>
    </FloatingCard>
  );
}
```

- [ ] **Step 3: Render it from MapView**

In `src/components/MapView.tsx`:

Add imports:

```ts
import { KioskOverlay } from "./KioskOverlay.tsx";
import { targetOf } from "../domain/kioskSchedule.ts";
import { vehicleKey } from "../domain/kioskCandidates.ts";
import { callsFor } from "../domain/kioskJourney.ts";
```

(merge `targetOf` into the existing `kioskSchedule.ts` import.)

Replace the `mapBottomInset` declaration with:

```ts
const chaseBottomInset = chasedVehicle
  ? Math.max(sheetBottomInset, chaseHudCovered)
  : sheetBottomInset;
// The kiosk's band hides the bottom of the map on a wide screen. Read only
// while it is drawn, like the HUD's value.
const [kioskBandCovered, setKioskBandCovered] = useState(0);
const kioskBand = kioskRunning && !narrow;
const mapBottomInset = kioskBand
  ? Math.max(chaseBottomInset, kioskBandCovered)
  : chaseBottomInset;
```

Before the `return`, add:

```ts
const kioskTarget = kiosk.state ? targetOf(kiosk.state.phase) : null;
const kioskVehicle = kioskTarget
  ? (data.find(
      ({ vehicleUpdate: v }) =>
        vehicleKey(v.vehicleId, v.serviceJourney.id) === kioskTarget.key,
    )?.vehicleUpdate ?? null)
  : null;
const kioskCalls = kioskTarget
  ? callsFor(timetable, kioskTarget.serviceJourneyId)
  : null;
```

Change the panel condition from Task 6 to `{mode === "vehicles" && !kioskBand && (`, and after the `{mode === "situations" && <SituationDetailPanel … />}` line add:

```tsx
{
  kiosk.state && (
    <KioskOverlay
      state={kiosk.state}
      config={kiosk.config}
      vehicle={kioskVehicle}
      calls={kioskCalls}
      narrow={narrow}
      bottom={sheetBottomEdge}
      onCoveredChange={setKioskBandCovered}
    />
  );
}
```

- [ ] **Step 4: Check it all and look at it**

```bash
npx prettier --write src/components/KioskOverlay.tsx src/components/MapView.tsx src/components/SelectedVehiclePanel/callTimes.ts src/components/SelectedVehiclePanel/StopRow.tsx
npx tsc -p tsconfig.app.json --noEmit
npm run lint -- --max-warnings 0
npm test
```

Expected: silent `tsc`, lint 0, tests pass.

With `npm run dev`, open `http://localhost:5173/?kiosk=30&codespaceId=ATB` wide, in both light and dark (toggle before loading, or via the pill's paused state). Expect: "Waiting for vehicles…" band; then "Next: <line> <destination>" while flying; then the caption, delay, and up to five stops with the first highlighted, and a progress line filling over 30 s that pulses once full; the chased vehicle centred above the band, not under it; the attribution strip still in the corner below the band. Press a key: the band is replaced by the "Kiosk paused · resumes in m:ss" pill and the toolbar returns. Narrow the window below 600 px: only the pill (while travelling/paused) and the normal sheet.

- [ ] **Step 5: Commit**

```bash
git add src/components/KioskOverlay.tsx src/components/MapView.tsx src/components/SelectedVehiclePanel/callTimes.ts src/components/SelectedVehiclePanel/StopRow.tsx
git commit -m "Add the kiosk overlay"
```

---

### Task 8: Playwright smoke tests

**Files:**

- Create: `tests/kiosk.spec.ts`

**Interfaces:**

- Consumes: the dev-only `window.__kiosk` and `window.__kioskIdleMs` (Task 5); the `Kiosk` region and the paused pill (Task 7); the mode buttons' accessible names ("Situations", exact).

Like the other smoke tests these run against the live dev backend from `public/bootstrap.json`, and skip rather than fail when the feed gives them nothing to lock on to.

- [ ] **Step 1: Write the tests**

`tests/kiosk.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

type KioskWindow = {
  __kiosk?: { phase: string };
  __kioskIdleMs?: number;
};

test.describe("kiosk mode", () => {
  test.beforeEach(async ({ page }) => {
    // Resume 3 s after the last input instead of 2 minutes. Read once, when
    // the kiosk starts; development builds only.
    await page.addInitScript(() => {
      (window as unknown as KioskWindow).__kioskIdleMs = 3000;
    });
  });

  test("hides the app's controls and switches to vehicles", async ({
    page,
  }) => {
    await page.goto("/?mode=situations&kiosk=20");

    await expect(
      page.getByRole("button", { name: "Situations", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
    // The first pick switches modes; it waits for the first snapshot.
    await expect(page).toHaveURL(/mode=vehicles/, { timeout: 30000 });
  });

  test("chases, pauses on input and restores its setup on resume", async ({
    page,
  }) => {
    await page.goto("/?kiosk=20");

    const chased = await page
      .waitForFunction(
        () => (window as unknown as KioskWindow).__kiosk?.phase === "chasing",
        null,
        { timeout: 60000 },
      )
      .then(
        () => true,
        () => false,
      );
    test.skip(!chased, "No vehicle locked on within a minute");

    await expect(page.getByRole("region", { name: "Kiosk" })).toBeVisible();

    await page.keyboard.press("Shift");
    await expect(page.getByText(/Kiosk paused/)).toBeVisible();
    const situations = page.getByRole("button", {
      name: "Situations",
      exact: true,
    });
    await expect(situations).toBeVisible();

    // A visitor switches modes and walks away.
    await situations.click();
    await expect(page).toHaveURL(/mode=situations/);

    // 3 s later the kiosk resumes and puts its own setup back.
    await expect(page).toHaveURL(/mode=vehicles/, { timeout: 10000 });
    await expect(situations).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx playwright test tests/kiosk.spec.ts --project=chromium`
Expected: 2 passed (or the second skipped with "No vehicle locked on within a minute" if dev has no vehicles at that hour — then rerun when it does before claiming it passes).

- [ ] **Step 3: Run the whole smoke suite in Chromium**

Run: `npx playwright test --project=chromium`
Expected: all pass (existing tests unaffected — none loads `?kiosk`).

- [ ] **Step 4: Commit**

```bash
npx prettier --write tests/kiosk.spec.ts
git add tests/kiosk.spec.ts
git commit -m "Add kiosk smoke tests"
```

---

### Task 9: Document kiosk mode in CLAUDE.md

**Files:**

- Modify: `CLAUDE.md` (new section after "Phone layout")

- [ ] **Step 1: Add the section**

Insert after the "Phone layout" section:

```markdown
## Kiosk mode

- `?kiosk=<seconds>` runs vehicles mode unattended for a wall screen: pick a vehicle the URL's filter allows, chase it, switch after the dwell (default 180 s) at the next stop arrival, capped 120 s later. Read once by `useKioskQueryParam`, never written, and not part of `Filter`, so it never reaches the subscription variables.
- Every decision is pure in `src/domain/`: `kioskCandidates.ts` (what to pick), `kioskJourney.ts` (stood still, journey ended, arrived at a stop) and `kioskSchedule.ts` (the phases, `step`, and `effectsOf` — the side effects of each transition). `useKiosk` only ticks the machine, listens for input and performs effects; it performs them in the callback where the transition happens, never in a React effect, so each runs once.
- Candidates come from `useKioskCandidates`, a lean `vehicles` query polled every 60 s with the previous result kept — **not** the live subscription, whose box during a chase is the few kilometres around the chased vehicle. "Good" (monitored, seen within 10 s of the fetch, moved ≥ 100 m since the previous snapshot) is preferred; anything within maxDataAge is the fallback.
- The kiosk drives the app through the same callbacks a person does — `MapView`'s `startChase`, `stopChase`, `switchMode`, `setCurrentFilter` — so 3D, padding, route, timetable and the chase camera need no kiosk awareness. The target is not in the live feed until the map has flown to it: `leaving` waits 1.5 s for the chase's exit ease, `arriving` is one `flyTo`, and `lockingOn` waits for the target in `data` (15 s, then pick again).
- Any `pointerdown`, `wheel` or `keydown` pauses it; 120 s without input resumes it and restores the setup the screen loaded with (`restoredFilter`, mode, layer switches). The app's controls, the detail card and the chase HUD (`hudHidden`) are hidden only while it runs; the attribution never is.
- `KioskOverlay`'s band reports its height into `mapBottomInset`, so `MapBottomPadding` stays the only writer of the bottom padding. On a phone there is no band: the sheet stays and only the pill shows.
- `window.__kiosk` (phase) and `window.__kioskIdleMs` (idle override) exist in development builds only, for `tests/kiosk.spec.ts`.
```

- [ ] **Step 2: Check formatting and commit**

```bash
npx prettier --check CLAUDE.md
git add CLAUDE.md
git commit -m "Document kiosk mode"
```

Expected: Prettier reports the file formatted (fix with `--write` if not, then commit).
