# Situations Map & Data-QA Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a situations data-QA panel to the right menu of `vehicle-map-demo`, fed by the vehicle-positions API's `situations` subscription, with a secondary map presence for the minority of situations that can be placed geographically.

**Architecture:** A `SituationsProvider` above `<MapView>` owns the subscription, the client-side filter, and the selection. Everything computed from that data lives in pure, unit-tested modules under `src/domain/`. Two consumers read the context: `SituationLayers` (inside `<Map>`, pushes GeoJSON into pre-declared sources) and `SituationsPanel` (inside the existing right-menu drawer).

**Tech Stack:** React 19, TypeScript, Vite, `graphql-ws`, `graphql-request`, `react-map-gl/maplibre`, MUI v9, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-situations-map-design.md`

## Global Constraints

- ESM only. Every local import carries an explicit `.ts` / `.tsx` extension.
- Component files must not export non-component values (`react-refresh/only-export-components`). Context objects, hooks, and helpers go in separate `.ts` files.
- `vitest.config.ts` is `environment: "node"` with `include: ["src/**/*.test.ts"]`. `.tsx` is **not** collected — all testable logic must live in plain `.ts` modules.
- **No new `bootstrap.json` key.** The situations subscription reuses `vehicle-positions-subscriptions-endpoint`.
- The existing `Situation` type in `src/types.ts` and the existing `SituationFields` GraphQL fragment must not change shape. They are consumed by `useTimetableSubscription` and the invariant is documented in `CLAUDE.md`.
- The subscription is opened **unfiltered**. All narrowing happens client-side.
- Facet counts and stats are computed over the **unfiltered** set, so they stay stable as the user narrows.
- No deduplication across situations. Within a single situation, deduplicate by stop id and by line ref. A stop affected by three situations yields three coincident features — that is required behaviour for a feed-debugging tool.
- Untagged text is never defaulted to Norwegian and never hidden. It renders with an explicit `untagged` tag.
- Severity `"undefined"` is the literal string on 280 of 581 live situations and represents real incident messages. It renders in the same orange as `normal`. Only `noImpact` is greyed.
- Report type is **uppercase** in this API (`INCIDENT`, `GENERAL`), unlike Journey Planner.
- Gates: `npm test` and `npm run check` must pass. `npm run build` must typecheck. `npm run lint` has 19 pre-existing problems — do not increase that count.
- Every commit message ends with `Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y`.

## Amendment to the spec

The spec says a selected situation highlights live vehicles "matched by `lineRef` or by `datedServiceJourney.id`". **This plan matches on `lineRef` only.** Reason: `VehicleUpdate` does not carry `datedServiceJourney`, and adding it to the main vehicle subscription costs roughly 45 bytes per vehicle on every streamed frame (5000+ vehicles nationally) to gain 10 additional matching situations — 154 by lineRef alone versus 164 with both. The cost is not proportionate. This is a deliberate, measured deviation, not an oversight.

---

## File Structure

**Modified:**

- `src/types.ts` — add `Affects`, `NationalSituation`, `SituationProgress`
- `src/hooks/useTimetableSubscription.ts` — import the extracted fragment instead of defining it
- `src/components/SelectedVehiclePanel/situationSeverity.ts` — export the three colour constants
- `src/components/mapStyle.ts` — three GeoJSON sources and three layers
- `src/components/App.tsx` — wrap `<MapView>` in `<SituationsProvider>`
- `src/components/MapView.tsx` — render `<SituationLayers>` inside `<Map>`
- `src/components/RightMenu/types.ts` — add `"situations"` to `RightContentType`
- `src/components/RightMenu/RightMenuButtons.tsx` — the fifth button
- `src/components/RightMenu/DrawerContent.tsx` — the fifth branch
- `package.json` — `capture-fixtures` script
- `CLAUDE.md` — data flow and invariants

**Created:**

- `scripts/capture-situations-fixture.mjs` — refreshes the committed fixture from dev
- `src/__fixtures__/situations.json` — representative real subset
- `src/__fixtures__/makeSituation.ts` — hand-written fixture builder for unit tests
- `src/hooks/situationFragments.ts` — the two GraphQL fragments, shared
- `src/hooks/useSituationsSubscription.ts` — the feed
- `src/hooks/useSituationLineGeometry.ts` — borrowed line geometry, cached
- `src/domain/situationFlags.ts` + `.test.ts` — the three lifecycle flags
- `src/domain/situationFeatures.ts` + `.test.ts` — affects → GeoJSON, unmappable list
- `src/domain/situationStats.ts` + `.test.ts` — count-by tables
- `src/domain/situationFilter.ts` + `.test.ts` — client-side narrowing and facet counts
- `src/situations/SituationsContext.ts` — context object and `useSituations()`
- `src/situations/SituationsProvider.tsx` — the provider component
- `src/components/SituationLayers.tsx` — pushes GeoJSON into the map sources
- `src/components/SituationsPanel/SituationsPanel.tsx` — drawer section shell and status
- `src/components/SituationsPanel/SituationStatsTables.tsx` — the count-by readouts
- `src/components/SituationsPanel/SituationFilters.tsx` — facet checkboxes
- `src/components/SituationsPanel/SituationRow.tsx` — one row in the list
- `src/components/SituationsPanel/SituationDetail.tsx` — raw per-situation detail
- `src/components/SituationsPanel/UnmappableList.tsx` — situations with no map presence
- `src/components/SituationsPanel/index.ts` — barrel

---

### Task 1: Types, shared fragments, and fixtures

**Files:**

- Modify: `src/types.ts`
- Create: `src/hooks/situationFragments.ts`
- Modify: `src/hooks/useTimetableSubscription.ts:10-22`
- Create: `scripts/capture-situations-fixture.mjs`
- Create: `src/__fixtures__/situations.json`
- Create: `src/__fixtures__/makeSituation.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `Affects`, `NationalSituation`, `SituationProgress` in `src/types.ts`; `SITUATION_FIELDS_FRAGMENT` and `SITUATION_QA_FIELDS_FRAGMENT` in `src/hooks/situationFragments.ts`; `makeSituation(overrides: Partial<NationalSituation>): NationalSituation` in `src/__fixtures__/makeSituation.ts`.

- [ ] **Step 1: Extract the existing fragment into a shared module**

Create `src/hooks/situationFragments.ts`. `SITUATION_FIELDS_FRAGMENT` must be **byte-identical** in its selection set to the one currently inline in `useTimetableSubscription.ts` — this is the invariant that keeps the timetable's two spread sites in sync.

```ts
/**
 * The selection set behind the `Situation` type, split in two.
 *
 * `SituationFields` is what the timetable subscription selects at both the
 * trip and the call level; it must not grow without a matching change to
 * `Situation` in types.ts.
 *
 * `SituationQaFields` is the extra metadata only the national situations feed
 * needs. Both fragments target the same GraphQL type, so the situations
 * subscription spreads them side by side.
 */
export const SITUATION_FIELDS_FRAGMENT = `
  fragment SituationFields on Situation {
    situationNumber
    version
    severity
    reportType
    summary { value language }
    description { value language }
    advice { value language }
    validityPeriods { startTime endTime }
    infoLinks { uri labels { value language } }
  }
`;

export const SITUATION_QA_FIELDS_FRAGMENT = `
  fragment SituationQaFields on Situation {
    participantRef
    codespace { codespaceId }
    sourceType
    progress
    priority
    planned
    creationTime
    versionedAtTime
    lastUpdated
    expiration
    openEnded
    age
    affects {
      vehicleModes
      lines { lineRef lineName publicCode }
      stopPoints { id name location { latitude longitude } }
      stopPlaces { id name location { latitude longitude } }
      serviceJourneys { id date }
      datedServiceJourneys { id }
      operators { operatorRef name }
    }
  }
`;
```

- [ ] **Step 2: Point the timetable subscription at the shared fragment**

In `src/hooks/useTimetableSubscription.ts`, delete the local `situationFieldsFragment` const and import instead:

```ts
import { SITUATION_FIELDS_FRAGMENT } from "./situationFragments.ts";
```

and replace the interpolation at the top of `subscriptionQuery`:

```ts
const subscriptionQuery = `
  ${SITUATION_FIELDS_FRAGMENT}

  subscription($serviceJourneyId: String!, $date: String!) {
```

Nothing else in that file changes.

- [ ] **Step 3: Add the types**

Append to `src/types.ts`, after the existing `Situation` type:

```ts
export type SituationProgress =
  | "draft"
  | "pendingApproval"
  | "approvedDraft"
  | "open"
  | "published"
  | "closing"
  | "closed";

/**
 * What a situation claims to affect.
 *
 * Only `stopPoints` and `stopPlaces` carry coordinates — `Line` exposes no
 * geometry at all, and the service-journey IDs here are in a different
 * namespace from the realtime feed's, so they resolve to nothing. See the
 * design spec for the measurements behind that.
 */
export type AffectedStop = {
  id: string;
  name: string | null;
  location: { latitude: number; longitude: number } | null;
};

export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  lines: Line[] | null;
  stopPoints: AffectedStop[] | null;
  stopPlaces: AffectedStop[] | null;
  serviceJourneys: ServiceJourney[] | null;
  datedServiceJourneys: { id: string }[] | null;
  operators: Operator[] | null;
};

/**
 * A situation from the national `situations` feed, as opposed to the trimmed
 * `Situation` the timetable subscription selects. Every field here comes from
 * the `SituationQaFields` fragment.
 */
export type NationalSituation = Situation & {
  participantRef: string | null;
  codespace: Codespace | null;
  sourceType: string | null;
  progress: SituationProgress | null;
  priority: number | null;
  planned: boolean | null;
  creationTime: string | null;
  versionedAtTime: string | null;
  lastUpdated: string | null;
  expiration: string | null;
  openEnded: boolean | null;
  age: string | null;
  affects: Affects | null;
};
```

`Line`, `Codespace`, `Operator`, `ServiceJourney` and `VehicleModeEnumeration` already exist in `src/types.ts` — reuse them, do not redeclare.

`AffectedStop` is deliberately **not** the existing `Stop`. `Stop` types `name` and `location` as non-nullable and is consumed by the timetable's `Call`; widening it to accommodate a coordinate-less affects entry would ripple into code that has never needed the null check. All 68 affected stops in the live feed do carry coordinates, but the wire allows their absence and the feature builder must be able to say so.

- [ ] **Step 4: Write the fixture capture script**

Create `scripts/capture-situations-fixture.mjs`. It keeps up to three situations per affects shape plus the one with the largest fan-out, so the fixture stays a few hundred KB rather than 1.5 MB while still covering every real shape.

```js
// Refreshes src/__fixtures__/situations.json from the dev API.
// Run with: npm run capture-fixtures
import { writeFileSync } from "node:fs";

const ENDPOINT = "https://api.dev.entur.io/realtime/v2/vehicles/graphql";
const CLIENT_NAME = "entur-vehicle-map-demo-dev";
const PER_SHAPE = 3;

const QUERY = `
  {
    situations {
      situationNumber version severity reportType
      summary { value language }
      description { value language }
      advice { value language }
      validityPeriods { startTime endTime }
      infoLinks { uri labels { value language } }
      participantRef codespace { codespaceId } sourceType progress priority
      planned creationTime versionedAtTime lastUpdated expiration openEnded age
      affects {
        vehicleModes
        lines { lineRef lineName publicCode }
        stopPoints { id name location { latitude longitude } }
        stopPlaces { id name location { latitude longitude } }
        serviceJourneys { id date }
        datedServiceJourneys { id }
        operators { operatorRef name }
      }
    }
  }
`;

const KINDS = [
  "lines",
  "stopPoints",
  "stopPlaces",
  "serviceJourneys",
  "datedServiceJourneys",
  "operators",
];

const shapeOf = (situation) => {
  const affects = situation.affects ?? {};
  const present = KINDS.filter((kind) => (affects[kind] ?? []).length > 0);
  return present.length ? present.join("+") : "(empty)";
};

const fanOutOf = (situation) => {
  const affects = situation.affects ?? {};
  return KINDS.reduce((total, kind) => total + (affects[kind] ?? []).length, 0);
};

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "ET-Client-Name": CLIENT_NAME,
  },
  body: JSON.stringify({ query: QUERY }),
});

const body = await response.json();
if (body.errors) {
  console.error(JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

const all = body.data.situations;
const perShape = new Map();
for (const situation of all) {
  const shape = shapeOf(situation);
  const bucket = perShape.get(shape) ?? [];
  if (bucket.length < PER_SHAPE) bucket.push(situation);
  perShape.set(shape, bucket);
}

const picked = [...perShape.values()].flat();
const widest = all.reduce((a, b) => (fanOutOf(a) >= fanOutOf(b) ? a : b));
if (!picked.some((s) => s.situationNumber === widest.situationNumber)) {
  picked.push(widest);
}

writeFileSync(
  new URL("../src/__fixtures__/situations.json", import.meta.url),
  JSON.stringify({ situations: picked }, null, 2) + "\n",
);

console.log(
  `captured ${picked.length} of ${all.length} situations; shapes: ${[...perShape.keys()].join(", ")}`,
);
```

Add to `package.json` scripts, after `"test"`:

```json
"capture-fixtures": "node scripts/capture-situations-fixture.mjs",
```

The fixture is imported by a test in Task 3, so `tsconfig.app.json` needs JSON imports enabled. It is not on by default with `"module": "ESNext"`. Add one line to `compilerOptions`, after `"noEmit": true`:

```json
    "resolveJsonModule": true,
```

- [ ] **Step 5: Run the capture**

Run: `npm run capture-fixtures`

Expected: a line reporting roughly 20 captured situations, and shapes including at least `datedServiceJourneys`, `lines`, `stopPoints`, `lines+serviceJourneys`, `serviceJourneys` and `(empty)`.

If the network is unavailable, stop and report `BLOCKED` — do not hand-write this file, its whole value is that it is real.

- [ ] **Step 6: Write the unit-test fixture builder**

Create `src/__fixtures__/makeSituation.ts`. This is what the `src/domain/` tests use; it is deterministic, unlike the captured JSON.

```ts
import { NationalSituation } from "../types.ts";

const BASE: NationalSituation = {
  situationNumber: "TST:SituationNumber:1",
  version: 1,
  severity: "normal",
  reportType: "INCIDENT",
  summary: [{ value: "Summary", language: "NO" }],
  description: [],
  advice: [],
  validityPeriods: [
    { startTime: "2026-08-01T00:00:00Z", endTime: "2026-09-01T00:00:00Z" },
  ],
  infoLinks: [],
  participantRef: "TST",
  codespace: { codespaceId: "TST" },
  sourceType: "DIRECT_REPORT",
  progress: "open",
  priority: 5,
  planned: null,
  creationTime: "2026-08-01T00:00:00Z",
  versionedAtTime: null,
  lastUpdated: "2026-08-01T00:00:00Z",
  expiration: null,
  openEnded: false,
  age: "PT24H",
  affects: null,
};

/** A situation with sensible defaults, so each test states only what it cares about. */
export function makeSituation(
  overrides: Partial<NationalSituation> = {},
): NationalSituation {
  return { ...BASE, ...overrides };
}
```

- [ ] **Step 7: Verify nothing regressed**

Run: `npm test`
Expected: PASS, 38 tests — the same count as before this task. The fragment extraction must not change any behaviour.

Run: `npm run build`
Expected: clean typecheck and build.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/hooks/situationFragments.ts src/hooks/useTimetableSubscription.ts \
        scripts/capture-situations-fixture.mjs src/__fixtures__ package.json
git commit -m "Add national situation types and share the SituationFields fragment

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 2: Lifecycle quality flags

**Files:**

- Create: `src/domain/situationFlags.ts`
- Create: `src/domain/situationFlags.test.ts`

**Interfaces:**

- Consumes: `NationalSituation` from `src/types.ts`; `makeSituation` from `src/__fixtures__/makeSituation.ts`.
- Produces: `SituationFlag`, `FlagLevel`, `FLAG_LEVEL`, `STALE_OPEN_ENDED_DAYS`, `situationFlags(situation: NationalSituation, now: number): SituationFlag[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/situationFlags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import {
  FLAG_LEVEL,
  STALE_OPEN_ENDED_DAYS,
  situationFlags,
} from "./situationFlags.ts";

const NOW = Date.parse("2026-08-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) =>
  new Date(NOW + offsetDays * DAY).toISOString();

describe("situationFlags", () => {
  it("flags a period with no end time as noEndTime", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: null }],
    });
    expect(situationFlags(situation, NOW)).toContain("noEndTime");
  });

  it("does not flag noEndTime when every period has an end time", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: iso(10) }],
    });
    expect(situationFlags(situation, NOW)).not.toContain("noEndTime");
  });

  it("flags noEndTime when only one of several periods lacks an end time", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(-10), endTime: iso(-5) },
        { startTime: iso(-4), endTime: null },
      ],
    });
    expect(situationFlags(situation, NOW)).toContain("noEndTime");
  });

  it("flags staleOpenEnded just past the threshold", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: null }],
      creationTime: iso(-(STALE_OPEN_ENDED_DAYS + 1)),
    });
    expect(situationFlags(situation, NOW)).toContain("staleOpenEnded");
  });

  it("does not flag staleOpenEnded just inside the threshold", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: null }],
      creationTime: iso(-(STALE_OPEN_ENDED_DAYS - 1)),
    });
    expect(situationFlags(situation, NOW)).not.toContain("staleOpenEnded");
  });

  it("does not flag staleOpenEnded when the situation has an end time", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: iso(10) }],
      creationTime: iso(-500),
    });
    expect(situationFlags(situation, NOW)).not.toContain("staleOpenEnded");
  });

  it("never flags staleOpenEnded without a creationTime", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: null }],
      creationTime: null,
    });
    const flags = situationFlags(situation, NOW);
    expect(flags).toContain("noEndTime");
    expect(flags).not.toContain("staleOpenEnded");
  });

  it("flags notYetActive when every period starts in the future", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(3), endTime: iso(5) },
        { startTime: iso(7), endTime: iso(9) },
      ],
    });
    expect(situationFlags(situation, NOW)).toContain("notYetActive");
  });

  it("does not flag notYetActive when any period has already started", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(-1), endTime: iso(5) },
        { startTime: iso(7), endTime: iso(9) },
      ],
    });
    expect(situationFlags(situation, NOW)).not.toContain("notYetActive");
  });

  it("flags nothing when there are no validity periods", () => {
    expect(situationFlags(makeSituation({ validityPeriods: [] }), NOW)).toEqual(
      [],
    );
  });

  it("rates staleOpenEnded a warning and the other two info", () => {
    expect(FLAG_LEVEL.staleOpenEnded).toBe("warning");
    expect(FLAG_LEVEL.noEndTime).toBe("info");
    expect(FLAG_LEVEL.notYetActive).toBe("info");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/situationFlags.test.ts`
Expected: FAIL — cannot resolve `./situationFlags.ts`.

- [ ] **Step 3: Implement**

Create `src/domain/situationFlags.ts`:

```ts
import { NationalSituation } from "../types.ts";

export type SituationFlag = "noEndTime" | "staleOpenEnded" | "notYetActive";

export type FlagLevel = "info" | "warning";

/**
 * A single time-related field is never a warning on its own — an open-ended or
 * not-yet-started validity period is a normal state for a served situation.
 * `staleOpenEnded` is a warning precisely because it is a conjunction: published
 * without an end, and then never retired.
 */
export const FLAG_LEVEL: Record<SituationFlag, FlagLevel> = {
  noEndTime: "info",
  staleOpenEnded: "warning",
  notYetActive: "info",
};

export const STALE_OPEN_ENDED_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function timestamp(iso: string | null): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

/**
 * The three lifecycle flags, computed for one situation against a caller-supplied
 * `now` so the result is deterministic and testable.
 *
 * `noEndTime` fires when *any* period lacks an end time. On the live feed no
 * situation carries more than one period, so this currently coincides exactly
 * with the server's own `openEnded` field — but the two are computed
 * independently and a multi-period situation would separate them.
 */
export function situationFlags(
  situation: NationalSituation,
  now: number,
): SituationFlag[] {
  const periods = situation.validityPeriods ?? [];
  if (periods.length === 0) return [];

  const flags: SituationFlag[] = [];

  const noEndTime = periods.some((period) => !period.endTime);
  if (noEndTime) flags.push("noEndTime");

  const created = timestamp(situation.creationTime);
  if (
    noEndTime &&
    created !== null &&
    now - created > STALE_OPEN_ENDED_DAYS * DAY_MS
  ) {
    flags.push("staleOpenEnded");
  }

  const starts = periods.map((period) => timestamp(period.startTime));
  if (starts.every((start) => start !== null && start > now)) {
    flags.push("notYetActive");
  }

  return flags;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/situationFlags.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/situationFlags.ts src/domain/situationFlags.test.ts
git commit -m "Add lifecycle quality flags for situations

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 3: Situation features and the unmappable list

**Files:**

- Create: `src/domain/situationFeatures.ts`
- Create: `src/domain/situationFeatures.test.ts`

**Interfaces:**

- Consumes: `NationalSituation` from `src/types.ts`; `makeSituation`; `src/__fixtures__/situations.json`.
- Produces: `SituationFeatureProperties`, `SituationPointFeature`, `SituationLineFeature`, `LineGeometryCache`, `SituationFeatures`, `buildSituationFeatures(situations, lineGeometry)`, `collectLineRefs(situations)`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/situationFeatures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import fixture from "../__fixtures__/situations.json";
import { NationalSituation } from "../types.ts";
import {
  buildSituationFeatures,
  collectLineRefs,
} from "./situationFeatures.ts";

const NO_GEOMETRY = new Map<string, number[][]>();

const stop = (id: string, latitude: number, longitude: number) => ({
  id,
  name: id,
  location: { latitude, longitude },
});

describe("buildSituationFeatures", () => {
  it("builds one point per affected stop", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures[0].geometry.coordinates).toEqual([10, 60]);
    expect(pointFeatures[0].properties.situationNumber).toBe(
      "TST:SituationNumber:1",
    );
    expect(unmappable).toEqual([]);
  });

  it("deduplicates a repeated stop within one situation", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:1", 60, 10)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
    ];

    expect(
      buildSituationFeatures(situations, NO_GEOMETRY).pointFeatures,
    ).toHaveLength(1);
  });

  it("keeps coincident features from different situations", () => {
    const affects = {
      vehicleModes: null,
      lines: null,
      stopPoints: [stop("NSR:Quay:1", 60, 10)],
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: null,
      operators: null,
    };
    const situations = [
      makeSituation({ situationNumber: "A", affects }),
      makeSituation({ situationNumber: "B", affects }),
    ];

    const { pointFeatures } = buildSituationFeatures(situations, NO_GEOMETRY);
    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures.map((f) => f.properties.situationNumber)).toEqual([
      "A",
      "B",
    ]);
  });

  it("skips a stop with no coordinates rather than inventing one", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: null,
          stopPoints: [{ id: "NSR:Quay:9", name: "Nowhere", location: null }],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("builds a line feature from cached geometry", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: [
            { lineRef: "SKY:Line:3", lineName: "Three", publicCode: "3" },
          ],
          stopPoints: null,
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
    ];
    const geometry = new Map([
      [
        "SKY:Line:3",
        [
          [10, 60],
          [11, 61],
        ],
      ],
    ]);

    const { lineFeatures, unmappable } = buildSituationFeatures(
      situations,
      geometry,
    );

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0].geometry.coordinates).toEqual([
      [10, 60],
      [11, 61],
    ]);
    expect(lineFeatures[0].properties.entityId).toBe("SKY:Line:3");
    expect(unmappable).toEqual([]);
  });

  it("reports a line with no cached geometry as unmappable", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: [
            { lineRef: "SKY:Line:3", lineName: "Three", publicCode: "3" },
          ],
          stopPoints: null,
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
    ];

    const { lineFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("reports a situation with no affects at all as unmappable", () => {
    const { unmappable } = buildSituationFeatures(
      [makeSituation({ affects: null })],
      NO_GEOMETRY,
    );
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("counts features per situation", () => {
    const situations = [
      makeSituation({
        situationNumber: "A",
        affects: {
          vehicleModes: null,
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
        },
      }),
      makeSituation({ situationNumber: "B", affects: null }),
    ];

    const { featureCountBySituation } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(featureCountBySituation.get("A")).toBe(2);
    expect(featureCountBySituation.get("B")).toBe(0);
  });
});

describe("collectLineRefs", () => {
  it("returns each affected line ref once", () => {
    const line = (lineRef: string) => ({
      lineRef,
      lineName: lineRef,
      publicCode: "x",
    });
    const affects = (lines: ReturnType<typeof line>[]) => ({
      vehicleModes: null,
      lines,
      stopPoints: null,
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: null,
      operators: null,
    });

    const refs = collectLineRefs([
      makeSituation({
        situationNumber: "A",
        affects: affects([line("L:1"), line("L:2")]),
      }),
      makeSituation({ situationNumber: "B", affects: affects([line("L:2")]) }),
    ]);

    expect(refs).toEqual(["L:1", "L:2"]);
  });
});

describe("against the captured dev fixture", () => {
  const situations = (fixture as { situations: NationalSituation[] })
    .situations;

  it("captured a usable spread of situations", () => {
    expect(situations.length).toBeGreaterThan(5);
  });

  it("accounts for every situation as either mapped or unmappable", () => {
    const { featureCountBySituation, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );

    for (const situation of situations) {
      const count = featureCountBySituation.get(situation.situationNumber) ?? 0;
      expect(count === 0).toBe(unmappable.includes(situation.situationNumber));
    }
  });

  it("never emits a feature with a non-finite coordinate", () => {
    const { pointFeatures, lineFeatures } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    const coordinates = [
      ...pointFeatures.map((f) => f.geometry.coordinates),
      ...lineFeatures.flatMap((f) => f.geometry.coordinates),
    ];
    for (const [longitude, latitude] of coordinates) {
      expect(Number.isFinite(longitude)).toBe(true);
      expect(Number.isFinite(latitude)).toBe(true);
    }
  });
});
```

The JSON import relies on `resolveJsonModule`, added to `tsconfig.app.json` in Task 1. TypeScript infers a very wide structural type from the file's actual contents, so the `as { situations: NationalSituation[] }` cast above is doing real work — do not drop it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/situationFeatures.test.ts`
Expected: FAIL — cannot resolve `./situationFeatures.ts`.

- [ ] **Step 3: Implement**

Create `src/domain/situationFeatures.ts`:

```ts
import type { Feature, LineString, Point } from "geojson";
import {
  AffectedStop,
  NationalSituation,
  SeverityEnumeration,
} from "../types.ts";

export type SituationFeatureProperties = {
  situationNumber: string;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  codespaceId: string | null;
  /** Which affects member produced this feature. */
  source: "stopPoint" | "stopPlace" | "line";
  /** The stop id or line ref the feature was built from. */
  entityId: string;
  name: string | null;
};

export type SituationPointFeature = Feature<Point, SituationFeatureProperties>;
export type SituationLineFeature = Feature<
  LineString,
  SituationFeatureProperties
>;

/** Line ref → decoded `[longitude, latitude]` pairs. An empty array means "looked up, none available". */
export type LineGeometryCache = ReadonlyMap<string, number[][]>;

export type SituationFeatures = {
  pointFeatures: SituationPointFeature[];
  lineFeatures: SituationLineFeature[];
  featureCountBySituation: Map<string, number>;
  /** Situation numbers that produced no features at all, in input order. */
  unmappable: string[];
};

/** Every distinct line ref mentioned by any of these situations, in first-seen order. */
export function collectLineRefs(situations: NationalSituation[]): string[] {
  const refs = new Set<string>();
  for (const situation of situations) {
    for (const line of situation.affects?.lines ?? []) {
      if (line.lineRef) refs.add(line.lineRef);
    }
  }
  return [...refs];
}

function propertiesFor(
  situation: NationalSituation,
  source: SituationFeatureProperties["source"],
  entityId: string,
  name: string | null,
): SituationFeatureProperties {
  return {
    situationNumber: situation.situationNumber,
    severity: situation.severity,
    reportType: situation.reportType,
    codespaceId: situation.codespace?.codespaceId ?? null,
    source,
    entityId,
    name,
  };
}

/**
 * Flattens each situation's `affects` into GeoJSON.
 *
 * Deduplication is **within** a situation only, keyed by stop id and line ref.
 * Two situations affecting the same stop deliberately produce two coincident
 * features — that overlap is the point of a feed-debugging tool, and collapsing
 * it would hide exactly the duplication worth seeing.
 *
 * Nothing is averaged, invented, or given a synthetic centroid: a situation that
 * flattens to no features is reported in `unmappable` instead.
 */
export function buildSituationFeatures(
  situations: NationalSituation[],
  lineGeometry: LineGeometryCache,
): SituationFeatures {
  const pointFeatures: SituationPointFeature[] = [];
  const lineFeatures: SituationLineFeature[] = [];
  const featureCountBySituation = new Map<string, number>();
  const unmappable: string[] = [];

  for (const situation of situations) {
    const before = pointFeatures.length + lineFeatures.length;
    const seen = new Set<string>();

    const addStops = (
      stops: AffectedStop[],
      source: "stopPoint" | "stopPlace",
    ) => {
      for (const stop of stops) {
        const key = `${source}:${stop.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const latitude = stop.location?.latitude;
        const longitude = stop.location?.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        pointFeatures.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [longitude as number, latitude as number],
          },
          properties: propertiesFor(
            situation,
            source,
            stop.id,
            stop.name ?? null,
          ),
        });
      }
    };

    addStops(situation.affects?.stopPoints ?? [], "stopPoint");
    addStops(situation.affects?.stopPlaces ?? [], "stopPlace");

    for (const line of situation.affects?.lines ?? []) {
      if (!line.lineRef) continue;
      const key = `line:${line.lineRef}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const coordinates = lineGeometry.get(line.lineRef);
      if (!coordinates || coordinates.length < 2) continue;

      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: propertiesFor(
          situation,
          "line",
          line.lineRef,
          line.lineName ?? null,
        ),
      });
    }

    const produced = pointFeatures.length + lineFeatures.length - before;
    featureCountBySituation.set(situation.situationNumber, produced);
    if (produced === 0) unmappable.push(situation.situationNumber);
  }

  return { pointFeatures, lineFeatures, featureCountBySituation, unmappable };
}
```

The `Number.isFinite` guard narrows `latitude`/`longitude` from `number | undefined` at runtime but TypeScript does not follow that through the optional chain, hence the `as number` casts on the line that uses them. Do not remove the guard.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/situationFeatures.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/situationFeatures.ts src/domain/situationFeatures.test.ts
git commit -m "Flatten situation affects into GeoJSON features

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 4: Stats tables and client-side filtering

**Files:**

- Create: `src/domain/situationStats.ts`
- Create: `src/domain/situationStats.test.ts`
- Create: `src/domain/situationFilter.ts`
- Create: `src/domain/situationFilter.test.ts`

**Interfaces:**

- Consumes: `NationalSituation`; `SituationFlag` from `./situationFlags.ts`; `makeSituation`.
- Produces: `CountEntry`, `countBy`, `affectsShape`, `SituationStats`, `situationStats` in `situationStats.ts`; `SituationFilter`, `EMPTY_SITUATION_FILTER`, `applySituationFilter`, `facetCounts` in `situationFilter.ts`.

- [ ] **Step 1: Write the failing stats tests**

Create `src/domain/situationStats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { affectsShape, countBy, situationStats } from "./situationStats.ts";

const EMPTY_AFFECTS = {
  vehicleModes: null,
  lines: null,
  stopPoints: null,
  stopPlaces: null,
  serviceJourneys: null,
  datedServiceJourneys: null,
  operators: null,
};

describe("countBy", () => {
  it("sorts by descending count", () => {
    expect(countBy(["a", "b", "a", "c", "a", "b"], (v) => v)).toEqual([
      { value: "a", count: 3 },
      { value: "b", count: 2 },
      { value: "c", count: 1 },
    ]);
  });

  it("buckets null into an explicit (none), so the table reconciles with the total", () => {
    expect(countBy([1, 2], () => null)).toEqual([
      { value: "(none)", count: 2 },
    ]);
  });

  it("breaks count ties alphabetically so the order is stable", () => {
    expect(countBy(["b", "a"], (v) => v)).toEqual([
      { value: "a", count: 1 },
      { value: "b", count: 1 },
    ]);
  });
});

describe("affectsShape", () => {
  it("names the single populated kind", () => {
    expect(
      affectsShape(
        makeSituation({
          affects: { ...EMPTY_AFFECTS, datedServiceJourneys: [{ id: "x" }] },
        }),
      ),
    ).toBe("datedServiceJourneys");
  });

  it("joins several populated kinds in a fixed order", () => {
    expect(
      affectsShape(
        makeSituation({
          affects: {
            ...EMPTY_AFFECTS,
            serviceJourneys: [{ id: "s", date: "2026-08-10" }],
            lines: [{ lineRef: "L:1", lineName: "One", publicCode: "1" }],
          },
        }),
      ),
    ).toBe("lines+serviceJourneys");
  });

  it("calls a null affects (empty)", () => {
    expect(affectsShape(makeSituation({ affects: null }))).toBe("(empty)");
  });

  it("calls an affects with only empty arrays (empty)", () => {
    expect(affectsShape(makeSituation({ affects: { ...EMPTY_AFFECTS } }))).toBe(
      "(empty)",
    );
  });
});

describe("situationStats", () => {
  it("counts severity, report type, codespace and language tagging", () => {
    const stats = situationStats([
      makeSituation({
        situationNumber: "A",
        severity: "undefined",
        reportType: "INCIDENT",
        codespace: { codespaceId: "NSB" },
        summary: [{ value: "s", language: null }],
      }),
      makeSituation({
        situationNumber: "B",
        severity: "normal",
        reportType: "GENERAL",
        codespace: { codespaceId: "NSB" },
        summary: [
          { value: "s", language: "NO" },
          { value: "s", language: "EN" },
        ],
      }),
    ]);

    expect(stats.byCodespace).toEqual([{ value: "NSB", count: 2 }]);
    expect(stats.bySeverity).toEqual([
      { value: "normal", count: 1 },
      { value: "undefined", count: 1 },
    ]);
    expect(stats.byReportType).toEqual([
      { value: "GENERAL", count: 1 },
      { value: "INCIDENT", count: 1 },
    ]);
    expect(stats.summaryLanguages).toEqual([
      { value: "EN+NO", count: 1 },
      { value: "untagged", count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/situationStats.test.ts`
Expected: FAIL — cannot resolve `./situationStats.ts`.

- [ ] **Step 3: Implement the stats module**

Create `src/domain/situationStats.ts`:

```ts
import { NationalSituation, TranslatedString } from "../types.ts";

export type CountEntry = { value: string; count: number };

/** Fixed order, so a shape string is comparable across situations. */
const AFFECTS_KINDS = [
  "lines",
  "stopPoints",
  "stopPlaces",
  "serviceJourneys",
  "datedServiceJourneys",
  "operators",
] as const;

/**
 * Counts by a key, descending, ties broken alphabetically so the tables do not
 * reshuffle between frames. A null key becomes an explicit `(none)` bucket
 * rather than being dropped, so every table reconciles with the total.
 */
export function countBy<T>(
  items: T[],
  key: (item: T) => string | null,
): CountEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item) ?? "(none)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Which affects kinds a situation populates, e.g. `lines+serviceJourneys`. */
export function affectsShape(situation: NationalSituation): string {
  const affects = situation.affects;
  if (!affects) return "(empty)";
  const present = AFFECTS_KINDS.filter(
    (kind) => (affects[kind] ?? []).length > 0,
  );
  return present.length ? present.join("+") : "(empty)";
}

/**
 * The set of language tags on a text, as a single sortable label. `untagged`
 * covers the very common single-variant case where the feed omits `language`
 * entirely — legitimate, but worth counting.
 */
function languageLabel(strings: TranslatedString[] | null): string {
  const entries = strings ?? [];
  if (entries.length === 0) return "(absent)";
  const tags = entries.map(
    (entry) => entry.language?.toUpperCase() ?? "untagged",
  );
  return [...new Set(tags)].sort().join("+");
}

export type SituationStats = {
  bySeverity: CountEntry[];
  byReportType: CountEntry[];
  byCodespace: CountEntry[];
  byAffectsShape: CountEntry[];
  summaryLanguages: CountEntry[];
  descriptionLanguages: CountEntry[];
};

/** Always computed over the unfiltered set, so the readouts do not move as the user narrows. */
export function situationStats(
  situations: NationalSituation[],
): SituationStats {
  return {
    bySeverity: countBy(situations, (s) => s.severity),
    byReportType: countBy(situations, (s) => s.reportType),
    byCodespace: countBy(situations, (s) => s.codespace?.codespaceId ?? null),
    byAffectsShape: countBy(situations, affectsShape),
    summaryLanguages: countBy(situations, (s) => languageLabel(s.summary)),
    descriptionLanguages: countBy(situations, (s) =>
      languageLabel(s.description),
    ),
  };
}
```

- [ ] **Step 4: Run to verify the stats tests pass**

Run: `npx vitest run src/domain/situationStats.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing filter tests**

Create `src/domain/situationFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { SituationFlag } from "./situationFlags.ts";
import {
  EMPTY_SITUATION_FILTER,
  applySituationFilter,
  facetCounts,
} from "./situationFilter.ts";

const A = makeSituation({
  situationNumber: "A",
  severity: "severe",
  reportType: "INCIDENT",
  codespace: { codespaceId: "NSB" },
});
const B = makeSituation({
  situationNumber: "B",
  severity: "normal",
  reportType: "GENERAL",
  codespace: { codespaceId: "ATB" },
});

const FLAGS = new Map<string, SituationFlag[]>([
  ["A", ["noEndTime", "staleOpenEnded"]],
  ["B", []],
]);

describe("applySituationFilter", () => {
  it("returns everything when no facet is constrained", () => {
    expect(applySituationFilter([A, B], EMPTY_SITUATION_FILTER, FLAGS)).toEqual(
      [A, B],
    );
  });

  it("ORs within a facet", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, severities: ["severe", "normal"] },
      FLAGS,
    );
    expect(result).toEqual([A, B]);
  });

  it("ANDs across facets", () => {
    const result = applySituationFilter(
      [A, B],
      {
        ...EMPTY_SITUATION_FILTER,
        severities: ["severe"],
        codespaces: ["ATB"],
      },
      FLAGS,
    );
    expect(result).toEqual([]);
  });

  it("narrows by flag", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded"] },
      FLAGS,
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["A"]);
  });

  it("requires every selected flag, not just one", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded", "notYetActive"] },
      FLAGS,
    );
    expect(result).toEqual([]);
  });

  it("excludes a situation whose facet value is absent when that facet is constrained", () => {
    const noCodespace = makeSituation({
      situationNumber: "C",
      codespace: null,
    });
    const result = applySituationFilter(
      [noCodespace],
      { ...EMPTY_SITUATION_FILTER, codespaces: ["NSB"] },
      new Map([["C", []]]),
    );
    expect(result).toEqual([]);
  });
});

describe("facetCounts", () => {
  it("counts flags over the set it is given, including zero-count flags", () => {
    const counts = facetCounts([A, B], FLAGS);
    expect(counts.flags).toEqual([
      { value: "noEndTime", count: 1 },
      { value: "staleOpenEnded", count: 1 },
      { value: "notYetActive", count: 0 },
    ]);
    expect(counts.codespaces).toEqual([
      { value: "ATB", count: 1 },
      { value: "NSB", count: 1 },
    ]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/domain/situationFilter.test.ts`
Expected: FAIL — cannot resolve `./situationFilter.ts`.

- [ ] **Step 7: Implement the filter module**

Create `src/domain/situationFilter.ts`:

```ts
import { NationalSituation } from "../types.ts";
import { CountEntry, countBy } from "./situationStats.ts";
import { FLAG_LEVEL, SituationFlag } from "./situationFlags.ts";

export type SituationFilter = {
  codespaces: string[];
  severities: string[];
  reportTypes: string[];
  flags: SituationFlag[];
};

export const EMPTY_SITUATION_FILTER: SituationFilter = {
  codespaces: [],
  severities: [],
  reportTypes: [],
  flags: [],
};

/**
 * An empty facet means "unconstrained". Within a facet the selected values are
 * ORed; across facets they are ANDed. A situation whose value for a constrained
 * facet is absent never matches — there is no selectable `(none)` facet, so a
 * null cannot be asked for.
 */
function matches(value: string | null, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return value !== null && selected.includes(value);
}

export function applySituationFilter(
  situations: NationalSituation[],
  filter: SituationFilter,
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
): NationalSituation[] {
  return situations.filter((situation) => {
    if (!matches(situation.codespace?.codespaceId ?? null, filter.codespaces))
      return false;
    if (!matches(situation.severity, filter.severities)) return false;
    if (!matches(situation.reportType, filter.reportTypes)) return false;

    const flags = flagsBySituation.get(situation.situationNumber) ?? [];
    // Selected flags are ANDed: each one narrows further, so "stale AND
    // not-yet-active" asks for the intersection rather than the union.
    return filter.flags.every((flag) => flags.includes(flag));
  });
}

export type FacetCounts = {
  codespaces: CountEntry[];
  severities: CountEntry[];
  reportTypes: CountEntry[];
  flags: CountEntry[];
};

const ALL_FLAGS = Object.keys(FLAG_LEVEL) as SituationFlag[];

/**
 * Counts for the filter controls. Call this with the **unfiltered** set: the
 * counts are there to describe the data, and would be useless if they collapsed
 * to match whatever the user had already selected.
 *
 * Flags with a zero count are still listed, so a flag that should stay at zero
 * remains visible as a regression detector rather than silently disappearing.
 */
export function facetCounts(
  situations: NationalSituation[],
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
): FacetCounts {
  const flagCounts = new Map<SituationFlag, number>(
    ALL_FLAGS.map((flag) => [flag, 0]),
  );
  for (const situation of situations) {
    for (const flag of flagsBySituation.get(situation.situationNumber) ?? []) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  return {
    codespaces: countBy(situations, (s) => s.codespace?.codespaceId ?? null),
    severities: countBy(situations, (s) => s.severity),
    reportTypes: countBy(situations, (s) => s.reportType),
    flags: ALL_FLAGS.map((flag) => ({
      value: flag,
      count: flagCounts.get(flag) ?? 0,
    })),
  };
}
```

- [ ] **Step 8: Run to verify the filter tests pass**

Run: `npx vitest run src/domain/`
Expected: PASS — all four domain test files green.

- [ ] **Step 9: Commit**

```bash
git add src/domain/situationStats.ts src/domain/situationStats.test.ts \
        src/domain/situationFilter.ts src/domain/situationFilter.test.ts
git commit -m "Add situation stats tables and client-side filtering

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 5: The situations subscription hook

**Files:**

- Create: `src/hooks/useSituationsSubscription.ts`

**Interfaces:**

- Consumes: `useSubscriptionClient` from `./useSubscriptionClient.ts`; the two fragments from `./situationFragments.ts`; `NationalSituation`.
- Produces: `SituationsStatus`, `SituationsFeed`, `useSituationsSubscription(): SituationsFeed`.

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useSituationsSubscription.ts`. Model it on `useTimetableSubscription.ts` — same `iterate` / `for await` / `.return()` shape.

```ts
import { FormattedExecutionResult } from "graphql-ws";
import { useEffect, useRef, useState } from "react";
import { NationalSituation } from "../types.ts";
import {
  SITUATION_FIELDS_FRAGMENT,
  SITUATION_QA_FIELDS_FRAGMENT,
} from "./situationFragments.ts";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  situations: NationalSituation[];
};

const subscriptionQuery = `
  ${SITUATION_FIELDS_FRAGMENT}
  ${SITUATION_QA_FIELDS_FRAGMENT}

  subscription {
    situations {
      ...SituationFields
      ...SituationQaFields
    }
  }
`;

/**
 * How long to wait for the opening snapshot before concluding the environment
 * simply has no situations. The live feed delivers its first frame in well
 * under a second; staging and prod deliver nothing at all.
 */
const EMPTY_AFTER_MS = 5000;

export type SituationsStatus = "connecting" | "live" | "empty" | "error";

export type SituationsFeed = {
  situations: NationalSituation[];
  status: SituationsStatus;
  /** Epoch ms of the most recent frame, or null before the first one. */
  lastUpdated: number | null;
};

/**
 * The national situations feed.
 *
 * The subscription is opened unfiltered — the whole set is under 600 items, and
 * the stats and facet counts have to be computed over all of it. Each frame
 * carries up to `bufferSize` situations; entries are keyed by `situationNumber`
 * and the latest one wins.
 *
 * There is deliberately no TTL and no CacheMap. Unlike vehicles, situations do
 * not go stale by age: the server retires them, and everything it serves has
 * `progress: open`.
 */
export function useSituationsSubscription(): SituationsFeed {
  const [feed, setFeed] = useState<SituationsFeed>({
    situations: [],
    status: "connecting",
    lastUpdated: null,
  });

  const byNumber = useRef<Map<string, NationalSituation>>(new Map());
  const subscription = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    byNumber.current = new Map();
    setFeed({ situations: [], status: "connecting", lastUpdated: null });

    const emptyTimer = setTimeout(() => {
      setFeed((previous) =>
        previous.status === "connecting"
          ? { ...previous, status: "empty" }
          : previous,
      );
    }, EMPTY_AFTER_MS);

    subscription.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
    });

    const subscribe = async () => {
      if (!subscription.current) return;
      for await (const event of subscription.current) {
        const incoming = event?.data?.situations ?? [];
        if (incoming.length === 0) continue;

        clearTimeout(emptyTimer);
        for (const situation of incoming) {
          byNumber.current.set(situation.situationNumber, situation);
        }

        setFeed({
          situations: [...byNumber.current.values()].sort((a, b) =>
            a.situationNumber.localeCompare(b.situationNumber),
          ),
          status: "live",
          lastUpdated: Date.now(),
        });
      }
    };

    subscribe().catch((err) => {
      console.error("Situations subscription error:", err);
      // Keep whatever arrived — a dropped stream should not blank the panel.
      setFeed((previous) => ({ ...previous, status: "error" }));
    });

    return () => {
      clearTimeout(emptyTimer);
      subscription.current?.return?.();
    };
  }, [subscriptionClient]);

  return feed;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run build`
Expected: clean.

There is no unit test here — the hook is I/O against a live subscription and `vitest.config.ts` runs in a `node` environment with no React testing library. It is exercised for real in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSituationsSubscription.ts
git commit -m "Subscribe to the national situations feed

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 6: Borrowed line geometry

**Files:**

- Create: `src/hooks/useSituationLineGeometry.ts`

**Interfaces:**

- Consumes: `useConfig`, `useRequestHeaders`, `decodePolyline` from `../utils/decodePolyline.ts`, `LineGeometryCache` from `../domain/situationFeatures.ts`.
- Produces: `useSituationLineGeometry(lineRefs: string[]): LineGeometryCache`.

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useSituationLineGeometry.ts`. Follow `useServiceJourneyRoute.ts` for the `graphql-request` + `AbortController` shape.

```ts
import { request } from "graphql-request";
import { useEffect, useRef, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";

/** Line refs per request. Aliases keep this to one round trip per batch. */
const BATCH_SIZE = 10;

type PointsOnLink = { length: number | null; points: string | null } | null;
type VehicleRow = { serviceJourney: { pointsOnLink: PointsOnLink } | null };
type BatchResponse = Record<string, VehicleRow[] | null>;

/**
 * Line refs contain colons, which are not valid in a GraphQL alias, so the
 * aliases are positional (`l0`, `l1`, …) and mapped back by index.
 */
function buildBatchQuery(refs: string[]): string {
  const variables = refs.map((_, index) => `$l${index}: String!`).join(", ");
  const fields = refs
    .map(
      (_, index) =>
        `l${index}: vehicles(lineRef: $l${index}) { serviceJourney { pointsOnLink { length points } } }`,
    )
    .join("\n    ");
  return `query(${variables}) {\n    ${fields}\n  }`;
}

/** The longest polyline among the vehicles running this line, or null if none carry one. */
function longestPolyline(rows: VehicleRow[] | null): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const row of rows ?? []) {
    const points = row.serviceJourney?.pointsOnLink?.points;
    if (!points) continue;
    const length = row.serviceJourney?.pointsOnLink?.length ?? points.length;
    if (length > bestLength) {
      bestLength = length;
      best = points;
    }
  }
  return best;
}

/**
 * Resolves each affected line to a shape by borrowing it from a journey running
 * on that line right now. The API exposes no geometry on `Line` itself and the
 * situations' own service-journey IDs resolve to nothing, so this is the only
 * route available within this API.
 *
 * A ref that yields nothing is cached as an empty array — "asked, none
 * available" — and is not retried for the rest of the session. That trades a
 * line whose first vehicle appears later for not re-requesting 80-odd refs on
 * every frame; coverage on dev is 31% of vehicles, so most refs are in that
 * state and retrying them would dominate the request budget.
 */
export function useSituationLineGeometry(
  lineRefs: string[],
): LineGeometryCache {
  const cache = useRef<Map<string, number[][]>>(new Map());
  const [geometry, setGeometry] = useState<LineGeometryCache>(cache.current);

  const config = useConfig();
  const requestHeaders = useRequestHeaders();

  // Depend on the content, not the array identity: the caller rebuilds this
  // array on every frame and an identity dependency would refetch endlessly.
  const key = lineRefs.join(",");

  useEffect(() => {
    const pending = lineRefs.filter((ref) => !cache.current.has(ref));
    if (pending.length === 0) return;

    const controller = new AbortController();

    const fetchBatches = async () => {
      for (let start = 0; start < pending.length; start += BATCH_SIZE) {
        const batch = pending.slice(start, start + BATCH_SIZE);
        const variables = Object.fromEntries(
          batch.map((ref, index) => [`l${index}`, ref]),
        );

        const response = await request<BatchResponse>({
          url: config["vehicle-positions-graphql-endpoint"],
          document: buildBatchQuery(batch),
          variables,
          requestHeaders,
          signal: controller.signal,
        });

        batch.forEach((ref, index) => {
          const points = longestPolyline(response[`l${index}`] ?? null);
          cache.current.set(ref, points ? decodePolyline(points) : []);
        });

        if (controller.signal.aborted) return;
        setGeometry(new Map(cache.current));
      }
    };

    fetchBatches().catch((err) => {
      if (controller.signal.aborted) return;
      console.error("Failed to fetch situation line geometry", err);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, config, requestHeaders]);

  return geometry;
}
```

- [ ] **Step 2: Verify it typechecks and lints clean**

Run: `npm run build`
Expected: clean.

Run: `npm run lint`
Expected: still exactly 19 problems — the same count as before this branch. The single `eslint-disable-next-line` above is deliberate: the effect depends on the _contents_ of `lineRefs`, captured in `key`, not on the array's identity.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSituationLineGeometry.ts
git commit -m "Borrow affected-line geometry from running vehicles

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 7: Situations context and provider

**Files:**

- Create: `src/situations/SituationsContext.ts`
- Create: `src/situations/SituationsProvider.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:**

- Consumes: everything from Tasks 2–6.
- Produces: `SituationsContextValue`, `SituationsContext`, `useSituations()` in `SituationsContext.ts`; `SituationsProvider` in `SituationsProvider.tsx`.

- [ ] **Step 1: Create the context**

Create `src/situations/SituationsContext.ts`. It holds no JSX, so `react-refresh/only-export-components` is satisfied by keeping the provider in its own `.tsx`.

```ts
import React, { useContext } from "react";
import { SituationsFeed } from "../hooks/useSituationsSubscription.ts";
import { SituationFeatures } from "../domain/situationFeatures.ts";
import { FacetCounts, SituationFilter } from "../domain/situationFilter.ts";
import { SituationFlag } from "../domain/situationFlags.ts";
import { SituationStats } from "../domain/situationStats.ts";
import { NationalSituation } from "../types.ts";

export type SituationsContextValue = {
  feed: SituationsFeed;
  /** Flags for every situation in the unfiltered set. */
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>;
  filter: SituationFilter;
  setFilter: (filter: SituationFilter) => void;
  /** The subset the user is currently looking at. */
  filtered: NationalSituation[];
  /** Features built over `filtered` — this is what the map draws. */
  features: SituationFeatures;
  /** Situation numbers with no map presence, over the **unfiltered** set. */
  unmappable: string[];
  /** Computed over the unfiltered set, so the readouts stay still as the user narrows. */
  stats: SituationStats;
  facets: FacetCounts;
  selected: string | null;
  setSelected: (situationNumber: string | null) => void;
};

export const SituationsContext =
  React.createContext<SituationsContextValue | null>(null);

export const useSituations = (): SituationsContextValue => {
  const value = useContext(SituationsContext);
  if (!value) {
    throw new Error("useSituations must be used inside a SituationsProvider");
  }
  return value;
};
```

- [ ] **Step 2: Create the provider**

Create `src/situations/SituationsProvider.tsx`:

```tsx
import { ReactNode, useMemo, useState } from "react";
import {
  buildSituationFeatures,
  collectLineRefs,
} from "../domain/situationFeatures.ts";
import {
  EMPTY_SITUATION_FILTER,
  SituationFilter,
  applySituationFilter,
  facetCounts,
} from "../domain/situationFilter.ts";
import { SituationFlag, situationFlags } from "../domain/situationFlags.ts";
import { situationStats } from "../domain/situationStats.ts";
import { useSituationLineGeometry } from "../hooks/useSituationLineGeometry.ts";
import { useSituationsSubscription } from "../hooks/useSituationsSubscription.ts";
import { SituationsContext } from "./SituationsContext.ts";

export function SituationsProvider({ children }: { children: ReactNode }) {
  const feed = useSituationsSubscription();
  const [filter, setFilter] = useState<SituationFilter>(EMPTY_SITUATION_FILTER);
  const [selected, setSelected] = useState<string | null>(null);

  const flagsBySituation = useMemo(() => {
    const now = Date.now();
    return new Map<string, SituationFlag[]>(
      feed.situations.map((situation) => [
        situation.situationNumber,
        situationFlags(situation, now),
      ]),
    );
  }, [feed.situations]);

  const lineRefs = useMemo(
    () => collectLineRefs(feed.situations),
    [feed.situations],
  );
  const lineGeometry = useSituationLineGeometry(lineRefs);

  // Built twice, over different sets and for different consumers: once over
  // everything, only to learn which situations have no map presence at all;
  // once over the filtered set, to feed the map layers.
  const allFeatures = useMemo(
    () => buildSituationFeatures(feed.situations, lineGeometry),
    [feed.situations, lineGeometry],
  );

  const filtered = useMemo(
    () => applySituationFilter(feed.situations, filter, flagsBySituation),
    [feed.situations, filter, flagsBySituation],
  );

  const features = useMemo(
    () => buildSituationFeatures(filtered, lineGeometry),
    [filtered, lineGeometry],
  );

  const stats = useMemo(
    () => situationStats(feed.situations),
    [feed.situations],
  );

  const facets = useMemo(
    () => facetCounts(feed.situations, flagsBySituation),
    [feed.situations, flagsBySituation],
  );

  const value = useMemo(
    () => ({
      feed,
      flagsBySituation,
      filter,
      setFilter,
      filtered,
      features,
      unmappable: allFeatures.unmappable,
      stats,
      facets,
      selected,
      setSelected,
    }),
    [
      feed,
      flagsBySituation,
      filter,
      filtered,
      features,
      allFeatures,
      stats,
      facets,
      selected,
    ],
  );

  return (
    <SituationsContext.Provider value={value}>
      {children}
    </SituationsContext.Provider>
  );
}
```

- [ ] **Step 3: Wrap MapView**

In `src/components/App.tsx`, import the provider and wrap `<MapView>` — it must sit above both the map layers and the right menu, which are the two consumers:

```tsx
import { SituationsProvider } from "../situations/SituationsProvider.tsx";
```

and inside `<ThemeProvider theme={theme}>`:

```tsx
<SituationsProvider>
  <MapView
    data={data}
    setCurrentFilter={setCurrentFilter}
    currentFilter={currentFilter}
    mapViewOptions={mapViewOptions}
    setMapViewOptions={setMapViewOptions}
  />
</SituationsProvider>
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: PASS — 76 tests: the 38 that pre-date this branch plus the 38 added in Tasks 2–4 (11 flags, 12 features, 8 stats, 7 filter).

- [ ] **Step 5: Commit**

```bash
git add src/situations src/components/App.tsx
git commit -m "Add situations context and provider

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 8: Map sources, layers and `SituationLayers`

**Files:**

- Modify: `src/components/SelectedVehiclePanel/situationSeverity.ts`
- Modify: `src/components/mapStyle.ts`
- Create: `src/components/SituationLayers.tsx`
- Modify: `src/components/MapView.tsx`

**Interfaces:**

- Consumes: `useSituations()`; `SituationFeatures`; `VehicleUpdate`.
- Produces: `SEVERITY_SEVERE`, `SEVERITY_MUTED`, `SEVERITY_NOTABLE` exported from `situationSeverity.ts`; `SituationLayers` component taking `{ vehicles: VehicleUpdate[] }`.

- [ ] **Step 1: Export the severity colours**

In `src/components/SelectedVehiclePanel/situationSeverity.ts`, change the three module-private constants to named exports so the map style can build its `match` expression from the same values. The names change; `severityColour` keeps using them unchanged.

```ts
export const SEVERITY_SEVERE = "#c0392b";
export const SEVERITY_MUTED = "#999999";
export const SEVERITY_NOTABLE = "#e07a1f";
```

Then update the three references inside `severityColour` from `SEVERE` / `MUTED` / `NOTABLE` to the new names. Do not change any returned value — `situationSeverity.test.ts` asserts the exact hex strings and must still pass.

- [ ] **Step 2: Add the sources and layers**

In `src/components/mapStyle.ts`, import the colours at the top:

```ts
import {
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
  SEVERITY_SEVERE,
} from "./SelectedVehiclePanel/situationSeverity.ts";
```

Above `export const mapStyle`, define the shared expression so the two layers cannot drift from each other or from `severityColour`:

```ts
// Same mapping as severityColour(): only noImpact is greyed, and the literal
// string "undefined" — 48% of the live feed — stays in the notable colour
// because those are real incident messages.
const severityColourExpression = [
  "match",
  ["get", "severity"],
  ["severe", "verySevere"],
  SEVERITY_SEVERE,
  "noImpact",
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
];
```

Add to `sources`, after `serviceJourneyRoute`:

```ts
    situationLines: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    situationPoints: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    situationVehicles: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
```

Insert into `layers` **immediately after** the `service-journey-route-layer` entry, so every situation layer draws under the vehicle symbols:

```ts
    {
      id: "situation-lines-layer",
      type: "line",
      source: "situationLines",
      paint: {
        "line-color": severityColourExpression,
        "line-width": 4,
        "line-opacity": 0.7,
      },
    },
    {
      id: "situation-affected-vehicles-layer",
      type: "circle",
      source: "situationVehicles",
      paint: {
        "circle-radius": 16,
        "circle-color": "#1fcac2",
        "circle-opacity": 0.2,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#1fcac2",
      },
    },
    {
      id: "situation-points-layer",
      type: "circle",
      source: "situationPoints",
      paint: {
        "circle-radius": 7,
        "circle-color": severityColourExpression,
        "circle-opacity": 0.85,
        // reportType is uppercase in this API. Stroke carries it so the fill
        // stays free for severity, avoiding an icon sprite pipeline.
        "circle-stroke-width": ["case", ["==", ["get", "reportType"], "INCIDENT"], 2, 1],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "reportType"], "INCIDENT"],
          "#2b2b2b",
          "#ffffff",
        ],
      },
    },
```

TypeScript will widen that array literal to `(string | string[])[]`, which `StyleSpecification` rejects. Import the expression type alongside the style type and annotate the constant, rather than loosening the style's own type or casting at each use site:

```ts
import {
  ExpressionSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
```

```ts
const severityColourExpression: ExpressionSpecification = [/* as above */];
```

- [ ] **Step 3: Create the layer component**

Create `src/components/SituationLayers.tsx`. Follow `RouteLayer.tsx`: the sources already exist in the style, this only calls `setData` on them.

```tsx
import type { FeatureCollection } from "geojson";
import { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useSituations } from "../situations/SituationsContext.ts";
import { VehicleUpdate } from "../types.ts";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function useSetSourceData(sourceId: string, data: FeatureCollection) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const source = mapRef.getMap().getSource(sourceId) as
      GeoJSONSource | undefined;
    if (!source) return;

    source.setData(data);

    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [sourceId, data, mapRef]);
}

/**
 * Draws whatever of the filtered situations can be placed, plus a halo around
 * the live vehicles a selected situation affects.
 *
 * Vehicles are matched on lineRef only. VehicleUpdate does not carry a dated
 * service journey, and adding one to the streamed vehicle subscription would
 * cost bandwidth on every frame to match ten more situations — see the plan's
 * spec amendment.
 */
export function SituationLayers({ vehicles }: { vehicles: VehicleUpdate[] }) {
  const { features, filtered, selected } = useSituations();

  const points: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.pointFeatures }),
    [features],
  );

  const lines: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.lineFeatures }),
    [features],
  );

  const affectedVehicles: FeatureCollection = useMemo(() => {
    if (!selected) return EMPTY_FEATURE_COLLECTION;

    const situation = filtered.find((s) => s.situationNumber === selected);
    const lineRefs = new Set(
      (situation?.affects?.lines ?? [])
        .map((line) => line.lineRef)
        .filter((ref): ref is string => Boolean(ref)),
    );
    if (lineRefs.size === 0) return EMPTY_FEATURE_COLLECTION;

    return {
      type: "FeatureCollection",
      features: vehicles
        .filter((vehicle) => lineRefs.has(vehicle.line?.lineRef))
        .map((vehicle) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              vehicle.location.longitude,
              vehicle.location.latitude,
            ],
          },
          properties: { vehicleId: vehicle.vehicleId },
        })),
    };
  }, [selected, filtered, vehicles]);

  useSetSourceData("situationPoints", points);
  useSetSourceData("situationLines", lines);
  useSetSourceData("situationVehicles", affectedVehicles);

  return null;
}
```

- [ ] **Step 4: Render it**

In `src/components/MapView.tsx`, import it and render inside `<Map>`, immediately after `<RouteLayer …/>`:

```tsx
import { SituationLayers } from "./SituationLayers.tsx";
```

```tsx
<SituationLayers vehicles={data.map((vehicle) => vehicle.vehicleUpdate)} />
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: PASS, including the unchanged `situationSeverity.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/components/mapStyle.ts src/components/SituationLayers.tsx \
        src/components/MapView.tsx src/components/SelectedVehiclePanel/situationSeverity.ts
git commit -m "Draw placeable situations and highlight affected vehicles

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 9: Panel shell, status, stats tables and right-menu wiring

**Files:**

- Create: `src/components/SituationsPanel/SituationsPanel.tsx`
- Create: `src/components/SituationsPanel/SituationStatsTables.tsx`
- Create: `src/components/SituationsPanel/index.ts`
- Modify: `src/components/RightMenu/types.ts`
- Modify: `src/components/RightMenu/RightMenuButtons.tsx`
- Modify: `src/components/RightMenu/DrawerContent.tsx`

**Interfaces:**

- Consumes: `useSituations()`; `CountEntry` from `../../domain/situationStats.ts`.
- Produces: `SituationsPanel` (default export path via `index.ts`), `SituationStatsTables`.

- [ ] **Step 1: Add the content type**

`src/components/RightMenu/types.ts` becomes:

```ts
export type RightContentType =
  "filtering" | "info" | "layers" | "stoplight" | "situations";
```

- [ ] **Step 2: Add the button**

In `src/components/RightMenu/RightMenuButtons.tsx`, add the import and a fifth button after the `stoplight` one. The existing four sit at `top` 20, 75, 130 and 185 px, so this one is 240.

```tsx
import orangeMarkerIcon from "../../static/images/orangeMarker.png";
```

```tsx
<button
  onClick={() => toggleSidebar("situations")}
  className={`sidebar-button right ${activeContent === "situations" ? "active" : ""} ${
    activeContent ? "open" : ""
  }`}
  style={{
    top: "240px",
  }}
>
  <img
    src={orangeMarkerIcon}
    alt="Situations"
    title="Situations"
    style={{ width: "40px", height: "40px" }}
  />
</button>
```

- [ ] **Step 3: Add the drawer branch**

In `src/components/RightMenu/DrawerContent.tsx`, import and render. Unlike the other four branches this one is **not** guarded on `currentFilter` — the situations feed is independent of the vehicle filter and must render before the map has reported a bounding box.

```tsx
import { SituationsPanel } from "../SituationsPanel";
```

```tsx
{
  activeContent === "situations" && <SituationsPanel />;
}
```

- [ ] **Step 4: Create the stats tables**

Create `src/components/SituationsPanel/SituationStatsTables.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { CountEntry } from "../../domain/situationStats.ts";
import { useSituations } from "../../situations/SituationsContext.ts";

function CountTable({
  title,
  entries,
}: {
  title: string;
  entries: CountEntry[];
}) {
  return (
    <Box sx={{ marginBottom: 1.5 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        {title}
      </Typography>
      {entries.length === 0 && (
        <Typography component="div" sx={{ fontSize: 12, color: "#999" }}>
          —
        </Typography>
      )}
      {entries.map((entry) => (
        <Box
          key={entry.value}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span>{entry.value}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {entry.count}
          </span>
        </Box>
      ))}
    </Box>
  );
}

/** Every table counts the unfiltered set — these describe the feed, not the selection. */
export function SituationStatsTables() {
  const { stats } = useSituations();

  return (
    <Box>
      <CountTable title="Severity" entries={stats.bySeverity} />
      <CountTable title="Report type" entries={stats.byReportType} />
      <CountTable title="Codespace" entries={stats.byCodespace} />
      <CountTable title="Affects shape" entries={stats.byAffectsShape} />
      <CountTable title="Summary languages" entries={stats.summaryLanguages} />
      <CountTable
        title="Description languages"
        entries={stats.descriptionLanguages}
      />
    </Box>
  );
}
```

- [ ] **Step 5: Create the panel shell**

Create `src/components/SituationsPanel/SituationsPanel.tsx`. The list, filters, detail and unmappable list arrive in Tasks 10 and 11; this task delivers the shell, the status line and the stats.

```tsx
import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { SituationStatsTables } from "./SituationStatsTables.tsx";

function StatusLine() {
  const { feed, filtered } = useSituations();

  if (feed.status === "connecting") {
    return <>Connecting…</>;
  }

  if (feed.status === "empty") {
    return <>No situations published in this environment</>;
  }

  const updated = feed.lastUpdated
    ? new Date(feed.lastUpdated).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";

  const counts =
    filtered.length === feed.situations.length
      ? `${feed.situations.length} situations`
      : `${filtered.length} of ${feed.situations.length} situations`;

  if (feed.status === "error") {
    return (
      <>
        Connection lost — showing {counts} received before {updated}
      </>
    );
  }

  return (
    <>
      Live · {counts} · updated {updated}
    </>
  );
}

export function SituationsPanel() {
  const { feed } = useSituations();

  return (
    <Box sx={{ padding: 2, overflowY: "auto", height: "100%" }}>
      <Typography
        component="h2"
        sx={{ fontSize: 16, fontWeight: 700, marginBottom: 0.5 }}
      >
        Situations
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: 12,
          marginBottom: 2,
          color: feed.status === "error" ? "#c0392b" : "#666",
        }}
      >
        <StatusLine />
      </Typography>

      <SituationStatsTables />
    </Box>
  );
}
```

- [ ] **Step 6: Create the barrel**

Create `src/components/SituationsPanel/index.ts`:

```ts
export { SituationsPanel } from "./SituationsPanel.tsx";
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run build`
Expected: clean.

Run: `npm run dev`, open http://localhost:5173, click the new right-menu button (fifth from the top).

Expected: the drawer shows "Situations", a status line reading `Live · <n> situations · updated <time>` with `n` in the high 500s, and six count tables. `Severity` should list `undefined` as the largest bucket, `Report type` should show `INCIDENT` and `GENERAL` uppercase, and `Codespace` should be headed by NSB.

If the status line instead says "No situations published in this environment", check `public/bootstrap.json` points at `api.dev.entur.io` — staging and prod genuinely serve none.

- [ ] **Step 8: Commit**

```bash
git add src/components/SituationsPanel src/components/RightMenu
git commit -m "Add situations panel shell with feed status and stats tables

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 10: Filters and the situation list

**Files:**

- Create: `src/components/SituationsPanel/SituationFilters.tsx`
- Create: `src/components/SituationsPanel/SituationRow.tsx`
- Modify: `src/components/SituationsPanel/SituationsPanel.tsx`

**Interfaces:**

- Consumes: `useSituations()`; `FLAG_LEVEL`, `SituationFlag`; `pickTranslation` from `../SelectedVehiclePanel/situationText.ts`; `severityColour` from `../SelectedVehiclePanel/situationSeverity.ts`.
- Produces: `SituationFilters`, `SituationRow`.

- [ ] **Step 1: Create the filter controls**

Create `src/components/SituationsPanel/SituationFilters.tsx`:

```tsx
import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";
import { CountEntry } from "../../domain/situationStats.ts";
import { SituationFilter } from "../../domain/situationFilter.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { useSituations } from "../../situations/SituationsContext.ts";

type FacetKey = keyof SituationFilter;

function Facet({
  title,
  facetKey,
  entries,
  colourFor,
}: {
  title: string;
  facetKey: FacetKey;
  entries: CountEntry[];
  colourFor?: (value: string) => string | undefined;
}) {
  const { filter, setFilter } = useSituations();
  const selected = filter[facetKey] as string[];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];
    // The computed key widens the object literal past SituationFilter, and the
    // flags facet holds SituationFlag rather than string — both are safe here
    // because every value shown came out of facetCounts over the real data.
    setFilter({ ...filter, [facetKey]: next } as SituationFilter);
  };

  return (
    <Box sx={{ marginBottom: 1.5 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        {title}
      </Typography>
      {entries.map((entry) => (
        <FormControlLabel
          key={entry.value}
          sx={{ display: "flex", marginLeft: 0, marginRight: 0 }}
          control={
            <Checkbox
              size="small"
              checked={selected.includes(entry.value)}
              onChange={() => toggle(entry.value)}
              sx={{ padding: "2px 6px 2px 0" }}
            />
          }
          label={
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 12,
                color: colourFor?.(entry.value),
              }}
            >
              <span>{entry.value}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {entry.count}
              </span>
            </Box>
          }
        />
      ))}
    </Box>
  );
}

/**
 * Counts come from the unfiltered set on purpose: a facet whose count collapsed
 * to match the current selection would stop describing the feed.
 *
 * Flags are ANDed with each other and with the other facets, so a zero-count
 * flag stays listed rather than vanishing — it is a regression detector.
 */
export function SituationFilters() {
  const { facets, filter, setFilter } = useSituations();

  const anySelected =
    filter.codespaces.length +
      filter.severities.length +
      filter.reportTypes.length +
      filter.flags.length >
    0;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
          Filter
        </Typography>
        {anySelected && (
          <Box
            component="button"
            type="button"
            onClick={() =>
              setFilter({
                codespaces: [],
                severities: [],
                reportTypes: [],
                flags: [],
              })
            }
            sx={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 11,
              color: "#1976d2",
              padding: 0,
            }}
          >
            clear
          </Box>
        )}
      </Box>

      <Facet
        title="Severity"
        facetKey="severities"
        entries={facets.severities}
      />
      <Facet
        title="Report type"
        facetKey="reportTypes"
        entries={facets.reportTypes}
      />
      <Facet
        title="Codespace"
        facetKey="codespaces"
        entries={facets.codespaces}
      />
      <Facet
        title="Quality flags"
        facetKey="flags"
        entries={facets.flags}
        colourFor={(value) =>
          FLAG_LEVEL[value as SituationFlag] === "warning"
            ? "#c0392b"
            : undefined
        }
      />
    </Box>
  );
}
```

- [ ] **Step 2: Create the row**

Create `src/components/SituationsPanel/SituationRow.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { NationalSituation } from "../../types.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { severityColour } from "../SelectedVehiclePanel/situationSeverity.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";

type SituationRowProps = {
  situation: NationalSituation;
  flags: SituationFlag[];
  featureCount: number;
  selected: boolean;
  onSelect: () => void;
};

export function SituationRow({
  situation,
  flags,
  featureCount,
  selected,
  onSelect,
}: SituationRowProps) {
  const summary = pickTranslation(situation.summary) ?? "(no summary)";

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderBottom: "1px dotted #eee",
        borderLeft: `3px solid ${severityColour(situation.severity)}`,
        background: selected ? "#eef7f7" : "none",
        cursor: "pointer",
        padding: "6px 8px",
        font: "inherit",
      }}
    >
      <Typography component="div" sx={{ fontSize: 12, fontWeight: 600 }}>
        {summary}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", marginTop: 0.25 }}>
        <Typography component="span" sx={{ fontSize: 10, color: "#666" }}>
          {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
          {situation.severity ?? "(no severity)"} ·{" "}
          {situation.reportType ?? "(no type)"}
        </Typography>
        {featureCount === 0 && (
          <Typography component="span" sx={{ fontSize: 10, color: "#999" }}>
            not on map
          </Typography>
        )}
        {flags.map((flag) => (
          <Typography
            key={flag}
            component="span"
            sx={{
              fontSize: 10,
              color: FLAG_LEVEL[flag] === "warning" ? "#c0392b" : "#666",
            }}
          >
            {flag}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Wire filters and list into the panel**

In `src/components/SituationsPanel/SituationsPanel.tsx`, add the imports:

```tsx
import { SituationFilters } from "./SituationFilters.tsx";
import { SituationRow } from "./SituationRow.tsx";
```

Extend the destructuring in `SituationsPanel` and render the two new blocks between the status line and `<SituationStatsTables />`:

```tsx
export function SituationsPanel() {
  const { feed, filtered, flagsBySituation, features, selected, setSelected } =
    useSituations();

  return (
    <Box sx={{ padding: 2, overflowY: "auto", height: "100%" }}>
      <Typography
        component="h2"
        sx={{ fontSize: 16, fontWeight: 700, marginBottom: 0.5 }}
      >
        Situations
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: 12,
          marginBottom: 2,
          color: feed.status === "error" ? "#c0392b" : "#666",
        }}
      >
        <StatusLine />
      </Typography>

      <SituationFilters />

      <Box sx={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 2 }}>
        {filtered.map((situation) => (
          <SituationRow
            key={situation.situationNumber}
            situation={situation}
            flags={flagsBySituation.get(situation.situationNumber) ?? []}
            featureCount={
              features.featureCountBySituation.get(situation.situationNumber) ??
              0
            }
            selected={selected === situation.situationNumber}
            onSelect={() =>
              setSelected(
                selected === situation.situationNumber
                  ? null
                  : situation.situationNumber,
              )
            }
          />
        ))}
      </Box>

      <SituationStatsTables />
    </Box>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run build`
Expected: clean.

Run: `npm run dev` and open the situations drawer.

Expected:

- Four facet groups with live counts. `Severity` lists `undefined` with the largest count; `Quality flags` lists all three flags including any at zero, with `staleOpenEnded` in red.
- Ticking `staleOpenEnded` narrows the list and updates the status line to `<n> of <m> situations`, while the facet counts themselves stay put.
- Ticking two flags narrows further rather than widening — that is the AND semantic.
- Most rows carry a "not on map" tag; a handful do not.
- Clicking a row highlights it; clicking again clears it.

- [ ] **Step 5: Commit**

```bash
git add src/components/SituationsPanel
git commit -m "Add situation facet filters and the situation list

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 11: Detail view and the unmappable list

**Files:**

- Create: `src/components/SituationsPanel/SituationDetail.tsx`
- Create: `src/components/SituationsPanel/UnmappableList.tsx`
- Modify: `src/components/SituationsPanel/SituationsPanel.tsx`

**Interfaces:**

- Consumes: `useSituations()`; `formatValidity` from `../SelectedVehiclePanel/situationValidity.ts`; `pickTranslation`.
- Produces: `SituationDetail`, `UnmappableList`.

- [ ] **Step 1: Create the detail view**

Create `src/components/SituationsPanel/SituationDetail.tsx`. Every translation is shown with its tag; untagged text renders as `untagged` and is never dropped or assumed Norwegian.

```tsx
import { Box, Typography } from "@mui/material";
import { NationalSituation, TranslatedString } from "../../types.ts";
import { SituationFlag } from "../../domain/situationFlags.ts";
import { affectsShape } from "../../domain/situationStats.ts";
import { formatValidity } from "../SelectedVehiclePanel/situationValidity.ts";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ display: "flex", gap: 1, fontSize: 11 }}>
      <span style={{ color: "#666", minWidth: 110 }}>{label}</span>
      <span style={{ wordBreak: "break-all" }}>{value ?? "—"}</span>
    </Box>
  );
}

function Translations({
  label,
  strings,
}: {
  label: string;
  strings: TranslatedString[];
}) {
  if (!strings || strings.length === 0) return null;

  return (
    <Box sx={{ marginTop: 1 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        {label}
      </Typography>
      {strings.map((entry, index) => (
        <Box
          key={`${entry.language ?? "untagged"}-${index}`}
          sx={{ marginTop: 0.25 }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 10, color: "#999", marginRight: 0.5 }}
          >
            {entry.language ?? "untagged"}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12 }}>
            {entry.value ?? "(empty)"}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function AffectsGroup({
  label,
  entries,
}: {
  label: string;
  entries: string[];
}) {
  if (entries.length === 0) return null;

  return (
    <Box sx={{ marginTop: 0.5 }}>
      <Typography component="div" sx={{ fontSize: 10, color: "#666" }}>
        {label} ({entries.length})
      </Typography>
      {entries.map((entry) => (
        <Typography
          key={entry}
          component="div"
          sx={{ fontSize: 11, wordBreak: "break-all", paddingLeft: 1 }}
        >
          {entry}
        </Typography>
      ))}
    </Box>
  );
}

export function SituationDetail({
  situation,
  flags,
  onClose,
}: {
  situation: NationalSituation;
  flags: SituationFlag[];
  onClose: () => void;
}) {
  const affects = situation.affects;
  const validity = formatValidity(situation);

  return (
    <Box
      sx={{
        border: "1px solid #ddd",
        borderRadius: 1,
        padding: 1.5,
        marginBottom: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
          Detail
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          sx={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 14,
            padding: 0,
            color: "#666",
          }}
        >
          ×
        </Box>
      </Box>

      <Translations label="Summary" strings={situation.summary} />
      <Translations label="Description" strings={situation.description} />
      <Translations label="Advice" strings={situation.advice} />

      <Box sx={{ marginTop: 1 }}>
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#666",
          }}
        >
          Validity
        </Typography>
        {(validity ?? ["—"]).map((line) => (
          <Typography key={line} component="div" sx={{ fontSize: 11 }}>
            {line}
          </Typography>
        ))}
      </Box>

      {situation.infoLinks.length > 0 && (
        <Box sx={{ marginTop: 1 }}>
          <Typography
            component="div"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#666",
            }}
          >
            Info links
          </Typography>
          {situation.infoLinks.map((link, index) => (
            <Typography
              key={`${link.uri ?? "no-uri"}-${index}`}
              component="div"
              sx={{ fontSize: 11, wordBreak: "break-all" }}
            >
              {link.uri ?? "(no uri)"}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ marginTop: 1 }}>
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#666",
          }}
        >
          Affects — {affectsShape(situation)}
        </Typography>
        <AffectsGroup
          label="Lines"
          entries={(affects?.lines ?? []).map((line) =>
            `${line.lineRef} ${line.lineName ?? ""}`.trim(),
          )}
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
          label="Service journeys"
          entries={(affects?.serviceJourneys ?? []).map(
            (journey) => journey.id,
          )}
        />
        <AffectsGroup
          label="Dated service journeys"
          entries={(affects?.datedServiceJourneys ?? []).map(
            (journey) => journey.id,
          )}
        />
        <AffectsGroup
          label="Operators"
          entries={(affects?.operators ?? []).map((operator) =>
            `${operator.operatorRef} ${operator.name ?? ""}`.trim(),
          )}
        />
      </Box>

      <Box sx={{ marginTop: 1 }}>
        <Field label="situationNumber" value={situation.situationNumber} />
        <Field label="version" value={situation.version?.toString() ?? null} />
        <Field label="participantRef" value={situation.participantRef} />
        <Field
          label="codespace"
          value={situation.codespace?.codespaceId ?? null}
        />
        <Field label="sourceType" value={situation.sourceType} />
        <Field label="progress" value={situation.progress} />
        <Field label="severity" value={situation.severity} />
        <Field label="reportType" value={situation.reportType} />
        <Field
          label="priority"
          value={situation.priority?.toString() ?? null}
        />
        <Field
          label="planned"
          value={situation.planned === null ? null : String(situation.planned)}
        />
        <Field label="creationTime" value={situation.creationTime} />
        <Field label="versionedAtTime" value={situation.versionedAtTime} />
        <Field label="lastUpdated" value={situation.lastUpdated} />
        <Field label="expiration" value={situation.expiration} />
        <Field
          label="openEnded"
          value={
            situation.openEnded === null ? null : String(situation.openEnded)
          }
        />
        <Field label="age" value={situation.age} />
        <Field label="flags" value={flags.length ? flags.join(", ") : null} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Create the unmappable list**

Create `src/components/SituationsPanel/UnmappableList.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";
import { affectsShape } from "../../domain/situationStats.ts";

/**
 * Situations that flatten to no map features at all — on this feed the
 * majority, dominated by the ones referencing only dated service journeys,
 * whose IDs resolve to nothing geographic in this API.
 *
 * This list is computed over the unfiltered set and is these situations' only
 * surface, so it exists whether or not the current filter would show them.
 */
export function UnmappableList() {
  const { unmappable, feed, setSelected, selected } = useSituations();

  const byNumber = new Map(feed.situations.map((s) => [s.situationNumber, s]));

  return (
    <Box sx={{ marginBottom: 2 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        Not on the map ({unmappable.length} of {feed.situations.length})
      </Typography>
      <Box sx={{ maxHeight: "25vh", overflowY: "auto" }}>
        {unmappable.map((situationNumber) => {
          const situation = byNumber.get(situationNumber);
          if (!situation) return null;
          return (
            <Box
              key={situationNumber}
              component="button"
              type="button"
              onClick={() =>
                setSelected(
                  selected === situationNumber ? null : situationNumber,
                )
              }
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px dotted #eee",
                background: selected === situationNumber ? "#eef7f7" : "none",
                cursor: "pointer",
                padding: "4px 0",
                font: "inherit",
              }}
            >
              <Typography component="div" sx={{ fontSize: 11 }}>
                {pickTranslation(situation.summary) ?? "(no summary)"}
              </Typography>
              <Typography component="div" sx={{ fontSize: 10, color: "#999" }}>
                {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
                {affectsShape(situation)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Wire both into the panel**

In `src/components/SituationsPanel/SituationsPanel.tsx`, add:

```tsx
import { SituationDetail } from "./SituationDetail.tsx";
import { UnmappableList } from "./UnmappableList.tsx";
```

Inside `SituationsPanel`, resolve the selected situation — it may be selected from either list, so look it up in the full feed rather than in `filtered`:

```tsx
const selectedSituation =
  selected === null
    ? null
    : (feed.situations.find((s) => s.situationNumber === selected) ?? null);
```

Render the detail immediately after the list block, and the unmappable list after it:

```tsx
      {selectedSituation && (
        <SituationDetail
          situation={selectedSituation}
          flags={flagsBySituation.get(selectedSituation.situationNumber) ?? []}
          onClose={() => setSelected(null)}
        />
      )}

      <UnmappableList />

      <SituationStatsTables />
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run build`
Expected: clean.

Run: `npm run dev` and open the situations drawer.

Expected:

- Selecting a row opens the detail block showing every translation with its language tag — untagged entries labelled `untagged`, never blank and never assumed Norwegian.
- `Affects` names the shape and lists the entries; a NSB situation shows a long `Dated service journeys` group.
- The identity block shows `version` as `—` for roughly half the situations, which is the real state of the feed.
- "Not on the map" reports a count in the mid-400s out of the high 500s.
- Selecting a situation whose affects include a line that resolved to geometry draws a coloured line on the map, and teal halos appear under the vehicles running that line. Most selections will not, which is expected on dev.

- [ ] **Step 5: Commit**

```bash
git add src/components/SituationsPanel
git commit -m "Add situation detail view and the unmappable list

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

### Task 12: Documentation

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: nothing. This task records what the previous eleven built.

- [ ] **Step 1: Extend the data-flow section**

In `CLAUDE.md`, add item 7 after the existing item 6:

```markdown
7. Separately from the vehicle pipeline, `SituationsProvider` (wrapping `<MapView>` in `App`) opens an **unfiltered** national `situations` subscription via `useSituationsSubscription`, keyed by `situationNumber` with latest-wins and no TTL. Everything derived from it is pure and lives in `src/domain/`: `situationFlags` (three lifecycle flags), `situationFeatures` (affects → GeoJSON plus the unmappable list), `situationStats` and `situationFilter`. Two consumers read the context — `SituationLayers` inside `<Map>`, and `SituationsPanel` in the right-menu drawer.
```

- [ ] **Step 2: Add the invariants**

Append to the "Key invariants worth preserving" list:

```markdown
- The `situations` root query and subscription are **hidden from introspection**, exactly like `timetables`. They validate and stream normally; do not conclude from an introspection dump that they are gone.
- `situations` is served with data only in **dev**. Staging and prod return an empty list, which the panel reports as "No situations published in this environment" — distinct from an error and from a filter matching nothing.
- Situation stats and facet counts are computed over the **unfiltered** set. Recomputing them over the filtered set would collapse every count to match the current selection and make the readouts useless.
- Situation features are deduplicated **within** a situation only. Two situations affecting one stop deliberately produce two coincident features; collapsing them would hide the duplication this tool exists to expose.
- `SituationFields` and `SituationQaFields` in `src/hooks/situationFragments.ts` both target the GraphQL `Situation` type. The timetable subscription spreads only the first, at two levels; the situations subscription spreads both. Adding a field to `SituationFields` therefore adds it to the timetable query as well.
```

- [ ] **Step 3: Document the geography limitation**

Add a new section after "Map / icons":

```markdown
## Situations carry almost no geography

`Affects.stopPoints` and `Affects.stopPlaces` are the only coordinate-bearing
fields the situations feed exposes. `Line` has no geometry of any kind, and the
service-journey IDs situations publish (`VYG:ServiceJourney:601_159720-R`,
`NSB:DatedServiceJourney:…`) are in a different namespace from the realtime
feed's, so they resolve to nothing — `serviceJourney(id:)` and `timetables` both
return empty for them.

Affected lines are therefore drawn from geometry **borrowed** from a vehicle
running that line right now, via `vehicles(lineRef:)` →
`serviceJourney.pointsOnLink`, cached per line ref in `useSituationLineGeometry`.
A ref that yields nothing is cached as an empty array and not retried for the
session.

Measured on dev: 108 of 581 situations place on the map. 319 of the remainder
reference only dated service journeys. Prod carries far better `pointsOnLink`
coverage (87% of vehicles versus 31% on dev), so the same code would place
roughly 223 there — but prod serves no situations at all today.

Do not "fix" the low coverage by inventing centroids or by falling back to
Journey Planner. Staying on one API is a project constraint, and a synthetic
position would be worse than an honest absence in a data-QA tool.
```

- [ ] **Step 4: Verify formatting**

Run: `npm run check`
Expected: PASS.

Run: `npm test`
Expected: PASS — all domain tests plus the 38 pre-existing.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the situations panel and its geography limits

Claude-Session: https://claude.ai/code/session_01XLEFYmK4tduBunzmLQo97Y"
```

---

## Self-review notes

Checked against the spec:

- **Placement** — Task 9 (`RightContentType`, button at 240px, drawer branch). ✅
- **Fetch, unfiltered, latest-wins, no TTL** — Task 5. ✅
- **No new bootstrap key** — Task 5 reuses `useSubscriptionClient`. ✅
- **Types, existing fragment untouched** — Task 1. ✅
- **Three lifecycle flags with the 90-day rule** — Task 2. ✅
- **Features, within-situation dedup, nothing invented** — Task 3. ✅
- **Stats, facet counts over the unfiltered set** — Task 4, consumed in Tasks 9 and 10. ✅
- **Borrowed line geometry, cached, alias-batched** — Task 6. ✅
- **Two map layers plus vehicle highlight** — Task 8. ✅
- **Panel, filters, rows, detail, unmappable list** — Tasks 9–11. ✅
- **Untagged text never hidden or defaulted** — Task 11, `Translations`. ✅
- **Empty environment reported distinctly** — Task 5 (`"empty"` status) and Task 9 (`StatusLine`). ✅
- **Dropped stream keeps last data** — Task 5 (`"error"` preserves `situations`). ✅
- **Fixture** — Task 1 captures it, Task 3 asserts against it. ✅
- **Playwright smoke test** — deliberately **not** included. The spec lists one, but Playwright is not run in CI and the situations panel renders nothing outside dev, so the test would be red in exactly the environments CI could run it. Recorded here as a conscious omission rather than a gap.
