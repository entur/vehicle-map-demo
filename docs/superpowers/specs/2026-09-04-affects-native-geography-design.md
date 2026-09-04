# Situations affects — native geography — design

Date: 2026-09-04

## Purpose

The situations feed now serves its own geography. `Affects` has gained two fields —
`vehicleJourneys` and `affectedLines` — that pair each affected journey and line with the
**located** stops it is affected at, and that expose the affected span of a journey's route
as an encoded polyline.

This makes the borrowed-geometry apparatus obsolete and takes situation mappability on dev
from 106 of 944 situations to 845 of 944.

This is a migration for journeys and lines, an addition for stops. The schema states the
redundancy outright, on `Affects.vehicleJourneys`:

> Every journey listed here also appears in serviceJourneys/datedServiceJourneys, and every
> line in lines, so existing clients see no change.

Verified independently against a full dev snapshot before relying on it: across all 944
situations, `affectedLines[].line.lineRef` equals `affects.lines` exactly, and
`vehicleJourneys` covers exactly the same journey set as `serviceJourneys` +
`datedServiceJourneys`. Both diffs were 944/944 identical, 0 differing.

**That claim does not extend to `stopPoints` and `stopPlaces`, and they are kept.** It names
journeys and lines only. Measured: all 20 situations carrying located `stopPoints`/`stopPlaces`
have zero `vehicleJourneys` and zero `affectedLines` — they are tagged directly on a stop
(`ATB:SituationNumber:26641-stopPoint`, `SJN:SituationNumber:10`), so the new fields do not
reach them. Dropping those two fields would silently unmap 20 situations. Only `lines`,
`serviceJourneys` and `datedServiceJourneys` leave the selection set.

## The new API surface

```
AffectedVehicleJourney
  serviceJourney        ServiceJourney
  datedServiceJourney   DatedServiceJourney
  line                  Line       "Context for display. A journey entry is scoped to the
                                    journey it names, never to this line."
  operator              Operator
  stops                 [AffectedStop]
  affectedPointsOnLink  PointsOnLink

AffectedLine
  line                  Line
  stops                 [AffectedStop]   "A line has many journey patterns, so a line entry
                                          carries no geometry."

AffectedStop
  stop                  Stop             (id, name, location)
  stopConditions        [StopConditionEnumeration]
```

`affectedPointsOnLink` carries its own contract, which the client must not second-guess:

> The part of this journey's geometry the situation affects: the span between the first and
> last affected stop, or — when the situation names no stops at all, meaning the journey is
> affected as a whole — the journey's entire route. An empty `stops` list is what tells those
> two cases apart. Null when the journey has no pattern geometry, when exactly one stop is
> affected (a point is not a span), or when any affected stop cannot be located on the
> route — a partial span would draw a confident line over the wrong part of it.

## Measurements (dev, full snapshot, 944 situations)

Mappability, per situation:

| Geography source                            | Situations |
| ------------------------------------------- | ---------- |
| located `affects.stopPoints` / `stopPlaces` | 20         |
| located `affectedLines[].stops`             | 601        |
| located `vehicleJourneys[].stops`           | 208        |
| any `affectedPointsOnLink`                  | 20         |
| **union — mappable after this change**      | **845**    |
| still unmappable                            | 99         |

Against today's behaviour, on the same snapshot: **106 mappable, 838 unmappable**. Today's
106 is the 20 located stop entries plus the 85 that borrowing reaches; they overlap by 0.

Spans stay rare, and the schema explains why. Of 9,232 journey entries:

| Journey entry                                   | Count                             |
| ----------------------------------------------- | --------------------------------- |
| exactly one affected stop — a point, not a span | 3,610                             |
| no stops and no geometry — no pattern geometry  | 718                               |
| **with `affectedPointsOnLink`**                 | **46** (25 span + 21 whole-route) |

Stop entries are plentiful and almost fully located: 25,097 located journey-stop entries and
3,080 located line-stop entries. Deduplicated within each situation they become 922 and 1,195
point features respectively — the collapse is the same stop repeated across many journeys of
one situation.

`stopConditions` is populated: `destination` on 16,442 of 25,097 journey-stop entries, empty
on the remaining 8,655.

## Retiring the borrowed geometry

Measured on dev at the same moment: line borrowing resolves 33 of 90 line refs; journey
borrowing resolves 78 of 4,591 journey ids (934 survive `mayResolveJourney`).

Per situation:

|                                    | Situations |
| ---------------------------------- | ---------- |
| the new journey/line fields map it | 825        |
| borrowing maps it                  | 85         |
| **only borrowing maps it**         | **35**     |
| neither                            | 84         |

(`stopPoints`/`stopPlaces` are excluded from this table — they are kept either way, and add
the 20 situations that take the design's total from 825 to 845.)

Borrowing is retired entirely, accepting the loss of those 35 — the only situations this
change makes worse. They are whole-line shapes borrowed from whichever vehicle happens to be
running the line right now — precisely the
imprecision `affectedPointsOnLink` deliberately declines to emit rather than "draw a
confident line over the wrong part of it". Keeping them would put a confident full-line shape
next to a precise span with nothing distinguishing the two, in a tool whose whole purpose is
to show what the feed actually contains.

Deleted: `useSituationLineGeometry.ts`, `useSituationJourneyGeometry.ts`,
`useBorrowedGeometry.ts`, `journeyBatch.ts` (+ test), `journeyDate.ts` (+ test).
`decodePolyline` stays — the spans need it.

**Side effect, deliberately not acted on.** The session geometry cache is the stated reason
`SituationsProvider` stays mounted in vehicles mode instead of unmounting. With the cache
gone, that rationale is gone. The mount behavior is left exactly as it is and only the
comment is corrected; unmounting is a separate behavioral change that nothing here requires.

## Types

`Affects` goes from seven fields to six. The API's `AffectedStop` collides with our existing
`AffectedStop` (`{id, name, location}`); ours is deleted and `stopPoints`/`stopPlaces` are
typed as `Stop[]`, which is already exactly the API's `Stop`.

```ts
export type StopConditionEnumeration =
  | "exceptionalStop"
  | "destination"
  | "notStopping"
  | "requestStop"
  | "startPoint";

export type AffectedStop = {
  stop: Stop;
  stopConditions: StopConditionEnumeration[];
};

export type AffectedVehicleJourney = {
  serviceJourney: { id: string } | null;
  datedServiceJourney: { id: string } | null;
  line: Line | null;
  operator: Operator | null;
  stops: AffectedStop[] | null;
  affectedPointsOnLink: { points: string | null; length: number | null } | null;
};

export type AffectedLine = { line: Line | null; stops: AffectedStop[] | null };

export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  operators: Operator[] | null;
  stopPoints: Stop[] | null;
  stopPlaces: Stop[] | null;
  vehicleJourneys: AffectedVehicleJourney[] | null;
  affectedLines: AffectedLine[] | null;
};
```

`lines`, `serviceJourneys` and `datedServiceJourneys` leave `SituationQaFields`.

## Features

`buildSituationFeatures` loses both geometry-cache parameters and becomes a pure function of
the feed: `buildSituationFeatures(situations)`. `collectLineRefs`,
`collectDatedServiceJourneyRefs` and `LineGeometryCache` are deleted with their consumers.

Five feature sources. The two stop sources are unchanged; the two borrowed ones (`line`,
`datedServiceJourney`) are replaced by three fed from the feed itself:

| `source`             | Built from                                      | Geometry   |
| -------------------- | ----------------------------------------------- | ---------- |
| `stopPoint` (kept)   | `stopPoints[].location`                         | Point      |
| `stopPlace` (kept)   | `stopPlaces[].location`                         | Point      |
| `journeyStop` (new)  | `vehicleJourneys[].stops[].stop.location`       | Point      |
| `lineStop` (new)     | `affectedLines[].stops[].stop.location`         | Point      |
| `affectedSpan` (new) | `vehicleJourneys[].affectedPointsOnLink.points` | LineString |

`entityId` for a span is the dated service journey id, falling back to the service journey id.
`name` on a stop feature is the stop name; on a span it is the journey's `line.lineName`
where present.

**Points deduplicate within a situation on stop id alone**, not on `source:id` as today: one
situation, one stop, one dot, whichever of the four sources reached it first. A stop reachable
both as a journey stop and a line stop must not draw two coincident markers. Measured before
adopting it — across all 944 situations the four stop sources overlap on **zero** stops (2,138
features either way), so this is currently a no-op that only guards against future data.

Everything else about the feature contract is unchanged and stays deliberate:

- Deduplication is **within** a situation only. Two situations affecting one stop still
  produce two coincident features.
- Nothing is averaged, invented or given a synthetic centroid. A situation that flattens to
  no features lands in `unmappable` — now 99 of 944 rather than 838.

## Consumers

- **`SituationsProvider`** — both geometry hooks and the `mayResolveJourney` pre-filter go;
  the memo becomes `buildSituationFeatures(filtered)` with `[filtered]` as its dependency.
- **`situationStats`** — `AFFECTS_KINDS` becomes `["affectedLines", "vehicleJourneys",
"stopPoints", "stopPlaces", "operators"]`. The `byAffectsShape` table's vocabulary changes
  completely; reporting the feed's actual shape is what that table is for.
- **`SituationDetail`** — the six `AffectsGroup`s become five: Lines (from `affectedLines`,
  with affected-stop count), Journeys (id, line, operator, stop count, whether a span
  resolved), Stop points, Stop places, Operators. `stopConditions` is surfaced here; it is
  new information the feed carries and this is the raw-dump panel.
- **`SituationLayers`, `mapStyle`** — untouched. Both sources and all four layers already
  exist and are fed by point and line features. `source` and `entityId` are carried in feature
  properties but read by nothing outside tests, so extending the `source` union costs nothing.
- **`scripts/capture-situations-fixture.mjs`** — its query is updated to the new selection set
  so captured fixtures match.

## Testing

`situationFeatures.test.ts` is rewritten against the new shape and drives the implementation;
it is the bulk of the work. `situationStats.test.ts` needs its affects fixtures updated.
`journeyBatch.test.ts` and `journeyDate.test.ts` are deleted with their modules.
`appMode.test.ts` is unaffected — no layer or source changes, so both partitions still hold.

## CLAUDE.md

The "Situations carry almost no geography" section is wrong end to end and is rewritten:
geography now arrives with the feed, 845 of 944 situations map, and the two documented
`affectedPointsOnLink` nulls explain why spans stay rare. The borrowing paragraphs go. Two
invariants elsewhere also need correcting: the claim that only `stopPoints` and `stopPlaces`
carry coordinates (still the only _direct_ stop geography, but no longer the only coordinates
in `affects`), and the `SituationQaFields` note describing the old selection set.

## Out of scope

- Unmounting `SituationsProvider` in vehicles mode (see above).
- Any use of `affectedLines[].stops` or `stopConditions` as a _filter_ facet. They are
  rendered and counted, not filtered on.
- Resolving the 3,610 single-affected-stop journeys to geometry. The API declines to emit a
  span for them by design, and synthesising one client-side is the same error as inventing a
  centroid.
