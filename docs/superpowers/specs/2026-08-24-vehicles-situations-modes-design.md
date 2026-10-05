# Vehicles / Situations app modes — design

Date: 2026-08-24

## Purpose

Split the app into two mutually exclusive modes — **Vehicles** and **Situations** — so that
each feature owns its own controls, its own map layers, and its own subscription.

Three problems motivate this, in the order they were raised:

1. **Data cost.** Both subscriptions run all the time. The national situations feed (~870
   situations, 1.49 MB on the opening snapshot) streams while the user is looking only at
   vehicles, and vehicle frames stream while the user is reading the situations panel.
2. **Conceptual confusion.** One set of controls drives two features. The codespace dropdown
   silently narrows both. The Layers drawer mixes seven vehicle switches with one situations
   switch. Situation facets live in the panel while the codespace that also filters them
   lives in a different drawer.
3. **Visual clutter.** The right rail always offers all five tools regardless of what the
   user is doing.

Demo-ability was explicitly _not_ a motivation.

This is a separation of concerns in the UI and the data layer. It adds no new data, no new
query, and no new API surface.

## The model

`App` gains one piece of state:

```ts
type AppMode = "vehicles" | "situations";
```

Default `"vehicles"`. Synced to the URL as `?mode=` alongside the existing filter params, so
a shared link carries the mode.

Mode sits next to `currentFilter` in `App` rather than inside a drawer, because it decides
which subscription is open. It is not a view preference.

`MapViewOptions.showSituations` is **deleted**. It is precisely the thing mode replaces:
situations draw because the user is in situations mode, not because a switch says so.

## The control

An always-visible segmented control on the map, positioned above the right-hand button rail.

```
                       ┌──────────────────────┐
                       │ VEHICLES │ situations│
                       └──────────────────────┘
                                          (▤)  layers
                                          (▽)  filter
                                          (i)  info
                                          (◉)  data report
```

Rejected: tabs inside the Layers drawer (the drawer is closed by default, so the app would
have no on-screen indication of which mode it is in, while the mode governs which
subscription runs) and folding the mode buttons into the rail itself (mode buttons and tool
buttons would be visually identical, hiding the fact that mode changes what the tools _are_).

## What each mode owns

|                  | Vehicles                                        | Situations                                      |
| ---------------- | ----------------------------------------------- | ----------------------------------------------- |
| Right rail       | layers, filter, info, data report               | layers, filter, situations                      |
| Left rail        | statistics (`InfoBox`)                          | hidden                                          |
| Filter drawer    | codespace, operator, max data age               | codespace, severity, report type, quality flags |
| Layers drawer    | the seven vehicle switches                      | affected stops, affected lines                  |
| Map data writers | `VehicleMarkers`, `VehicleTraces`, `RouteLayer` | `SituationLayers`                               |
| Popups / panels  | `VehiclePopup`, `SelectedVehiclePanel`          | `SituationsPanel`                               |
| Subscription     | `useVehiclePositionsData`                       | `useSituationsSubscription`                     |

### Filtering

`SituationFilters` moves out of `SituationsPanel` and into the situations-mode filter drawer,
next to the codespace dropdown. `SituationsPanel` becomes a pure readout: status line, list,
detail, stats tables, not-on-the-map list.

Codespace remains a **single control** owned by `FilterBox` in both modes. This preserves the
existing invariant recorded in CLAUDE.md — the panel must not grow a codespace facet of its
own, or the two controls contradict each other. Moving the facets next to the codespace
dropdown does not weaken that invariant; it makes it visible, because the one codespace
control is now shown alongside the facets it coexists with.

Operator and max data age are vehicle concepts. They stay in `Filter` state and in the URL
across a mode switch, but are only rendered in vehicles mode.

### Layers

The situations Layers drawer replaces the single deleted "Situations" switch with two:

- **Affected stops** → `situation-points-layer`
- **Affected lines** → `situation-lines-layer`

These are worth separating: points come from `Affects.stopPoints`/`stopPlaces` coordinates
the feed actually carries, while lines come from geometry _borrowed_ from a vehicle running
that line (`useSituationLineGeometry`). Being able to hide the borrowed geometry and see only
what the feed genuinely places is a real data-QA distinction.

## Data gating

Both hooks gain an `enabled` flag, false when the other mode is active.

**`useSituationsSubscription(enabled)`** — a guard at the top of its `useEffect`
(`useSituationsSubscription.ts:68`). The existing cleanup at `:110` already tears down
correctly, so disabling mid-stream needs no new teardown path.

**`useVehiclePositionsData(filter, options, enabled)`** — needs a real fix, not just a guard.
Today the hook calls `subscriptionClient.iterate(...)` unconditionally
(`useVehiclePositionsData.ts:105`) and only afterwards checks
`if (filter && filter.boundingBox)` before consuming it. A subscription is therefore opened
even when nothing ever reads it. The `iterate` call moves inside the guard, which fixes that
pre-existing leak as well as implementing the gate.

**`useSituationLineGeometry` is unaffected.** It issues one-off `graphql-request` queries
rather than using the subscription, so situations keep their borrowed line geometry with no
vehicle feed running. Its per-line-ref cache is a `useRef`, so it only survives a mode
round-trip if the provider stays mounted — therefore `SituationsProvider` stays mounted in
both modes and merely stops subscribing. Unmounting it would re-fetch every line ref on every
return to situations mode.

## Map layers across a mode switch

All 14 layers and every source are declared **statically in `src/components/mapStyle.ts`**.
Components never add or remove layers; they only call `source.setData(...)`. Nothing
unmounts, so `map.setLayoutProperty(...)` cannot go stale or throw on a missing layer, and no
declarative-visibility rewrite is required.

What is required is a single effect, keyed on mode, that:

1. sets `visibility: "none"` on every layer belonging to the outgoing mode;
2. reapplies the incoming mode's **switch-owned** layer visibility from `mapViewOptions`, so
   switching back restores the switches the user had set;
3. calls `setData(EMPTY_FEATURE_COLLECTION)` on the outgoing mode's sources, so hidden
   geometry is not retained in memory.

Step 2 is deliberately limited to switch-owned layers. Layers whose visibility is owned by
component state rather than by a switch must be left hidden on entry and allowed to reveal
themselves when that state next says so — reapplying them from `mapViewOptions` would read a
key that does not exist. Since selections are cleared on a mode switch (see the table below),
hidden is the correct entry state for all of them.

Layers by mode and owner:

- **Vehicles, switch-owned** (the seven in the Layers drawer): `vehicle-layer`,
  `vehicle-trace-layer`, `delay`, `vehicle-update-interval-icon-layer`,
  `vehicle-update-interval-skull-layer`, `vehicles-heatmap`, `occupancy-layer`
- **Vehicles, component-owned**: `service-journey-route-layer` (`RouteLayer`, driven by the
  selected service journey)
- **Vehicles, dormant**: `vehicle-follow-layer` and `vehicle-update-interval-text-layer` are
  declared `visibility: "none"` in `mapStyle.ts` and referenced nowhere else in `src/` —
  nothing currently turns them on. They are assigned to vehicles mode for completeness, not
  revived. Reviving or removing them is out of scope.
- **Situations, switch-owned**: `situation-lines-layer`, `situation-points-layer`
- **Neither**: `osm` (the base map, always visible)

Sources by mode:

- **Vehicles**: `vehicles`, `vehicleTraces`, `serviceJourneyRoute`
- **Situations**: `situationLines`, `situationPoints`
- **Neither**: `osm` (raster tiles, not a GeoJSON source and never cleared)

## Switching modes: what persists, what resets

| State                                          | On switch                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `codespaceId`                                  | **Persists** — the one filter that means the same to both, already in the URL                              |
| `operatorRef`, `maxDataAge`                    | Persist in state; only rendered in vehicles mode                                                           |
| Situation facets (`SituationFilter`)           | Persist — cheap, and losing them on each switch would be annoying                                          |
| `selectedVehicle`                              | Cleared on leaving vehicles mode                                                                           |
| `selected` situation                           | Cleared on leaving situations mode                                                                         |
| Vehicle `CacheMap`                             | Dropped on leaving vehicles mode — entries are TTL'd against `maxDataAge` and would all be stale on return |
| Situations map (`situationNumber` → situation) | Dropped with the subscription; it has no TTL and would otherwise present a frozen snapshot as live         |
| `useSituationLineGeometry` cache               | **Persists** — provider stays mounted; re-fetching every line ref per switch is the cost being avoided     |

## What gets deleted

**The affected-vehicle halos.** They require both feeds live, which two mutually exclusive
modes make impossible. Removing:

- `AFFECTED_VEHICLES_LAYER` and its reapplication rule (`MapLayers.tsx:57-63`)
- the `situation-affected-vehicles-layer` layer and `situationVehicles` source in `mapStyle.ts`
- the `vehicles` prop on `SituationLayers` and the halo feature block (`SituationLayers.tsx:109-123`)

This reverses commits `2ed42b2` ("Hide the affected-vehicle halos when vehicles are hidden")
and `766de7f` ("Stop the affected-vehicle halos blinking"). It is the only place the two
feeds were ever drawn together, and it is the acknowledged cost of the split. No replacement
readout is in scope; "which vehicles does this situation affect right now" is a separate ask
if it is wanted back.

**`MapViewOptions.showSituations`**, as above.

## What explicitly stays

`SelectedVehiclePanel`'s situation lists stay, in vehicles mode. Those `Situation` objects
arrive on `EstimatedTimetableUpdate.situations` and `Call.situations` from the **timetable**
subscription for the selected journey — not from the national situations feed. They are trip
deviation messages attached to a vehicle, so they belong to the vehicle flow. The mode split
is between the two _feeds_, not between the two _topics_.

This means `SituationFields` in `src/hooks/situationFragments.ts` remains in use in both
modes, and the invariant that adding a field there also adds it to the timetable query is
unchanged.

## Structure

New pure module `src/domain/appMode.ts`, holding everything derivable from a mode:

```ts
export type AppMode = "vehicles" | "situations";

/** Every layer the mode owns — hidden wholesale when the mode is left. */
export const MODE_LAYERS: Record<AppMode, string[]>;
/** The subset driven by a MapViewOptions key — reapplied when the mode is entered. */
export const MODE_SWITCHED_LAYERS: Record<
  AppMode,
  Record<string, keyof MapViewOptions>
>;
export const MODE_SOURCES: Record<AppMode, string[]>;
export function rightRailTools(mode: AppMode): RightContentType[];
export function isVehicleFeedEnabled(mode: AppMode): boolean;
export function isSituationsFeedEnabled(mode: AppMode): boolean;
```

Keeping this in a plain `.ts` module is deliberate: `vitest.config.ts` sets
`include: ["src/**/*.test.ts"]`, so logic that lives in a `.tsx` component cannot be tested at
all. The table is also the natural place for the layer and source lists the mode-switch effect
needs, so the effect stays a few lines of imperative glue over tested data.

Changed components:

- `App.tsx` — owns `mode`, passes it down, gates both hooks
- `useFilterQueryParams.ts` — reads and writes `?mode=`
- `MapView.tsx` — renders each mode's map children and panels; hosts the mode-switch effect
- `ModeSwitch.tsx` (new) — the segmented control
- `RightMenu/RightMenuButtons.tsx`, `RightMenu/DrawerContent.tsx` — rail and drawers per mode
- `LeftMenu/LeftMenu.tsx` — hidden in situations mode
- `MapLayers.tsx` — split into the two per-mode switch lists; halo rule removed
- `FilterBox.tsx` — per-mode contents
- `SituationsPanel.tsx` — `SituationFilters` removed from it
- `SituationLayers.tsx` — halo block and `vehicles` prop removed
- `mapStyle.ts` — halo layer and source removed
- `types.ts` — `MapViewOptions.showSituations` removed

## Testing

`vitest.config.ts` uses `environment: "node"` and collects only `src/**/*.test.ts`, so
component tests are not available and the design does not pretend otherwise.

**Unit (`src/domain/appMode.test.ts`)** — table-driven over both modes:

- every layer id in `MODE_LAYERS` exists in `mapStyle.ts`, and every non-`osm` layer in
  `mapStyle.ts` is claimed by exactly one mode (this is the test that catches a layer added
  later and never assigned, which would leave it stuck visible across modes)
- same completeness check for `MODE_SOURCES`, excluding the raster `osm` source
- `MODE_SWITCHED_LAYERS` is a subset of `MODE_LAYERS` for each mode, and every
  `MapViewOptions` key maps to exactly one layer — which catches a switch added to the drawer
  without a mode assignment
- the two feed-enabled predicates are mutually exclusive and total

These tests import `mapStyle` directly. It is a plain `.ts` module with no React or DOM
dependency, so it loads under `environment: "node"`.

**Playwright smoke (`tests/smoketests.spec.ts`)** — one test that switches to situations mode
and asserts the rail swapped (info and data-report buttons gone, situations button present)
and the situations panel opens. Playwright is not run in CI (`.github/workflows/build.yml`
runs `npm test`, `npm run check`, `npm run build` only), so this is a local-confidence test,
not a gate.

**Manual verification** — the data-cost claim is the whole point of the change, so it gets
checked directly rather than asserted: with DevTools' WS frame inspector open, confirm that
in vehicles mode no `situations` frames arrive, and in situations mode no `vehicles` frames
do.

## Out of scope

- Any replacement for the affected-vehicle halos
- Bounding-box filtering for situations (the subscription does not accept `boundingBox`)
- Changing what either feed requests
- Persisting mode anywhere other than the URL
