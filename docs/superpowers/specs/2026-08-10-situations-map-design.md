# Situations map & data-QA panel — design

Date: 2026-08-10

## Purpose

Bring the sister project `../situations-map-demo`'s functionality into `vehicle-map-demo`,
sourcing situations from the **vehicle-positions GraphQL API** rather than Journey Planner
v3.

The result is a data-QA view over the national situations feed: stats, lifecycle quality
flags, a browsable list, and raw per-situation detail — with a secondary map presence for
whatever geography the feed can actually be resolved to.

It is not a traveller-facing disruption map. Like the rest of this app, it exists to expose
what the feed actually contains.

## Baseline measurements

All figures were measured against `https://api.dev.entur.io/realtime/v2/vehicles/graphql`
on 2026-08-10. The feed is live, so counts drift by a few over minutes — the set moved from
581 to 592 during the session. Figures below use the 581-situation snapshot unless stated.

Whole national set: **581 situations**, 1.49 MB, 0.53 s.

## What this API offers, and what it does not

### The root query and the hidden subscription

```graphql
situations(
  situationNumbers, codespaceId, operatorRef, lineRef, stopRef,
  serviceJourneyId, datedServiceJourneyId, mode, severity, reportType,
  validNow, openEnded, minAge, includeClosed
): [Situation]
```

A **`situations` subscription** also exists. It is hidden from `Subscription` introspection —
the same as `timetables`, which this app already depends on — but validates and streams. It
takes the same arguments plus `bufferSize`/`bufferTime`, and notably **not** `boundingBox`.

Measured behaviour of the subscription: a full snapshot arrives in ~0.4 s as frames of 20,
then live deltas. Over a 40 s window: 33 frames, 596 items, 593 distinct `situationNumber`s.

Server-side argument effects, measured later in the session against the 592-situation set:
`validNow: true` → 451, `openEnded: true` → 307, `minAge: "P90D"` → 175,
`severity: undefined` → 279, `reportType: "INCIDENT"` → 547. `includeClosed: true` changes
nothing — `progress` is `open` on every situation in the feed.

### `Affects` is an object, not a union

Unlike Journey Planner's `affects[]` union, this API exposes:

```graphql
Affects {
  lines: [Line]                                # lineRef, lineName, publicCode
  stopPoints: [Stop]                           # id, name, location { latitude longitude }
  stopPlaces: [Stop]
  serviceJourneys: [ServiceJourney]            # id, date
  datedServiceJourneys: [DatedServiceJourney]  # id, serviceJourney
  operators: [Operator]
  vehicleModes: [VehicleModeEnumeration]
}
```

This is easier to consume — no inline fragments, no `AffectedUnknown`. But it carries far
less geography.

### The geography problem

`Stop.location` is the **only** coordinate-bearing field in the entire `affects` tree.
Probed and confirmed `FieldUndefined`: `Line.quays`, `Line.pointsOnLink`,
`Line.journeyPatterns`, `Line.stops`, `Line.route`, `Line.geometry`, `Stop.latitude`,
`DatedServiceJourney.pointsOnLink`, `DatedServiceJourney.line`, `ServiceJourney.calls`,
`ServiceJourney.line`.

`ServiceJourney.pointsOnLink` does exist, but returns null for situation-supplied journey
IDs. The two sides live in different ID namespaces: SIRI-SX publishes
`VYG:ServiceJourney:601_159720-R` and `NSB:DatedServiceJourney:2124_ASR-LLS_24-11-11`, while
the realtime feed carries `21581522_205130` and `ATB:ServiceJourney:3_251215112549653_147`.
Of 4036 affected dated service journeys, **32** match a live vehicle. `Query.timetables`
(also hidden) returns `[]` for these IDs.

Consequently the affects shapes divide almost disjointly:

| affects shape               | count | placeable                      |
| --------------------------- | ----: | ------------------------------ |
| `datedServiceJourneys` only |   319 | no                             |
| `lines` only                |   138 | only via borrowed geometry     |
| `stopPoints` only           |    67 | **yes** — coordinates on 68/68 |
| `lines` + `serviceJourneys` |    28 | only via borrowed geometry     |
| `serviceJourneys` only      |    23 | no                             |
| empty `affects`             |     5 | no                             |
| `stopPlaces` only           |     1 | **yes**                        |

Distinct entities across the set: 31 stops, 91 lineRefs, 1019 service journeys, 4036 dated
service journeys.

### Borrowed line geometry

The one available lever is the live vehicle feed: `vehicles(lineRef:)` returns currently
running journeys, and `serviceJourney.pointsOnLink` resolves for those. So an affected line's
shape can be borrowed from a journey running on it now.

Coverage is environment-dependent, and this matters:

| environment | vehicles with `pointsOnLink` | distinct lines with geometry |
| ----------- | ---------------------------: | ---------------------------: |
| dev         |            1855 / 5933 (31%) |                    506 / 852 |
| prod        |            4293 / 4960 (87%) |                  1044 / 1072 |

74 of the 91 affected lines have a live vehicle on dev, but only **10** of those vehicles
carry a polyline. Map coverage on dev today is therefore **108 of 581 (19%)** — 68 from stop
coordinates, 40 more from borrowed geometry. On prod's polyline coverage the same mechanism
would place roughly 223.

This is an environment artifact, not a design flaw. The line layer will look sparse on dev
and fill in if the feed ships to prod.

### Rollout state

`situations` returns **0 on staging and prod**; only dev carries data (582 at time of
writing). The panel must state this plainly rather than rendering an empty table that reads
as broken.

## Architecture

### Placement

A new `"situations"` member of `RightContentType`, with a button in `RightMenuButtons` at
`top: 240px` and a branch in the right menu's `DrawerContent`. No router, no new app shell,
no change to the existing menus' behaviour.

### Fetch

`useSituationsSubscription()` opens the situations subscription against the existing
`vehicle-positions-subscriptions-endpoint`. **No new `bootstrap.json` key is required.**

Entries are keyed by `situationNumber`; each update replaces the previous entry. There is no
TTL and no `CacheMap`: unlike vehicles, situations do not go stale by age — the server
retires them, and every situation in the feed has `progress: open`.

The subscription is opened **unfiltered**, and all filtering happens client-side, even
though the server accepts `codespaceId`, `severity`, `reportType`, `openEnded` and `minAge`.
Two reasons:

1. The whole set is 592 items / 1.5 MB — server-side narrowing buys nothing.
2. Facet counts must be computed over the **unfiltered** set, or they shift as the user
   narrows and stop being usable as a readout. This is the sister project's rule and it
   applies unchanged.

### Types

`Situation` in `src/types.ts` is left exactly as it is. It is the shape the timetable
subscription selects, and the shared `SituationFields` fragment spread at both the timetable
and call level is a documented invariant.

Added alongside it:

- `Affects` — the object above.
- `NationalSituation extends Situation` — adds `participantRef`, `codespace`, `sourceType`,
  `progress`, `priority`, `planned`, `creationTime`, `versionedAtTime`, `lastUpdated`,
  `expiration`, `openEnded`, `age`, `affects`.

The root `situations` field and `EstimatedTimetableUpdate.situations` return the **same**
GraphQL `Situation` type, so the subscription document can spread the existing
`SituationFields` fragment **and** a new `SituationQaFields` fragment side by side. The
existing fragment is untouched, so the timetable cannot drift.

Fields deliberately not modelled: `keywords` (empty on all 581), `detail`,
`lastUpdatedEpochSecond`, `expirationEpochSecond`.

### Pure logic — new `src/domain/`

`vitest.config.ts` sets `environment: "node"` and `include: ["src/**/*.test.ts"]`, so plain
`.ts` modules under `src/domain/` are collected and `.tsx` is not. All non-trivial logic goes
here.

- **`situationFlags.ts`** — computes the lifecycle flags (below) for one situation.
- **`situationFeatures.ts`** — turns `affects` plus the line-geometry cache into GeoJSON
  point and line features. Deduplicates **within** a situation by stop id and by line ref,
  never across situations, so a stop affected by three situations yields three coincident
  features and a click can hit several at once. A situation flattening to zero features is
  reported as unmappable. Nothing is averaged, invented, or given a synthetic centroid.
- **`situationStats.ts`** — count-by tables for the readouts.

Tests run against a fixture captured from dev and committed at
`src/__fixtures__/situations.json`, including the 638-affects situation, the 5 empty-affects
situations, and at least one of each affects shape.

### Quality flags

Three, all lifecycle, matching the sister project's rules:

| flag             | level   | count | rule                                                    |
| ---------------- | ------- | ----: | ------------------------------------------------------- |
| `noEndTime`      | info    |   307 | some validity period has no `endTime`                   |
| `staleOpenEnded` | warning |   160 | open-ended **and** `creationTime` more than 90 days ago |
| `notYetActive`   | info    |   133 | every validity period starts in the future              |

`staleOpenEnded` deliberately overlaps `noEndTime`, so `noEndTime` stays useful on its own
for "show me everything open-ended" while `staleOpenEnded` isolates the subset that looks
abandoned. Age distribution on the set: median 41 days, p90 636 days, maximum **2306 days**.
A situation with no `creationTime` cannot be assessed and is never flagged; none exist today.

No `expiredValidity` flag: zero situations in the feed have all validity periods in the past,
because the server does not serve closed situations.

There is deliberately **no validity-window filter** — no time slider, no "as of" control.

### Map presence

`SituationLayers.tsx` adds two GeoJSON sources above the existing vehicle layers:

- a **circle layer** from `stopPoints` / `stopPlaces` coordinates;
- a **line layer** from borrowed geometry.

`useSituationLineGeometry(lineRefs)` resolves each distinct affected `lineRef` through
`vehicles(lineRef:)`, takes the longest returned `pointsOnLink`, decodes it with the existing
`src/utils/decodePolyline.ts`, and caches it by `lineRef` in a ref. Only uncached refs are
requested. Multiple lineRefs are batched into one request using GraphQL aliases — verified
working, 5 lines in 3 KB / 0.27 s — so the 91 distinct lines cost roughly 9 requests once,
then incremental as new lines appear. The cache is never evicted during a session.

Selecting a situation additionally highlights the live vehicles it affects, matched by
`lineRef` or by `datedServiceJourney.id`. 164 of 581 situations match at least one vehicle
currently on the map.

Severity drives colour on both layers through a data-driven `match` expression, reusing the
scale already defined in `src/components/SelectedVehiclePanel/situationSeverity.ts` — severe
and verySevere red, `noImpact` grey, everything else including the literal `"undefined"`
orange. That last case is not cosmetic: `severity` is the string `"undefined"` on 280 of 581
situations, and those are real incident messages.

### UI — new `src/components/SituationsPanel/`

- **`SituationsPanel.tsx`** — the drawer section. Connection status and item count, stats
  tables, flag facets, the filtered list, and the unmappable list.
- **`SituationFilters.tsx`** — codespace, severity, report type, and the three flags, each
  option carrying its live count against the unfiltered set.
- **`SituationRow.tsx`** — one row in the list; selecting it opens the detail view and
  focuses the map on that situation's features, if it has any.
- **`SituationDetail.tsx`** — raw per-situation detail: every text variant with its language
  tag rendered explicitly (untagged shown as `untagged`, never defaulted to Norwegian and
  never hidden), `affects` grouped by kind with resolved names and IDs, all validity periods,
  info links, and the identity/versioning fields.
- **`UnmappableList.tsx`** — the situations that yield zero map features. Membership falls
  out of `situationFeatures` returning nothing; it needs no flag machinery. This list is the
  only surface these situations get, and on this feed it is the majority of them — 473 of 581
  on dev today, dominated by the 319 that reference only dated service journeys.

These reuse the pure helpers from the situations-in-timetable branch —
`situationText.ts`, `situationSeverity.ts`, `situationValidity.ts` — but **not**
`SituationList.tsx`. That component is tuned for the vehicle panel's collapsed-summary
reading; this view needs raw fields and a different information density.

Stats tables report counts by severity, report type, codespace, affects shape, and language
tagging. Measured distributions for reference: severity — `undefined` 280, `normal` 167,
`noImpact` 117, `severe` 17. reportType — `INCIDENT` 536, `GENERAL` 45 (uppercase here,
lowercase in Journey Planner). Codespaces — NSB 279, ATB 122, SKY 104, GCO 28, VYX 27,
VYB 8, and a short tail. Summary language — untagged 290, `EN`+`NO` 280, `NO` only 11.
`advice` is present on 3 situations, `infoLinks` on 6, `version` on 280, `versionedAtTime`
on 279.

## Error handling

- A dropped subscription keeps the last received set on screen and shows its state in the
  panel header. Blanking the panel would be worse than showing data beside an honest status.
- An environment serving zero situations — staging and prod today — is reported as
  "no situations published in this environment", distinct from an error and distinct from a
  filter that matches nothing.
- A `lineRef` that resolves to no borrowed geometry degrades to that situation's point
  features alone; if it has none, the situation appears in the unmappable list. It is never
  dropped silently.

## Testing

- **Unit (Vitest)** — `situationFlags`, `situationFeatures` and `situationStats` are pure and
  tested against the committed dev fixture. Flag tests assert each rule at its boundary,
  including the 90-day cut for `staleOpenEnded`. Feature tests assert within-situation
  deduplication and that cross-situation coincident features are preserved.
- **Playwright** — one smoke test: the situations panel opens and lists situations. Playwright
  is not run in CI; `npm test` and `npm run check` are the gates.

## Explicitly out of scope

- No new `bootstrap.json` key. The subscription reuses the existing endpoint.
- No server-side filtering. Everything narrows client-side.
- No `CacheMap` or TTL for situations.
- No churn or version-regression tracking. The subscription makes it possible, but each
  update simply replaces the previous entry.
- No validity-window filter.
- No Journey Planner fallback for geometry, even though it would raise map coverage from
  ~19% to near-total. Staying on one API is a project constraint.

## Open questions

None blocking. The most likely thing to want revisiting once the tool is in use is whether
`unmappable` should be promoted from a panel section to a filterable facet, so it composes
with the codespace and severity filters.
