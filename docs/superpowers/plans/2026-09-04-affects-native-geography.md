# Situations affects — native geography — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw situations from the geography the situations feed now serves itself, and delete the borrowed-geometry apparatus that stood in for it.

**Architecture:** `Affects` grows `vehicleJourneys` and `affectedLines`, which pair each affected journey and line with its **located** stops and expose the affected span of a journey as an encoded polyline. `buildSituationFeatures` becomes a pure function of the feed — no async lookups, no caches — emitting five feature sources instead of four. The five borrowed-geometry modules are deleted. Work proceeds additive-first: new fields and features land while the old path still runs, then the old path is removed, so every task ends with a green build.

**Tech Stack:** React + TypeScript + Vite, `graphql-ws` subscriptions, MapLibre via `react-map-gl/maplibre`, Vitest (node environment, `src/**/*.test.ts` only — no `.tsx` tests).

**Spec:** `docs/superpowers/specs/2026-09-04-affects-native-geography-design.md`

## Global Constraints

- ESM only. **Local imports carry the explicit `.ts`/`.tsx` extension.** Match the surrounding style.
- Do not add a component file that also exports a non-component value (`react-refresh/only-export-components`).
- Testable logic lives in plain `.ts` modules — `vitest.config.ts` sets `include: ["src/**/*.test.ts"]`, so a `.tsx` test is never collected.
- **Type-check with `npx tsc --noEmit -p tsconfig.app.json`, never bare `npx tsc --noEmit`.** The root `tsconfig.json` has `"files": []` and only project references, so the bare form exits 0 without checking anything — verified against a deliberately broken file.
- The two CI gates are `npm test` and `npm run check` (Prettier). `lint` is not gated but should still pass. A Husky pre-commit hook runs Prettier on staged files, so a commit may reformat what you staged.
- Deduplication of situation features is **within a situation only**. Two situations affecting one stop must still produce two coincident features.
- Never invent geometry: no centroids, no averaging, no Journey Planner fallback. A situation that flattens to nothing belongs in `unmappable`.
- Endpoints come from `/bootstrap.json` via `ConfigContext`, never from Vite env vars.
- Dev API for any manual query: `https://api.dev.entur.io/realtime/v2/vehicles/graphql`, header `ET-Client-Name: entur-vehicle-map-demo-dev`.
- **Do not touch `src/components/mapStyle.ts`, `src/components/SituationLayers.tsx` or `src/domain/appMode.ts`.** No layer or source changes anywhere in this plan: the `situationPoints` and `situationLines` sources and their four layers already exist and already take point and line features. `appMode.test.ts` enforces that every layer is classified; adding one would fail that gate for no reason.
- The `source` and `entityId` feature properties are read by nothing outside `situationFeatures.test.ts`, so widening or narrowing the `source` union needs no consumer updates — but it does need the tests updated.

---

### Task 1: Add the new affects fields to types, fragment and fixtures

Purely additive. Nothing is removed, so the existing borrowed-geometry path keeps working and the build stays green.

**Files:**

- Modify: `src/types.ts` (the `AffectedStop` / `Affects` block, ~line 200-225)
- Modify: `src/hooks/situationFragments.ts` (`SITUATION_QA_FIELDS_FRAGMENT`)
- Modify: `scripts/capture-situations-fixture.mjs` (`QUERY`)
- Modify: `src/domain/situationFeatures.test.ts` (10 affects literals)
- Modify: `src/domain/situationStats.test.ts` (`EMPTY_AFFECTS`, line 10)
- Regenerate: `src/__fixtures__/situations.json`

**Interfaces:**

- Consumes: nothing.
- Produces: `StopRef`, `StopConditionEnumeration`, `AffectedStop`, `AffectedVehicleJourney`, `AffectedLine`, and an `Affects` carrying `vehicleJourneys` and `affectedLines`. Tasks 2, 3 and 5 all build on these exact names.

- [ ] **Step 1: Rename the existing `AffectedStop` to `StopRef` and add the new types**

In `src/types.ts`, replace the existing `AffectedStop` declaration and the `Affects` type with the following. Note `StopRef` is the _old_ `AffectedStop` under a new name — same shape, so `stopPoints`/`stopPlaces` are unaffected. It cannot be the existing `Stop`, whose `name` and `location` are non-null; `affects` does deliver stops the API could not resolve.

```ts
/** A stop as `affects` delivers it: id always, name and location only when the API resolved them. */
export type StopRef = {
  id: string;
  name: string | null;
  location: { latitude: number; longitude: number } | null;
};

export type StopConditionEnumeration =
  | "exceptionalStop"
  | "destination"
  | "notStopping"
  | "requestStop"
  | "startPoint";

/** A stop within an affected journey or line, with the SIRI stop conditions that qualify it. */
export type AffectedStop = {
  stop: StopRef;
  stopConditions: StopConditionEnumeration[];
};

/**
 * One affected journey, with the stops it is affected at and — when the API can
 * produce one — the span of its route between the first and last of them.
 *
 * `line` here is display context only. A journey entry is scoped to the journey
 * it names, never to this line.
 */
export type AffectedVehicleJourney = {
  serviceJourney: { id: string } | null;
  datedServiceJourney: { id: string } | null;
  line: Line | null;
  operator: Operator | null;
  stops: AffectedStop[] | null;
  affectedPointsOnLink: { points: string | null; length: number | null } | null;
};

/** One affected line. A line has many journey patterns, so it carries no geometry — only stops. */
export type AffectedLine = {
  line: Line | null;
  stops: AffectedStop[] | null;
};
```

Then update `Affects` itself, keeping every existing field for now:

```ts
export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  lines: Line[] | null;
  stopPoints: StopRef[] | null;
  stopPlaces: StopRef[] | null;
  serviceJourneys: ServiceJourney[] | null;
  datedServiceJourneys: { id: string }[] | null;
  operators: Operator[] | null;
  vehicleJourneys: AffectedVehicleJourney[] | null;
  affectedLines: AffectedLine[] | null;
};
```

Leave the doc comment above `Affects` alone for now — Task 5 rewrites it, once it is actually true.

- [ ] **Step 2: Run the type check to see exactly what broke**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: FAIL. Every object literal that builds a whole `Affects` is now missing two required properties, plus one reference to the old `AffectedStop` name in `src/domain/situationFeatures.ts`.

- [ ] **Step 3: Repoint `situationFeatures.ts` at the renamed type**

In `src/domain/situationFeatures.ts`, change the import of `AffectedStop` to `StopRef`, and the `addStops` parameter type from `AffectedStop[]` to `StopRef[]`. Nothing else in that file changes in this task.

- [ ] **Step 4: Add the two new keys to every affects literal in the tests**

`src/domain/situationStats.test.ts` line 10:

```ts
const EMPTY_AFFECTS = {
  vehicleModes: null,
  lines: null,
  stopPoints: null,
  stopPlaces: null,
  serviceJourneys: null,
  datedServiceJourneys: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};
```

`src/domain/situationFeatures.test.ts` has ten such literals (at roughly lines 24, 52, 70, 95, 118, 158, 192, 221, 281, 303). Add `vehicleJourneys: null,` and `affectedLines: null,` to each. They are all recognisable by their `vehicleModes: null,` first line.

- [ ] **Step 5: Verify the build and tests are green again**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: PASS. This task changed no behaviour.

- [ ] **Step 6: Add the new fields to the GraphQL fragment**

In `src/hooks/situationFragments.ts`, inside `SITUATION_QA_FIELDS_FRAGMENT`'s `affects { ... }` block, append after `operators { operatorRef name }`:

```graphql
      vehicleJourneys {
        serviceJourney { id }
        datedServiceJourney { id }
        line { lineRef lineName publicCode }
        operator { operatorRef name }
        stops { stop { id name location { latitude longitude } } stopConditions }
        affectedPointsOnLink { points length }
      }
      affectedLines {
        line { lineRef lineName publicCode }
        stops { stop { id name location { latitude longitude } } stopConditions }
      }
```

- [ ] **Step 7: Mirror the same selection into the fixture capture script**

`scripts/capture-situations-fixture.mjs` holds its own copy of the query. Add the identical two blocks to its `affects { ... }`, after `operators { operatorRef name }`. Leave its `KINDS` array alone — Task 5 updates it.

- [ ] **Step 8: Verify the query validates against the live API**

```bash
curl -s -X POST https://api.dev.entur.io/realtime/v2/vehicles/graphql \
  -H 'Content-Type: application/json' \
  -H 'ET-Client-Name: entur-vehicle-map-demo-dev' \
  -d '{"query":"{ situations { affects { vehicleJourneys { datedServiceJourney { id } stops { stop { id name location { latitude longitude } } stopConditions } affectedPointsOnLink { points length } } affectedLines { line { lineRef } stops { stop { id name location { latitude longitude } } } } } } }"}' \
  | head -c 400
```

Expected: JSON starting `{"data":{"situations":[` — **not** an `errors` array. If it reports unknown fields, stop: the API changed again and the spec's measurements need redoing before continuing.

- [ ] **Step 9: Recapture the fixture**

```bash
npm run capture-fixtures
```

Expected: prints `captured N of M situations; shapes: ...`. Confirm the new data actually landed, rather than trusting the exit code:

```bash
grep -c "affectedPointsOnLink" src/__fixtures__/situations.json
grep -c "vehicleJourneys" src/__fixtures__/situations.json
```

Expected: both greater than 0. If `affectedPointsOnLink` is 0, the shape-sampling picked no situation carrying a span; that is acceptable at this step, and Task 3 adds a hand-built fixture for spans regardless.

- [ ] **Step 10: Run the full suite and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check
```

Expected: PASS.

```bash
git add src/types.ts src/hooks/situationFragments.ts scripts/capture-situations-fixture.mjs src/domain/situationFeatures.test.ts src/domain/situationStats.test.ts src/__fixtures__/situations.json src/domain/situationFeatures.ts
git commit -m "Select the new affects journey and line fields"
```

---

### Task 2: Build point features from the new journey and line stops

Adds the `journeyStop` and `lineStop` sources, and changes point deduplication to key on stop id alone. Still additive — the old sources keep working.

**Files:**

- Modify: `src/domain/situationFeatures.ts`
- Test: `src/domain/situationFeatures.test.ts`

**Interfaces:**

- Consumes: `AffectedStop`, `AffectedVehicleJourney`, `AffectedLine`, `StopRef` from Task 1.
- Produces: `SituationFeatureProperties["source"]` widened to include `"journeyStop"` and `"lineStop"`. Task 3 widens it again with `"affectedSpan"`; Task 4 removes `"line"` and `"datedServiceJourney"`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/situationFeatures.test.ts`. `EMPTY` spells out every `Affects` key so each test states only what it cares about.

```ts
const EMPTY = {
  vehicleModes: null,
  lines: null,
  stopPoints: null,
  stopPlaces: null,
  serviceJourneys: null,
  datedServiceJourneys: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};

const affectedStop = (id: string, latitude: number, longitude: number) => ({
  stop: { id, name: id, location: { latitude, longitude } },
  stopConditions: [],
});

describe("stops carried by the new affects fields", () => {
  it("builds a point per located stop of an affected journey", () => {
    const { pointFeatures, unmappable } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              {
                serviceJourney: null,
                datedServiceJourney: { id: "VYG:DatedServiceJourney:1" },
                line: null,
                operator: null,
                stops: [
                  affectedStop("NSR:Quay:1", 59.9, 10.7),
                  affectedStop("NSR:Quay:2", 60.1, 10.8),
                ],
                affectedPointsOnLink: null,
              },
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
    expect(pointFeatures[0].properties.entityId).toBe("NSR:Quay:1");
    expect(pointFeatures[0].geometry.coordinates).toEqual([10.7, 59.9]);
    expect(unmappable).toEqual([]);
  });

  it("builds a point per located stop of an affected line", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            affectedLines: [
              {
                line: {
                  lineRef: "RUT:Line:81",
                  lineName: "81",
                  publicCode: "81",
                },
                stops: [affectedStop("NSR:Quay:7169", 59.91, 10.75)],
              },
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("lineStop");
    expect(pointFeatures[0].properties.entityId).toBe("NSR:Quay:7169");
  });

  it("collapses a stop repeated across many journeys of one situation", () => {
    const journey = (id: string) => ({
      serviceJourney: null,
      datedServiceJourney: { id },
      line: null,
      operator: null,
      stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
      affectedPointsOnLink: null,
    });

    const { pointFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [journey("A"), journey("B"), journey("C")],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
  });

  it("draws one dot for a stop reached as both a journey stop and a line stop", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              {
                serviceJourney: null,
                datedServiceJourney: { id: "A" },
                line: null,
                operator: null,
                stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
                affectedPointsOnLink: null,
              },
            ],
            affectedLines: [
              { line: null, stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)] },
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("still draws two coincident dots when two situations share a stop", () => {
    const one = (situationNumber: string) =>
      makeSituation({
        situationNumber,
        affects: {
          ...EMPTY,
          affectedLines: [
            { line: null, stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)] },
          ],
        },
      });

    const { pointFeatures } = buildSituationFeatures(
      [one("TST:SituationNumber:1"), one("TST:SituationNumber:2")],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(2);
  });

  it("draws a stop that is unlocated in one source and located in another", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            affectedLines: [
              {
                line: null,
                stops: [
                  {
                    stop: { id: "NSR:Quay:1", name: null, location: null },
                    stopConditions: [],
                  },
                ],
              },
            ],
            vehicleJourneys: [
              {
                serviceJourney: null,
                datedServiceJourney: { id: "A" },
                line: null,
                operator: null,
                stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
                affectedPointsOnLink: null,
              },
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("skips a stop the API could not locate, and reports the situation unmappable", () => {
    const { pointFeatures, unmappable } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            affectedLines: [
              {
                line: null,
                stops: [
                  {
                    stop: { id: "NSR:Quay:9", name: null, location: null },
                    stopConditions: [],
                  },
                ],
              },
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/domain/situationFeatures.test.ts
```

Expected: FAIL — the six new tests report 0 point features (the new fields are read by nothing yet). The pre-existing tests still pass.

- [ ] **Step 3: Widen the source union and read the new fields**

In `src/domain/situationFeatures.ts`, widen the `source` property:

```ts
  /** Which affects member produced this feature. */
  source:
    | "stopPoint"
    | "stopPlace"
    | "line"
    | "datedServiceJourney"
    | "journeyStop"
    | "lineStop";
```

Replace the `addStops` helper and the two calls to it with a version that keys deduplication on the stop id alone across every stop source. One situation, one stop, one dot — whichever source reached it first:

```ts
// Keyed on the stop id alone, not on source + id: the same stop reached as
// a journey stop and as a line stop is one stop, and two coincident markers
// for it would be noise. Measured on the dev feed, the four stop sources
// overlap on zero stops today, so this only guards against future data.
const addStop = (
  entry: StopRef,
  source: "stopPoint" | "stopPlace" | "journeyStop" | "lineStop",
) => {
  if (seen.has(entry.id)) return;

  const latitude = entry.location?.latitude;
  const longitude = entry.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  // Marked seen only after the coordinate check, so a stop that arrives
  // unlocated from one source and located from another is still drawn.
  seen.add(entry.id);

  pointFeatures.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [longitude as number, latitude as number],
    },
    properties: propertiesFor(situation, source, entry.id, entry.name ?? null),
  });
};

for (const stop of situation.affects?.stopPoints ?? [])
  addStop(stop, "stopPoint");
for (const stop of situation.affects?.stopPlaces ?? [])
  addStop(stop, "stopPlace");
for (const journey of situation.affects?.vehicleJourneys ?? []) {
  for (const entry of journey.stops ?? []) addStop(entry.stop, "journeyStop");
}
for (const affectedLine of situation.affects?.affectedLines ?? []) {
  for (const entry of affectedLine.stops ?? []) addStop(entry.stop, "lineStop");
}
```

The `seen` set is now shared between stops and the still-present line/journey branches. Those branches key `line:<ref>` and `datedServiceJourney:<id>`, which cannot collide with a stop id, so leave them exactly as they are.

Note the ordering: `seen` is marked only after the coordinate check, so a stop that arrives unlocated from one source and located from another is still drawn. Marking it earlier would let the first, useless copy suppress the usable one.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/domain/situationFeatures.test.ts
```

Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Run the full suite and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check
```

Expected: PASS.

```bash
git add src/domain/situationFeatures.ts src/domain/situationFeatures.test.ts
git commit -m "Map situations from the stops their journeys and lines name"
```

---

### Task 3: Build line features from `affectedPointsOnLink`

**Files:**

- Modify: `src/domain/situationFeatures.ts`
- Test: `src/domain/situationFeatures.test.ts`

**Interfaces:**

- Consumes: `AffectedVehicleJourney` from Task 1; `decodePolyline(encoded: string): number[][]` from `src/utils/decodePolyline.ts`, which returns `[longitude, latitude]` pairs ready for GeoJSON.
- Produces: `source` widened with `"affectedSpan"`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/situationFeatures.test.ts`. Reuses `EMPTY` and `affectedStop` from Task 2.

```ts
describe("affected spans", () => {
  // Verified against src/utils/decodePolyline.ts: decodes to
  // [[10, 63.00000000000001], [10.5, 63.400000000000006]] as
  // [longitude, latitude]. Assert on length, not on exact coordinates —
  // the encoding round-trips through 1e5 integers and loses the last bit.
  const POLYLINE = "_uo_K_c`|@_cmA_t`B";

  const journeyWithSpan = (
    overrides: Partial<AffectedVehicleJourney> = {},
  ): AffectedVehicleJourney => ({
    serviceJourney: null,
    datedServiceJourney: {
      id: "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02",
    },
    line: null,
    operator: null,
    stops: null,
    affectedPointsOnLink: { points: POLYLINE, length: 119 },
    ...overrides,
  });

  it("builds one line feature from the journey's own geometry", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures(
      [
        makeSituation({
          affects: { ...EMPTY, vehicleJourneys: [journeyWithSpan()] },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0].properties.source).toBe("affectedSpan");
    expect(lineFeatures[0].properties.entityId).toBe(
      "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02",
    );
    expect(lineFeatures[0].geometry.coordinates).toHaveLength(2);
    expect(unmappable).toEqual([]);
  });

  it("falls back to the service journey id when there is no dated id", () => {
    const { lineFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              journeyWithSpan({
                datedServiceJourney: null,
                serviceJourney: { id: "ATB:ServiceJourney:311_7010" },
              }),
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures[0].properties.entityId).toBe(
      "ATB:ServiceJourney:311_7010",
    );
  });

  it("names the span after its line when the feed supplies one", () => {
    const { lineFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              journeyWithSpan({
                line: {
                  lineRef: "RUT:Line:81",
                  lineName: "Grorud",
                  publicCode: "81",
                },
              }),
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures[0].properties.name).toBe("Grorud");
  });

  it("emits one feature for a journey listed twice in one situation", () => {
    const { lineFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [journeyWithSpan(), journeyWithSpan()],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures).toHaveLength(1);
  });

  it("emits no line for a journey the API gave no span", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [journeyWithSpan({ affectedPointsOnLink: null })],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("emits no line for a span that decodes to fewer than two points", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              journeyWithSpan({
                affectedPointsOnLink: { points: "_ic~Fdvca@", length: 0 },
              }),
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("still emits the stops of a journey whose span is missing", () => {
    const { pointFeatures, lineFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [
              journeyWithSpan({
                affectedPointsOnLink: null,
                stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
              }),
            ],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(lineFeatures).toEqual([]);
    expect(pointFeatures).toHaveLength(1);
  });
});
```

Add `AffectedVehicleJourney` to the type import at the top of the test file:

```ts
import { AffectedVehicleJourney, NationalSituation } from "../types.ts";
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/domain/situationFeatures.test.ts
```

Expected: FAIL — the span tests find no line features, because nothing reads `affectedPointsOnLink` yet.

- [ ] **Step 3: Widen the source union and emit spans**

In `src/domain/situationFeatures.ts`, add `"affectedSpan"` to the `source` union. Then add this loop inside the per-situation body, after the stop loops and alongside the existing line and journey loops:

```ts
// The feed's own geometry: the span between the first and last affected
// stop, or the whole route when the situation names no stops at all. The
// API withholds it rather than guess — one affected stop is a point, not a
// span — so a journey with no span here is not a gap to fill in.
for (const journey of situation.affects?.vehicleJourneys ?? []) {
  const points = journey.affectedPointsOnLink?.points;
  if (!points) continue;

  const journeyId =
    journey.datedServiceJourney?.id ?? journey.serviceJourney?.id;
  if (!journeyId) continue;

  const key = `affectedSpan:${journeyId}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const coordinates = decodePolyline(points);
  if (coordinates.length < 2) continue;

  lineFeatures.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: propertiesFor(
      situation,
      "affectedSpan",
      journeyId,
      journey.line?.lineName ?? null,
    ),
  });
}
```

Add the import at the top of the file:

```ts
import { decodePolyline } from "../utils/decodePolyline.ts";
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/domain/situationFeatures.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check
```

Expected: PASS.

```bash
git add src/domain/situationFeatures.ts src/domain/situationFeatures.test.ts
git commit -m "Draw the affected span a journey carries"
```

---

### Task 4: Retire the borrowed geometry

The new sources are in place, so the borrowed path can go. This is the task that loses 35 situations' whole-line shapes — the trade the spec argues for.

**Files:**

- Delete: `src/hooks/useSituationLineGeometry.ts`, `src/hooks/useSituationJourneyGeometry.ts`, `src/hooks/useBorrowedGeometry.ts`, `src/hooks/journeyBatch.ts`, `src/hooks/journeyBatch.test.ts`, `src/domain/journeyDate.ts`, `src/domain/journeyDate.test.ts`
- Modify: `src/domain/situationFeatures.ts`
- Modify: `src/domain/situationFeatures.test.ts`
- Modify: `src/situations/SituationsProvider.tsx` (~lines 71-116)

**Interfaces:**

- Consumes: the five feature sources from Tasks 2 and 3.
- Produces: `buildSituationFeatures(situations: NationalSituation[]): SituationFeatures` — one argument. `collectLineRefs`, `collectDatedServiceJourneyRefs` and `LineGeometryCache` cease to exist.

- [ ] **Step 1: Delete the modules**

```bash
git rm src/hooks/useSituationLineGeometry.ts src/hooks/useSituationJourneyGeometry.ts \
       src/hooks/useBorrowedGeometry.ts src/hooks/journeyBatch.ts src/hooks/journeyBatch.test.ts \
       src/domain/journeyDate.ts src/domain/journeyDate.test.ts
```

Do **not** delete `src/utils/decodePolyline.ts` — Task 3's spans decode through it.

- [ ] **Step 2: Reduce `buildSituationFeatures` to one argument**

In `src/domain/situationFeatures.ts`:

- Delete the `LineGeometryCache` type, the `EMPTY_GEOMETRY` constant, and the `collectDatedServiceJourneyRefs` and `collectLineRefs` functions.
- Narrow the `source` union to `"stopPoint" | "stopPlace" | "journeyStop" | "lineStop" | "affectedSpan"`.
- Change the signature to `export function buildSituationFeatures(situations: NationalSituation[]): SituationFeatures {`.
- Delete the two loops that read `lineGeometry` and `journeyGeometry` (the `affects?.lines` loop and the `affects?.datedServiceJourneys` loop). The span loop from Task 3 replaces both.

Replace the function's doc comment, which currently describes borrowing:

```ts
/**
 * Flattens each situation's `affects` into GeoJSON. Pure: every coordinate here
 * arrives with the feed, so no lookup, cache or network call is involved.
 *
 * Deduplication is **within** a situation only — points by stop id across all
 * four stop sources, spans by journey id. Two situations affecting the same stop
 * deliberately produce two coincident features; that overlap is the point of a
 * feed-debugging tool, and collapsing it would hide exactly the duplication
 * worth seeing.
 *
 * Nothing is averaged, invented, or given a synthetic centroid: a situation that
 * flattens to no features is reported in `unmappable` instead.
 */
```

- [ ] **Step 3: Strip the geometry arguments out of the tests**

In `src/domain/situationFeatures.test.ts`:

- Delete the `NO_GEOMETRY` constant and remove the second and third arguments from every `buildSituationFeatures(...)` call.
- Delete the whole `describe("collectDatedServiceJourneyRefs", ...)` block, the whole `describe("dated service journey features", ...)` block, and the `describe`/`it` covering `collectLineRefs` and borrowed line geometry (they assert `properties.source` values of `"line"` and `"datedServiceJourney"`, which no longer exist).
- Remove `collectDatedServiceJourneyRefs` and `collectLineRefs` from the import at the top.

- [ ] **Step 4: Cut the hooks out of the provider**

In `src/situations/SituationsProvider.tsx`, delete the `lineRefs` memo, the `useSituationLineGeometry` call, the `journeyIds` memo (with its `mayResolveJourney` comment) and the `useSituationJourneyGeometry` call, together with their four imports. Reduce the features memo to:

```tsx
const features = useMemo(() => buildSituationFeatures(filtered), [filtered]);
```

Leave the comment above that memo intact — it explains why the features are built over the filtered set, which is still true.

There is **no** mount-rationale comment in this file to correct — verified against the file and its full git history. The claim that the provider stays mounted because of the geometry cache lives only in `CLAUDE.md` (data-flow item 7, and the geography section), and Task 6 rewrites both. Do not add a new comment here.

- [ ] **Step 5: Verify nothing still references the deleted modules**

```bash
grep -rn "useBorrowedGeometry\|useSituationLineGeometry\|useSituationJourneyGeometry\|journeyBatch\|journeyDate\|mayResolveJourney\|LineGeometryCache\|collectLineRefs\|collectDatedServiceJourneyRefs" src scripts
```

Expected: no output.

- [ ] **Step 6: Run the full suite**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check && npm run lint
```

Expected: PASS. If `lint` reports an unused import in `SituationsProvider.tsx`, remove it and rerun.

- [ ] **Step 7: Confirm the app still draws situations**

```bash
npm run dev
```

Open the app, switch to situations mode, and confirm the map shows situation points and that the panel's "not on the map" list is much shorter than before. Stop the server when done. Do not claim this step passed without having looked.

- [ ] **Step 8: Commit**

```bash
git add -A src/domain/situationFeatures.ts src/domain/situationFeatures.test.ts src/situations/SituationsProvider.tsx src/hooks src/domain/journeyDate.ts src/domain/journeyDate.test.ts
git commit -m "Retire the borrowed geometry"
```

---

### Task 5: Drop the superseded affects fields

`lines`, `serviceJourneys` and `datedServiceJourneys` are restatements of the new fields — verified 944/944 on dev, and stated by the schema. `stopPoints` and `stopPlaces` are **not**, and stay.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/hooks/situationFragments.ts`
- Modify: `scripts/capture-situations-fixture.mjs`
- Modify: `src/domain/situationStats.ts` (`AFFECTS_KINDS`, ~line 10)
- Modify: `src/domain/situationStats.test.ts`
- Modify: `src/components/SituationsPanel/SituationDetail.tsx` (~lines 197-235)
- Modify: `src/domain/situationFeatures.test.ts` (affects literals)
- Regenerate: `src/__fixtures__/situations.json`

**Interfaces:**

- Consumes: everything from Tasks 1-4.
- Produces: an `Affects` of six fields — `vehicleModes`, `stopPoints`, `stopPlaces`, `operators`, `vehicleJourneys`, `affectedLines`.

- [ ] **Step 1: Narrow the type**

In `src/types.ts`, remove `lines`, `serviceJourneys` and `datedServiceJourneys` from `Affects`, and replace the doc comment above it — the current one says only `stopPoints` and `stopPlaces` carry coordinates, which is no longer true:

```ts
/**
 * What a situation claims to affect.
 *
 * `vehicleJourneys` and `affectedLines` supersede the flat `lines`,
 * `serviceJourneys` and `datedServiceJourneys` the feed also publishes: they name
 * the same journeys and lines, but pair each with the located stops it is
 * affected at, and a journey with an `affectedPointsOnLink` carries the span of
 * its route. `stopPoints` and `stopPlaces` are **not** superseded — measured on
 * dev, every situation carrying them names no journey and no line at all.
 */
export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  stopPoints: StopRef[] | null;
  stopPlaces: StopRef[] | null;
  operators: Operator[] | null;
  vehicleJourneys: AffectedVehicleJourney[] | null;
  affectedLines: AffectedLine[] | null;
};
```

Check whether `ServiceJourney` and `Line` are still imported/used elsewhere in `types.ts` before assuming either is now dead — `Line` certainly is, on `AffectedVehicleJourney` and `AffectedLine`.

- [ ] **Step 2: Narrow the fragment and the capture script**

In `src/hooks/situationFragments.ts`, delete these three lines from `SITUATION_QA_FIELDS_FRAGMENT`:

```graphql
      lines { lineRef lineName publicCode }
      serviceJourneys { id date }
      datedServiceJourneys { id }
```

Delete the same three lines from the `QUERY` in `scripts/capture-situations-fixture.mjs`, and update its `KINDS` array to match the new shape vocabulary:

```js
const KINDS = [
  "affectedLines",
  "vehicleJourneys",
  "stopPoints",
  "stopPlaces",
  "operators",
];
```

- [ ] **Step 3: Update the stats shape vocabulary**

In `src/domain/situationStats.ts`, replace `AFFECTS_KINDS`:

```ts
/** Fixed order, so a shape string is comparable across situations. */
const AFFECTS_KINDS = [
  "affectedLines",
  "vehicleJourneys",
  "stopPoints",
  "stopPlaces",
  "operators",
] as const;
```

- [ ] **Step 4: Update the affects fixtures in the tests**

`src/domain/situationStats.test.ts`: reduce `EMPTY_AFFECTS` to the six surviving keys, and rewrite the two `affectsShape` tests that name removed kinds:

```ts
const EMPTY_AFFECTS = {
  vehicleModes: null,
  stopPoints: null,
  stopPlaces: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};
```

```ts
it("names the single populated kind", () => {
  expect(
    affectsShape(
      makeSituation({
        affects: {
          ...EMPTY_AFFECTS,
          vehicleJourneys: [
            {
              serviceJourney: null,
              datedServiceJourney: { id: "x" },
              line: null,
              operator: null,
              stops: null,
              affectedPointsOnLink: null,
            },
          ],
        },
      }),
    ),
  ).toBe("vehicleJourneys");
});

it("joins several populated kinds in a fixed order", () => {
  expect(
    affectsShape(
      makeSituation({
        affects: {
          ...EMPTY_AFFECTS,
          operators: [{ operatorRef: "RUT:Operator:1", name: "Ruter" }],
          affectedLines: [
            {
              line: { lineRef: "L:1", lineName: "One", publicCode: "1" },
              stops: null,
            },
          ],
        },
      }),
    ),
  ).toBe("affectedLines+operators");
});
```

`src/domain/situationFeatures.test.ts`: remove the three dead keys from `EMPTY` and from every remaining affects literal.

- [ ] **Step 5: Run the type check to catch every remaining reference**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: FAIL, pointing at `SituationDetail.tsx`, which still reads `affects?.lines`, `affects?.serviceJourneys` and `affects?.datedServiceJourneys`. Step 6 fixes it.

- [ ] **Step 6: Rewrite the affects groups in the detail panel**

In `src/components/SituationsPanel/SituationDetail.tsx`, replace the six `AffectsGroup` elements with these five. `AffectsGroup` takes `label: string` and `entries: string[]` and renders nothing when `entries` is empty, so no conditionals are needed.

```tsx
        <AffectsGroup
          label="Lines"
          entries={(affects?.affectedLines ?? []).map((affectedLine) => {
            const line = affectedLine.line;
            const stops = affectedLine.stops?.length ?? 0;
            const name = `${line?.lineRef ?? "(no lineRef)"} ${line?.lineName ?? ""}`.trim();
            return stops ? `${name} — ${stops} stop(s)` : name;
          })}
        />
        <AffectsGroup
          label="Journeys"
          entries={(affects?.vehicleJourneys ?? []).map((journey) => {
            const id =
              journey.datedServiceJourney?.id ??
              journey.serviceJourney?.id ??
              "(no id)";
            const parts = [id];
            if (journey.line?.lineRef) parts.push(journey.line.lineRef);
            if (journey.operator?.operatorRef) parts.push(journey.operator.operatorRef);
            parts.push(`${journey.stops?.length ?? 0} stop(s)`);
            parts.push(journey.affectedPointsOnLink?.points ? "span" : "no span");
            return parts.join(" — ");
          })}
        />
        <AffectsGroup
          label="Affected stops"
          entries={[
            ...(affects?.vehicleJourneys ?? []).flatMap((journey) => journey.stops ?? []),
            ...(affects?.affectedLines ?? []).flatMap((affectedLine) => affectedLine.stops ?? []),
          ].map((entry) => {
            const conditions = entry.stopConditions.join(", ");
            const name = `${entry.stop.id} ${entry.stop.name ?? ""}`.trim();
            return conditions ? `${name} [${conditions}]` : name;
          })}
        />
        <AffectsGroup
          label="Stop points"
          entries={(affects?.stopPoints ?? []).map((stop) =>
            `${stop.id} ${stop.name ?? ""}`.trim(),
          )}
        />
        <AffectsGroup
          label="Stop places"
          entries={(affects?.stopPlaces ?? []).map((stop) =>
            `${stop.id} ${stop.name ?? ""}`.trim(),
          )}
        />
        <AffectsGroup
          label="Operators"
          entries={(affects?.operators ?? []).map((operator) =>
            `${operator.operatorRef} ${operator.name ?? ""}`.trim(),
          )}
        />
```

This panel deliberately does not deduplicate. It is the raw dump, and a stop repeated across nine journeys of one situation is exactly what a reader here needs to see — the map is where that collapses to one dot.

- [ ] **Step 7: Recapture the fixture against the narrowed query**

```bash
npm run capture-fixtures
```

Then confirm the removed fields are actually gone and the kept ones remain:

```bash
grep -c "datedServiceJourneys\|serviceJourneys" src/__fixtures__/situations.json
grep -c "stopPoints" src/__fixtures__/situations.json
```

Expected: the first is 0, the second is greater than 0.

- [ ] **Step 8: Run the full suite**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check && npm run lint
```

Expected: PASS.

- [ ] **Step 9: Confirm the detail panel renders**

```bash
npm run dev
```

Switch to situations mode, select a situation on the map, and read the detail drawer: the Journeys group should list ids with stop counts and a span / no span marker, and Affected stops should show `[destination]` on many entries. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/hooks/situationFragments.ts scripts/capture-situations-fixture.mjs src/domain/situationStats.ts src/domain/situationStats.test.ts src/domain/situationFeatures.test.ts src/components/SituationsPanel/SituationDetail.tsx src/__fixtures__/situations.json
git commit -m "Drop the affects fields the new ones supersede"
```

---

### Task 6: Update CLAUDE.md

The repo's own guidance is now wrong in several places, and the next reader will trust it.

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: the finished behaviour from Tasks 1-5.
- Produces: nothing code-facing.

- [ ] **Step 1: Replace the "Situations carry almost no geography" section**

Replace that whole section — heading and all its bullets — with:

```markdown
## Situations carry their own geography

The situations feed serves the coordinates it needs. `Affects.vehicleJourneys`
and `Affects.affectedLines` pair each affected journey and line with the
**located** stops it is affected at, and a journey may carry
`affectedPointsOnLink`: the span of its route between the first and last
affected stop, or — when the situation names no stops, meaning the journey is
affected as a whole — the entire route. An empty `stops` list is what tells
those two cases apart.

Measured on dev (944 situations): 845 map, 99 do not. Spans stay rare, 46 of
9,232 journey entries, and the API explains why rather than guessing: it
withholds a span when the journey has no pattern geometry (718 entries), when
exactly one stop is affected — a point is not a span (3,610 entries), or when
any affected stop cannot be located on the route. **Do not "fix" that by
interpolating between stops or falling back to Journey Planner.** A synthetic
line drawn over the wrong part of a route is worse than an honest absence in a
data-QA tool, which is the same reason the API declines to draw it.

`stopPoints` and `stopPlaces` are **not** superseded by the new fields and must
stay selected: measured, every situation carrying them names no journey and no
line at all, so dropping them silently unmaps 20 situations.

There was formerly an apparatus that borrowed geometry per ref from elsewhere
in the same API — a running vehicle's `pointsOnLink` for a line, the planned
`datedServiceJourneys`/`serviceJourneys` roots for a journey — cached for the
session. It is gone. It resolved 33 of 90 line refs and 78 of 4,591 journey
ids, and what it drew for a line was that line's _whole_ shape regardless of
how little of it was affected. Its removal cost 35 situations their geometry
and is not a regression to restore.

`pointsOnLink` on `ServiceJourney` is hidden from introspection, exactly like
`situations`; do not conclude from an introspection dump that it is gone.
```

- [ ] **Step 2: Correct the data-flow and invariant references**

Search for and fix each of these, which the change has falsified:

```bash
grep -n "borrowed\|useBorrowedGeometry\|journeyBatch\|mayResolveJourney\|journeyDate\|stopPoints\|SituationQaFields\|does not select today" CLAUDE.md
```

- The bullet in **Data flow** item 7 saying `SituationsProvider` stays mounted because of the geometry cache: the cache is gone, so give the real current reason — it stays mounted, subscription paused, and unmounting would be a separate change.
- The `SituationQaFields` invariant describing the old selection set.
- The sentence claiming `Affects.stopPoints` and `Affects.stopPlaces` are the only coordinate-bearing fields.
- The remark that the feed populates `Affects.serviceJourneys` "which the `SituationQaFields` fragment does not select today" — `serviceJourneys` is no longer selected at all, and `vehicleJourneys` covers it.

- [ ] **Step 3: Add an invariant for the dedup rule**

Add to the "Key invariants worth preserving" list, near the existing situation-features bullet:

```markdown
- Situation **point features deduplicate on stop id alone** within a situation,
  across all four stop sources (`stopPoints`, `stopPlaces`,
  `vehicleJourneys[].stops`, `affectedLines[].stops`). One situation, one stop,
  one dot. Spans deduplicate separately, on journey id. Dedup remains **within**
  a situation only — two situations affecting one stop still produce two
  coincident features, which is the duplication this tool exists to expose.
```

- [ ] **Step 4: Verify the file is consistent and formatted**

```bash
grep -rn "useSituationLineGeometry\|useSituationJourneyGeometry\|useBorrowedGeometry\|journeyBatch\|journeyDate\|mayResolveJourney" CLAUDE.md
```

Expected: no output except inside the "There was formerly an apparatus" paragraph, which names none of them.

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the feed's own geography"
```
