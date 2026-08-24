# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

React + TypeScript + Vite SPA that visualizes Entur's realtime vehicle positions on a MapLibre map. Data comes from Entur's GraphQL realtime vehicles API — primarily over a `graphql-ws` subscription, with `graphql-request` used for one-off snapshot queries.

## Commands

- `npm run dev` — start Vite dev server on http://localhost:5173
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — ESLint over the project
- `npm run check` — Prettier check (one of the two CI gates alongside `npm test`; `lint` is not gated)
- `npm run format` — Prettier write
- `npm test` — Vitest unit tests (`vitest run`), currently covering the pure helpers in `src/components/SelectedVehiclePanel/`
- `npx playwright test` — run Playwright smoke tests (auto-starts `npm run dev`)
- `npx playwright test tests/smoketests.spec.ts -g "has map"` — run a single test by title
- `npx playwright test --project=chromium` — run only one browser project

CI (`.github/workflows/build.yml`) runs `npm test` in a `test` job, then `npm run check` and `npm run build` in a `build` job gated on it (`needs: test`) — it does **not** run `lint` or Playwright. A Husky pre-commit hook runs `lint-staged` → Prettier on staged files.

`vitest.config.ts` sets `environment: "node"` and `include: ["src/**/*.test.ts"]`, so component (`.tsx`) tests are not collected — keep testable logic in plain `.ts` modules.

## Runtime config (bootstrap.json)

The app does **not** use Vite env vars for endpoints. Instead, `src/main.tsx` fetches `/bootstrap.json` at startup and provides it via `ConfigContext`. All hooks read endpoints (`vehicle-positions-graphql-endpoint`, `vehicle-positions-subscriptions-endpoint`, `vehicle-positions-et-client-name`) from this context — see `src/config/ConfigContext.ts` and `src/hooks/useRequestHeaders.ts`.

- Local dev: `public/bootstrap.json` is served as-is (currently points at `api.dev.entur.io`). Edit it to point at a different backend; do not commit personal client names.
- Deploys: `.github/workflows/deploy.yml` copies `.github/environments/config-{dev,staging,prod}.json` to `dist/bootstrap.json` before Firebase Hosting deploy. Add or change endpoints in those files, not in code.

When introducing a new config key, update the `Config` interface in `ConfigContext.ts` and every `config-*.json` in `.github/environments/` plus `public/bootstrap.json`.

## Data flow

1. `App` holds three pieces of state: `mode: AppMode`, `currentFilter: Filter | null` and `mapViewOptions`. Mode decides which of the two GraphQL subscriptions is open (see `src/domain/appMode.ts`) and is synced to the URL as `?mode=` by `useModeQueryParam`, independently of `useFilterQueryParams`.
2. `CaptureBoundingBox` (rendered inside `<Map>`) listens to map `moveend` and writes the viewport bbox into `currentFilter.boundingBox` (throttled 500ms).
3. `useFilterQueryParams` syncs `currentFilter` (minus `boundingBox`) to/from URL query params — so shareable links preserve codespace/operator/maxDataAge but not the viewport. The codespace in such a link narrows situations as well as vehicles.
4. `useVehiclePositionsData(filter, mapViewOptions, enabled)` opens a `graphql-ws` subscription via `useSubscriptionClient`, gated by `enabled` (`isVehicleFeedEnabled(mode)`) so it only runs in vehicles mode. Incoming `VehicleUpdate`s are written into a `CacheMap` keyed by `vehicleId + "_" + serviceJourney.id`, with a per-entry TTL computed as `maxDataAge - (now - lastUpdated)` so stale vehicles auto-expire. The filter is also re-applied client-side before pushing to state.
5. `MapView` renders markers (`VehicleMarkers`), optional traces (`VehicleTraces`), popups (`VehiclePopup`), and the `LeftMenu`/`RightMenu` overlays. Selecting a vehicle in the popup can open `useVehicleUpdateCompleteSubscription` for richer per-vehicle details.
6. Selecting a vehicle also opens `useTimetableSubscription(serviceJourneyId, date)`, whose `timetables` frames carry deviation messages as `Situation` objects in two places: `EstimatedTimetableUpdate.situations` (trip-wide) and `Call.situations` (one stop). Both render through the same `SituationList` component. Situations are shown exactly as delivered — no deduplication, no severity filtering — because the demo exists to expose what the feed actually contains; `situationNumber` and `version` are displayed so a version regression in the eventually-consistent stream stays visible.
7. Separately from the vehicle pipeline, `SituationsProvider` (wrapping `<MapView>` in `App`) opens an **unfiltered** national `situations` subscription via `useSituationsSubscription`, keyed by `situationNumber` with latest-wins and no TTL. It stays mounted in both modes but only subscribes when `enabled` (`isSituationsFeedEnabled(mode)`) is true — see the geography section below for why it doesn't unmount in vehicles mode. Everything derived from it is pure and lives in `src/domain/`: `situationFlags` (three lifecycle flags), `situationFeatures` (affects → GeoJSON plus the unmappable list), `situationStats` and `situationFilter`. Two consumer trees read the context via `useSituations` — the map layer (`SituationLayers` inside `<Map>`) and the panel tree in the right-menu drawer, where `SituationsPanel`, `SituationStatsTables`, `SituationFilters` and `UnmappableList` each call it directly.

Key invariants worth preserving:

- The cache key combines `vehicleId` and `serviceJourneyId` so the same physical vehicle on different journeys is tracked separately, and traces don't bleed across journeys.
- The subscription is re-opened whenever `filter`, `mapViewOptions` or `enabled` changes (the previous async iterator is `.return()`ed first). Adding new subscription variables means adding them to the dependency array as well.
- The `maxDataAge` is sent to the server as an ISO 8601 duration string (`PT{n}S`) and is also used locally to compute cache TTL — keep these two uses in sync.
- The `situations` selection set is a single GraphQL fragment spread at both the timetable and the call level, so the two cannot drift apart.
- The `situations` root query and subscription are **hidden from introspection**, exactly like `timetables`. They validate and stream normally; do not conclude from an introspection dump that they are gone.
- `situations` is served with data only in **dev**. Staging and prod return an empty list, which the panel reports as "No situations published in this environment" — distinct from an error and from a filter matching nothing.
- Situation stats and facet counts are computed over the **unfiltered** set. Recomputing them over the filtered set would collapse every count to match the current selection and make the readouts useless.
- Codespace is filtered from **one** control: the map's `Filter.codespaceId`, passed into `SituationsProvider` as a prop and applied by `applySituationFilter` as a strict equality check. The panel deliberately has no codespace facet — do not add one back to `SituationFilter`, or the two controls will contradict each other. A situation carrying no codespace drops out whenever a codespace is selected; its count stays visible in `situationStats.byCodespace`, which is computed over the whole feed.
- Situation features are deduplicated **within** a situation only. Two situations affecting one stop deliberately produce two coincident features; collapsing them would hide the duplication this tool exists to expose.
- `SituationFields` and `SituationQaFields` in `src/hooks/situationFragments.ts` both target the GraphQL `Situation` type. The timetable subscription spreads only the first, at two levels; the situations subscription spreads both. Adding a field to `SituationFields` therefore adds it to the timetable query as well.
- The vehicle and situations feeds are mutually exclusive — only the active mode's subscription runs (`isVehicleFeedEnabled`/`isSituationsFeedEnabled` in `src/domain/appMode.ts`). Anything needing both live at once — the affected-vehicle halos, removed when modes were introduced — cannot work under this design.
- Every layer and source declared in `mapStyle.ts` must be claimed by exactly one mode in `MODE_LAYERS`/`MODE_SOURCES` (`src/domain/appMode.ts`), and every mode-owned layer must fall into exactly one of `MODE_SWITCHED_LAYERS` (visibility driven by a `MapViewOptions` key), `MODE_DEFAULT_VISIBLE_LAYERS` (no switch, but must be visible whenever the mode is active because content is governed by the source's data or a feature filter, not a toggle — e.g. `service-journey-route-layer`, `vehicle-follow-layer`) or `MODE_DORMANT_LAYERS` (genuinely inert, `visibility: "none"` and driven by nothing). `appMode.test.ts` enforces both as total partitions — a layer added to `mapStyle.ts` without being classified fails the build rather than being silently hidden forever whenever its mode is left. You cannot classify a layer by grepping for its id: a filter-driven layer (like `vehicle-follow-layer`, gated by `["==", ["get", "followed"], true]`) is live with no reference to its id anywhere outside `mapStyle.ts`. Check whether it carries a `visibility` key and what feeds its source before assuming "unreferenced" means "dormant" — miscategorizing one this way is what stranded a layer hidden after a mode round trip twice during development.
- `ModeLayers` reconciles layer visibility on MapLibre's `'idle'` event, not `'load'`. `'load'` fires once per Map instance, but `isStyleLoaded()` can go false again later, so a `once("load")` fallback can end up waiting forever and silently drop a mode switch; `'idle'` fires every time the map settles and so keeps firing on later effect runs too.

## Map / icons

- `react-map-gl` uses the `maplibre` entry point (`react-map-gl/maplibre`), not Mapbox. The style is defined inline in `src/components/mapStyle.ts` and uses Entur's tile/style endpoints — no Mapbox token is needed.
- SVG vehicle icons are loaded via `vite-svg-loader` (see `vite.config.ts` and `src/components/RegisterIcons.tsx`). New icons need to be registered there to be available as map symbols.

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
session. This cache is why `SituationsProvider` stays mounted (subscription
merely paused) rather than unmounting in vehicles mode — unmounting would
throw the cache away and force every line to re-resolve on the next switch
back to situations mode.

Measured on dev: 108 of 581 situations place on the map. 319 of the remainder
reference only dated service journeys. Prod carries far better `pointsOnLink`
coverage (87% of vehicles versus 31% on dev), so the same code would place
roughly 223 there — but prod serves no situations at all today.

Do not "fix" the low coverage by inventing centroids or by falling back to
Journey Planner. Staying on one API is a project constraint, and a synthetic
position would be worse than an honest absence in a data-QA tool.

## TypeScript / lint conventions

- ESM only (`"type": "module"`). Local imports include the explicit `.ts`/`.tsx` extension — match the existing style when adding imports.
- TS config is split: `tsconfig.app.json` for app source, `tsconfig.node.json` for Vite config. `tsc -b` is the build orchestrator.
- ESLint config (`eslint.config.js`) uses the flat-config format with `typescript-eslint` and `react-hooks` recommended rules plus `react-refresh/only-export-components`. Don't add component files that also export non-component values.
