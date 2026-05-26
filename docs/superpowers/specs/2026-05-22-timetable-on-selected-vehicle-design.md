# Timetable on selected vehicle — design

## Context

The Entur realtime vehicle GraphQL API (used at `vehicle-positions-graphql-endpoint` /
`vehicle-positions-subscriptions-endpoint`) was extended with a `timetables` query and
subscription that returns `EstimatedTimetableUpdate` objects. Each update carries the full
per-stop calling pattern for a trip — both scheduled (`aimed*`) and real-time
(`expected*` / `actual*`) times, plus per-call and trip-level cancellation. The fields are
flagged `Experimental` in the schema introspection, so the shape may evolve.

The vehicle-map-demo currently shows a small popup when a vehicle marker is clicked, with
basic identifying info and a "Details" button to a flat-field dialog. Nothing in the demo
visualises the per-stop timetable. This spec covers a new side panel that shows the live
timetable and route polyline for the selected vehicle.

## Goals

- When a vehicle is selected, show the trip's per-stop timetable with live real-time
  predictions, plus the trip's route polyline on the map.
- Reuse the existing selection state (`selectedVehicle` in `MapView`) so popup, panel, and
  route layer share one lifecycle.
- Make the new code easy to remove or evolve while the `timetables` schema is
  experimental: tight field selections, isolated hooks, no schema-wide refactor.

## Non-goals (v1)

- Clicking a stop row to fly the map to that stop's location.
- Per-stop occupancy or boarding-activity display.
- Showing multiple selected vehicles or their timetables in parallel.
- Caching timetable results across selections.
- Surfacing subscription errors / retry state in the UI beyond what `graphql-ws` does on
  its own.
- Adding a unit-test framework. The existing CI gates (`tsc -b` and `prettier --check`)
  cover the new code.

## UX overview

A user clicks a vehicle marker:

1. The existing popup opens (Follow / Details buttons unchanged).
2. A persistent right-side drawer slides in showing:
   - Header: line public-code badge, `originName → destinationName`, mode/operator/codespace,
     and a × close button.
   - Optional red "Trip cancelled" banner when the trip itself is cancelled.
   - Live delay status line ("On time" / "+N min late" / "-N min early"), colour-coded.
     Sourced from `VehicleUpdateComplete.delay` (the existing complete-vehicle
     subscription); renders blank until the first frame arrives.
   - Scrollable list of all stops on the trip, auto-scrolled to the row whose `order`
     matches `monitoredCall.order`. If `monitoredCall` is absent, scrolls to the first
     `callType=ESTIMATED` row instead.
3. The trip's polyline route is rendered on the map.

Closing the panel (×, picking another vehicle, or deselecting) tears down the timetable
subscription and removes the route polyline.

### Row layout

Each stop row uses the "stacked times" pattern: aimed time on top in small grey, expected
time below in bold. When the two match, only one time renders. A left-side timeline column
draws past/now/future dots connected by a line. The "now" dot is the teal vehicle colour
with a black border; past/future dots are progressively darker greys. Cancelled rows
strike through the stop name and show an em-dash for time.

Colour thresholds (used for both the per-stop expected time and the live delay status
line):

- `|delay| < 60s` → neutral text colour ("on time").
- `delay >= 60s` → `#c0392b` (late).
- `delay <= -60s` → `#2980b9` (early).

The thresholds live in a single module so future tuning is one edit.

## Architecture

### New components

- **`SelectedVehiclePanel`** — MUI `Drawer` with `anchor="right"`, `variant="persistent"`,
  `open={selectedVehicle !== null}`, width `min(420px, 90vw)`. Composes the three data
  hooks below and renders the header, banner, status line, and `Timetable`.
- **`Timetable`** + **`StopRow`** — list view of `EstimatedTimetableUpdate.calls`.
  `Timetable` is responsible for scrolling the current/next call into view on first
  render via a ref + `scrollIntoView({ block: "center" })`. `StopRow` renders the timeline
  column, time column, and name column.
- **`RouteLayer`** — child of `<Map>`, declares a MapLibre `Source`/`Layer` pair from a
  decoded GeoJSON `LineString`. Mounted only while a vehicle is selected. Style:
  `line-color: #1fcac2`, `line-width: 4`, `line-opacity: 0.85`. When the trip is
  cancelled, switch to `line-dasharray: [2, 2]`.

### New hooks

- **`useTimetableSubscription(serviceJourneyId, date)`** — opens
  `Subscription.timetables(serviceJourneyIdAndDates: [{ serviceJourneyId, date }])` via
  the existing `useSubscriptionClient`. Same async-iterator-with-`.return()` lifecycle
  as `useVehiclePositionsData` and `useVehicleUpdateCompleteSubscription`. Returns the
  latest `EstimatedTimetableUpdate` (we only ever subscribe to a single trip, so we read
  `timetables[0]` from each frame).
- **`useServiceJourneyRoute(serviceJourneyId)`** — one-shot `graphql-request` query for
  `serviceJourney(id) { pointsOnLink { points length } }` using
  `vehicle-positions-graphql-endpoint` and the `Et-Client-Name` header. Uses an
  `AbortController` so a slow response from a previous selection cannot overwrite the
  current selection's state. Decodes `points` (Google polyline format) into
  `number[][]` and memoises.

### New utility

- **`src/utils/decodePolyline.ts`** — Google polyline format decoder, ~30 lines, no new
  dependency. Matches the existing pattern of small focused utils in `src/utils/`.

### Existing code touched

- **`useVehiclePositionsData.ts`** — extend the inline `subscriptionQuery` to select
  `serviceJourney { id date }` instead of `serviceJourney { id }`. The cache in
  `CacheMap` continues to use `vehicleId + "_" + serviceJourneyId` as the key.
- **`types.ts`** — extend `VehicleUpdate` and `ServiceJourney` to include `date`. Add
  the new types listed in the "Types" section.
- **`VehicleMarkers.tsx`** — the `SelectedVehicle` properties shape gains a
  `date: string` field alongside `id` and `serviceJourneyId`.
- **`MapView.tsx`** — render `<SelectedVehiclePanel ... />` and `<RouteLayer ... />`
  alongside the existing popup whenever `selectedVehicle !== null`.

The existing `useVehicleUpdateCompleteSubscription` is **not** modified — the panel reads
its `delay` and `monitoredCall.order` for the live status line and current-stop indicator,
but the timetable subscription is keyed independently on `serviceJourney.id`.

## Data flow

### On selection

1. User clicks a vehicle marker. `MapView` sets `selectedVehicle = { id, serviceJourneyId, date, coordinates }` (the existing flow, with `date` newly carried through from `VehicleUpdate`).
2. `VehiclePopup` mounts and opens `useVehicleUpdateCompleteSubscription` (existing behaviour, unchanged).
3. `SelectedVehiclePanel` mounts. It immediately calls:
   - `useTimetableSubscription(serviceJourneyId, date)` → opens
     `Subscription.timetables(serviceJourneyIdAndDates: [{ serviceJourneyId, date }])`.
   - `useServiceJourneyRoute(serviceJourneyId)` → fires the one-shot query.
4. Header and loading skeleton render. As timetable frames arrive, the `Timetable`
   component re-renders. When the route query resolves, the `RouteLayer` mounts.

### Current-stop indicator

The "now" row is the one whose `call.order` matches `monitoredCall.order` from the
existing complete-vehicle subscription. In practice this is either the stop the vehicle is
currently at (when `monitoredCall.vehicleAtStop` is true) or the next one it's approaching
— the API doesn't distinguish further and the row treatment is the same either way.

Everything with `callType=RECORDED` renders as past (greyed); `callType=ESTIMATED` renders
as upcoming. If `monitoredCall` is absent, no row gets the "now" marker — past/future
styling still works from `callType`.

### On switching selection

The input keys to the three hooks change. Each hook's effect:

- Subscription hooks: `.return()` the previous async iterator, then open a new one with the
  new variables.
- Route query hook: aborts the previous request via `AbortController`, then fires a new one.

This mirrors the existing pattern at
`src/hooks/useVehiclePositionsData.ts:88-91` and
`src/hooks/useVehicleUpdateCompleteSubscription.ts:82-85`.

### On deselect / panel close

`selectedVehicle = null` → panel and `RouteLayer` unmount → their cleanup callbacks
`.return()` the timetable subscription and abort any in-flight route query. The
complete-vehicle subscription is cleaned up by the popup unmount path (existing
behaviour).

### Loading / empty / failure states

- **Loading**: header and skeleton rows render immediately on selection.
- **Missing `serviceJourney.id`** on the selection (shouldn't happen in practice, but
  defensive): panel renders the "Timetable not available for this trip" inline message
  immediately and skips opening the subscription.
- **No timetable frames within ~3s** of opening the subscription: same inline "Timetable
  not available" message. The panel stays open so the header info remains useful.
- **`pointsOnLink` is `null` or `points` is empty**: skip the `RouteLayer` mount. No error
  UI — the timetable is the primary content.
- **WS disconnect mid-trip**: rely on `graphql-ws` retry behaviour from
  `useSubscriptionClient`. The panel keeps showing the last frame received. No new error
  UI in v1.

## Types

Added to `src/types.ts`:

```ts
export type Stop = {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
};

export type CallType = "RECORDED" | "ESTIMATED";

export type Call = {
  stopPoint: Stop;
  order: number;
  aimedArrivalTime: string | null;
  aimedDepartureTime: string | null;
  expectedArrivalTime: string | null;
  expectedDepartureTime: string | null;
  actualArrivalTime: string | null;
  actualDepartureTime: string | null;
  callType: CallType;
  cancellation: boolean;
  forBoarding: boolean | null;
  occupancyStatus: OccupancyStatus | null;
};

export type EstimatedTimetableUpdate = {
  serviceJourney: ServiceJourney;
  line: Line;
  mode: VehicleModeEnumeration;
  originName: string;
  destinationName: string;
  cancellation: boolean;
  calls: Call[];
};

export type RoutePolyline = {
  coordinates: number[][]; // [lng, lat] pairs, decoded from PointsOnLink.points
  length: number | null;
};
```

`ServiceJourney` already has `id`; `date` is added in the same edit. `VehicleUpdate.serviceJourney`
already returns `ServiceJourney`, so adding `date` to the query and the type propagates
automatically.

We deliberately do **not** add every `EstimatedTimetableUpdate` field returned by the API —
only what the panel needs. The schema is flagged Experimental and a tight selection set is
cheap insurance against churn.

## Edge cases

- **Missing per-stop `expectedArrivalTime` / `expectedDepartureTime`**: row falls back to
  the aimed time (single line, neutral colour). If both aimed and expected are null,
  render the stop name only with `—` placeholder.
- **`monitoredCall.order` not matching any `calls[].order`**: no row gets the "now"
  marker. The timeline column still renders past/future based on `callType`.
- **Trip-wide cancellation** (`EstimatedTimetableUpdate.cancellation === true`): red
  banner above the timetable, upcoming-row dots rendered dimmer, route polyline rendered
  with `line-dasharray: [2, 2]`.
- **Per-call cancellation** (`call.cancellation === true`): strike-through stop name,
  em-dash for time, dot rendered as a hollow circle so it's distinguishable at a glance.
- **Selecting the same vehicle twice**: no-op — input keys to the three hooks are unchanged.
- **Rapid selection switching**: each switch fires the cleanup-then-open pattern noted in
  the data flow section. The one-shot route query needs `AbortController` so a slow
  previous response can't overwrite current state.
- **Long trips (50+ stops)**: render all rows without virtualisation. DOM cost is small;
  skip `react-window` in v1.
- **Map filter excludes the trip's stops**: the timetable and route polyline are
  independent of the map's bbox/codespace/operator filter, so they render regardless. The
  vehicle marker may scroll off-map while the panel remains open — expected behaviour.

## Time formatting

Display in the user's local timezone via `Intl.DateTimeFormat` with
`{ hour: "2-digit", minute: "2-digit" }`. The schema's `DateTime` scalar is ISO-8601,
which `new Date()` parses correctly.

## Testing

- **TypeScript / Prettier**: the existing CI gates (`build.yml` runs `npm run check` and
  `npm run build`). All new code is covered.
- **Playwright smoke test**: extend `tests/smoketests.spec.ts` with a test that loads the
  app, waits for at least one vehicle marker, clicks it, and asserts the side panel and at
  least one stop row become visible within 5s. Playwright is not wired into CI, so this is
  for local verification — document in the PR description.
- **Manual checklist** in the PR description:
  - open panel for a normal trip,
  - switch between two vehicles quickly,
  - close the panel, reopen it,
  - if findable in dev, trigger a known-cancelled trip,
  - scroll a long trip (regional rail),
  - confirm the route polyline renders and disappears with the panel.
- **No unit-test framework** is introduced. The polyline decoder is the one piece of pure
  logic worth a unit test someday; for now it stays small enough to eyeball against a
  known reference such as `@mapbox/polyline`'s output.

## Out of scope (deferred to follow-ups)

- Clicking a stop row → fly map to `Stop.location`.
- Per-stop occupancy and boarding-activity badges.
- Showing multiple selected vehicles in parallel.
- Caching timetable results across selections.
- Surfacing subscription errors / retry state in the UI.
- Adding a unit-test framework.
