# Deviation messages (situations) in timetable data — design

## Context

The Entur realtime vehicle GraphQL API has been extended with deviation messages, exposed
as `Situation` objects. They are currently deployed only in the dev environment
(`api.dev.entur.io`); staging and prod reject the field with
`Validation error (FieldUndefined@[timetables/situations])`.

Situations hang off the `timetables` subscription in two places:

- `EstimatedTimetableUpdate.situations: [Situation]` — messages about the trip as a whole.
- `Call.situations: [Situation]` — messages about one specific stop on that trip.

There is also a top-level `Query.situations` on dev, which this design does not use — the
panel only ever needs the situations attached to the trip it is already subscribed to.

The demo's `SelectedVehiclePanel` already renders the per-stop timetable
(see `2026-05-22-timetable-on-selected-vehicle-design.md`). Nothing surfaces deviation
messages. This spec covers adding them at both levels.

### Observed live data (dev, 2026-08-07)

Verified against the live dev endpoint rather than assumed from the schema:

- Of 73 timetable frames sampled, **31 carried trip-level situations** and **7 carried
  stop-level situations**. Both paths are live and worth building.
- `severity` distribution across 376 situations: `undefined` 276, `normal` 87,
  `noImpact` 12, `severe` 1. **`undefined` is the common case, not an anomaly** — those
  are real NSB incident messages.
- `reportType`: `INCIDENT` 336, `GENERAL` 40.
- `language` on translated strings: `NO` 287, `EN` 276, **`null` 89**. Untagged strings
  are common enough that language selection must not assume a tag exists.
- English translations are frequently just the Norwegian string copied verbatim (observed
  on NSB records where `summary[EN] === summary[NO]`, both Norwegian).
- `description` is often identical to `summary` (all sampled NSB records).
- One stop returned **four distinct `situationNumber`s with byte-identical summary text**
  ("Endra trasé pga. vegarbeid").
- `advice`, `detail`, `infoLinks` and the `affects` sub-collections are usually empty but
  do appear (e.g. an ATB record with an `infoLink` to `atb.no/driftsmeldinger`).

## Goals

- Surface trip-level deviation messages in the selected-vehicle panel.
- Surface stop-level deviation messages on the affected timetable row.
- Keep the panel readable in a 320px drawer when a trip carries several messages.
- Stay faithful to what the feed sent — this is a data-debugging tool.

## Non-goals

- Filtering, deduplication, or suppression of any situation (see "No filtering" below).
- Using the top-level `Query.situations`.
- Situations anywhere outside the selected-vehicle panel (no map markers, no popup, no
  `VehicleDetailsDialog` integration).
- Rendering `affects`, `detail`, `keywords`, `priority`, `progress`, `openEnded`, `age`.
- Localising the app chrome. UI labels stay English; only situation _content_ prefers
  Norwegian.
- Any gating of the query by environment (see "Rollout" below).

## Rollout

The `situations` field breaks the entire `timetables` subscription on staging and prod
today — a validation error means no timetable renders at all, not merely missing
situations. This was verified against both endpoints.

**Decision:** the query includes `situations` unconditionally, with no config flag and no
runtime schema probe. The API owner will deploy the field to staging and prod before this
frontend change is pushed. This keeps the code simple at the cost of an ordering
dependency between the two deploys, which is accepted and owned.

## UX overview

```
┌ Line 35  Åsane → Klauvaneset ──────┐
│ ⚠ Endra trasé pga. vegarbeid       │
│ ⚠ OBS! Tur 1398 må vente ved…      │
├────────────────────────────────────┤
│ ● 07:40  Åsane terminal            │
│ ● 07:52  Lyngbø rv. 555        ⚠   │  ← stop-level, click to expand
│ ○ 08:04  Salhus kai                │
└────────────────────────────────────┘
```

Trip-level messages render as a list directly under the existing "Trip cancelled" banner
and above the delay status line. Stop-level messages render as a ⚠ marker on the affected
`StopRow`, beside the existing occupancy icon; clicking it toggles an inline list beneath
that row.

Each message is collapsed by default to a severity-coloured ⚠ plus its summary. Clicking a
message expands it to show description, advice, all translations, validity period,
info links, and a debug footer.

## Architecture

### New component: `SituationList.tsx`

Presentational only — takes `situations: Situation[]` and a `dense` flag (stop-level rows
render tighter than trip-level ones). No data fetching, no knowledge of where the
situations came from, so the same component serves both levels.

Internally renders one `SituationRow` per situation. `SituationRow` owns a single
`useState<boolean>` for its expanded state.

**Collapsed row:** severity-coloured ⚠ glyph + `pickTranslation(summary)` + an expand
chevron. Summary text clamps to two lines.

**Expanded row adds:**

- `description`, then `advice`, each skipped when `isRedundant(text, summary)`.
- All translations of summary/description/advice tagged with their language
  (`NO` / `EN` / `—` for untagged), so a developer can see exactly what the feed carries.
- Validity period as `startTime – endTime`, or `startTime – (open ended)` when `endTime`
  is null.
- `infoLinks` as real anchors, labelled with `pickTranslation(labels)` and falling back to
  the raw `uri`. Rendered with `target="_blank"` and `rel="noopener noreferrer"`.
- A dimmed footer: `{situationNumber} · v{version}`.

Severity → colour:

| Severity                         | Colour    |
| -------------------------------- | --------- |
| `severe`, `verySevere`           | `#c0392b` |
| `normal`, `slight`, `verySlight` | `#e07a1f` |
| `unknown`, `undefined`, null     | `#e07a1f` |
| `noImpact`                       | `#999`    |

`undefined` deliberately maps to the same orange as `normal` rather than to grey: it is
the most frequent value in live data (276 of 376) and those records are real incidents.
Greying them would hide the majority of the feed.

The mapping lives in one exported function alongside the component, mirroring how
`delayThresholds.ts` isolates the delay colour scale.

### New module: `situationText.ts`

Pure, unit-tested helpers. This is where the fiddly rules live, kept out of the components:

- `pickTranslation(strings: TranslatedString[] | null): string | null` — prefers a `NO`
  entry, then `EN`, then the first entry with a non-empty `value`, then `null`. The
  fallback chain matters: 89 of 376 live records carry `language: null`.
- `isRedundant(text: string | null, summary: string | null): boolean` — true when `text`
  is null/empty or equals `summary` after trimming. Prevents the expanded view repeating
  the same sentence twice, which every sampled NSB record would otherwise do.

Norwegian is preferred over English because the `EN` translations are frequently just the
Norwegian string copied over, making `NO` the more reliable field. The expanded view shows
every translation regardless, so nothing is lost.

### Existing code touched

- **`types.ts`** — add `SeverityEnumeration`, `TranslatedString`, `ValidityPeriod`,
  `InfoLink`, `Situation`; add `situations: Situation[] | null` to `Call` and
  `EstimatedTimetableUpdate`.
- **`useTimetableSubscription.ts`** — add a `SituationFields` fragment and spread it at
  both levels of the query.
- **`SelectedVehiclePanel.tsx`** — render `<SituationList>` for `timetable.situations`
  under the cancelled banner.
- **`StopRow.tsx`** — add the ⚠ marker and the expandable inline list. Gains one
  `useState<boolean>`; it has been stateless until now.

`Timetable.tsx` is **not** modified — it passes whole `Call` objects to `StopRow` already,
so `call.situations` arrives without a signature change.

## Types

Added to `src/types.ts`:

```ts
export type SeverityEnumeration =
  | "unknown"
  | "verySlight"
  | "slight"
  | "normal"
  | "severe"
  | "verySevere"
  | "noImpact"
  | "undefined";

export type TranslatedString = {
  value: string | null;
  language: string | null;
};

export type ValidityPeriod = {
  startTime: string | null;
  endTime: string | null;
};

export type InfoLink = {
  uri: string | null;
  labels: TranslatedString[];
};

export type Situation = {
  situationNumber: string;
  version: number | null;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  summary: TranslatedString[];
  description: TranslatedString[];
  advice: TranslatedString[];
  validityPeriods: ValidityPeriod[];
  infoLinks: InfoLink[];
};
```

`Call` and `EstimatedTimetableUpdate` each gain `situations: Situation[] | null`.

Following the precedent set by the timetable design, only the fields the panel renders are
modelled. `affects`, `detail`, `keywords`, `planned`, `priority`, `progress`,
`creationTime`, `versionedAtTime`, `sourceType`, `participantRef`, `codespace`,
`lastUpdated`, `expiration`, `openEnded` and `age` are omitted from both the type and the
query — unused fields on the wire are cost without benefit, and adding one later is a
two-line change.

## Query

```graphql
fragment SituationFields on Situation {
  situationNumber
  version
  severity
  reportType
  summary {
    value
    language
  }
  description {
    value
    language
  }
  advice {
    value
    language
  }
  validityPeriods {
    startTime
    endTime
  }
  infoLinks {
    uri
    labels {
      value
      language
    }
  }
}
```

Spread as `situations { ...SituationFields }` on both `timetables` and `timetables.calls`.
A fragment rather than a duplicated selection set, so the two levels cannot drift apart.

## No filtering

Every situation the feed delivers is rendered, including near-duplicates and every
severity. This is a deliberate reversal of the obvious "tidy up the noise" instinct:
vehicle-map-demo exists to inspect what the realtime feed actually contains, and silently
collapsing four distinct `situationNumber`s into one row would hide exactly the kind of
upstream data problem the tool is meant to expose.

The schema documents that the stream is only eventually consistent — two concurrent
updates to the same `situationNumber` can publish in reverse version order, and it advises
clients to keep the highest version seen and discard regressions. Rather than discard
anything, the `situationNumber · vN` footer makes the version **visible**, so a regression
shows up in the UI instead of being swallowed by client-side logic.

This is sound here because the panel re-renders from the latest frame rather than
accumulating a situation store across frames, so there is no stale-state hazard to guard
against.

## Edge cases

- **`situations` null or empty** — render nothing. No empty-state text, no marker on the
  stop row. This is the common case and must stay visually silent.
- **Every translation empty or `value: null`** — `pickTranslation` returns null and the
  row renders its severity glyph with the `situationNumber` as fallback text, so the
  message is still countable and identifiable.
- **`summary` empty but `description` populated** — collapsed row falls back to
  `pickTranslation(description)`; `isRedundant` then suppresses the duplicate in the
  expanded view.
- **Very long summary** — clamped to two lines collapsed (`-webkit-line-clamp: 2`), full
  text when expanded.
- **Many messages on one trip** — the trip-level list sits above the scrollable timetable
  and would push it out of view. The list caps its own height at ~40% of the drawer and
  scrolls internally beyond that, so the timetable always remains reachable.
- **`infoLinks[].uri` null** — skip that link entirely rather than rendering a dead anchor.
- **`validityPeriods` empty** — omit the validity line.
- **Stop-level list expanded, then a new frame arrives** — rows are keyed
  `` `${situationNumber}-${index}` `` so expansion state survives a re-render from a fresh
  frame. The index suffix matters: because nothing is deduplicated, the same
  `situationNumber` can legitimately appear twice in one array during a version
  regression, and a bare `situationNumber` key would collide.
- **Trip cancelled _and_ situations present** — both render; the cancelled banner stays
  first, since it is the more severe signal.

## Testing

- **Unit tests** — `situationText.test.ts` alongside `situationText.ts`, matching the
  existing `callTimes.test.ts` pattern. Covers `pickTranslation` (NO preferred, EN
  fallback, untagged fallback, all-empty → null) and `isRedundant` (identical text,
  whitespace differences, null input).
- **`npm test`** — the project now has vitest wired up (`vitest run`); the new tests run
  there.
- **CI gates** — `npm run check` (Prettier) and `npm run build` (`tsc -b`) cover the rest.
- **Manual checklist** for the PR description, against dev:
  - select a SKY vehicle (highest observed situation rate) and confirm trip-level
    messages render,
  - find a stop row with a ⚠ and confirm expand/collapse works,
  - confirm a stop carrying four identical-text situations renders all four,
  - expand a message with an `infoLink` (ATB) and confirm the link opens,
  - confirm a trip with no situations renders exactly as before.

## Documentation

Two corrections to `CLAUDE.md` in the same change:

- Document `situations` on the timetable subscription in the data-flow section.
- Fix the stale claim that "There is no `npm test` script" — `package.json` defines
  `test: vitest run`, and `vitest` is a devDependency.
