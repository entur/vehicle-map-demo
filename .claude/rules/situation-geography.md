---
paths:
  - "src/domain/situation*.ts"
  - "src/domain/journeyRef*.ts"
  - "src/hooks/situationFragments.ts"
  - "src/hooks/useSituationsSubscription.ts"
  - "src/components/SituationLayers.tsx"
  - "src/components/SituationsPanel/**"
---

# Situations carry their own geography

The situations feed serves the coordinates it needs. `Affects.vehicleJourneys`
and `Affects.affectedLines` pair each affected journey and line with the
**located** stops it is affected at, and both a journey entry and a line entry
may carry `affectedPointsOnLink`: the span of its route between the first and
last affected stop, or — when the situation names no stops, meaning it is
affected as a whole — the entire route. An empty `stops` list is what tells
those two cases apart.

A line's span carries a caveat a journey's does not: a line has many journey
patterns, so `affectedLines[].affectedPointsOnLink` is **one representative
pattern, not the line as a whole** — the API picks the first pattern the
affected stops locate on, or the longest when the line is affected as a
whole. Treat it as indicative of where the line is affected, never as the
line's shape.

Measured on dev (977 situations): 906 map, 71 do not. Spans stay rare on
journeys — 45 of 9,053 journey entries — but line entries carry one far more
often: 109 of 695. The API explains why rather than guessing: it withholds a
span when the entry has no pattern geometry, when exactly one stop is
affected — a point is not a span (217 line entries affect exactly one stop; 10
have no stops and no pattern geometry), or when any affected stop cannot be
located on the route. **Do not "fix" that by interpolating between stops or
falling back to Journey Planner.** A synthetic line drawn over the wrong part
of a route is worse than an honest absence in a data-QA tool, which is the
same reason the API declines to draw it.

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

## Mistyped journey refs

Some publishers put an id of the wrong NeTEx type in a journey slot, and it
costs those situations their geometry. `src/domain/journeyRef.ts` detects it
from the id alone — `<codespace>:<Type>:<value>`, so the slot's expected type is
readable without any lookup — and raises the `mistypedJourneyRef` warning flag.

Two distinct defects, from two publishers. Measured on dev, 949 situations /
9,537 journey entries:

- **ATB, 17 situations, 29 refs.** A `ServiceJourney` id in the
  `datedServiceJourney` slot. These **do** map: the API resolves the id despite
  the slot it arrived in, and since none of these entries names a stop, the span
  is the journey's whole route by the API's own rule. They map only because the
  API was fixed — see below.
- **SKY, 2 situations, 2 refs.** A bare `15139934_167845` in the
  `serviceJourney` slot — not a NeTEx id at all, so `actualType` is null and it
  names nothing any lookup could resolve. These do not map, and no API change
  can reach them; only the publisher can fix it.

So a flagged situation is **not** necessarily unmappable, and the flag is not a
proxy for one. It reports a producer defect, which is a separate thing from
whether the map can draw the result.

The flag is deliberately _all_ this repo does about it. Resolving the ATB ids
client-side would rebuild the borrowed-geometry apparatus retired above, and the
API's own `affectedPointsOnLink` doc comment names client-side fallback to
`serviceJourney { pointsOnLink }` as the thing that resolver exists to prevent.

That was the right call, and it is worth recording why the flag stayed useful.
Before the API fix, all 18 flagged situations were unmappable — 18 of the 67
unmappable situations in the feed, over a quarter of them, undrawable for this
one reason. The fix was made in `AffectedGeometryController.serviceJourneyIdOf`,
which accepts the mistyped ref, rather than in `SituationMapper.mapAffects`,
which would have re-routed it into the correct slot. That distinction is what
keeps this flag alive: the ref is still published in the wrong slot, still
visible, and still reportable to ATB. Had the mapper been changed instead, the
geometry would work and the producer's defect would have become invisible to
every consumer. Feed-wide unmappable fell 67 → 50 as a result.
