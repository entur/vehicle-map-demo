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
7. Separately from the vehicle pipeline, `SituationsProvider` (wrapping `<MapView>` in `App`) opens an **unfiltered** national `situations` subscription via `useSituationsSubscription`, keyed by `situationNumber` with latest-wins and no TTL. It stays mounted in both modes but only subscribes when `enabled` (`isSituationsFeedEnabled(mode)`) is true — see the geography section below for why it doesn't unmount in vehicles mode. Everything derived from it is pure and lives in `src/domain/`: `situationFlags` (three lifecycle flags), `situationFeatures` (affects → GeoJSON plus the unmappable list), `situationStats` and `situationFilter`. Consumers read the context via `useSituations` and are spread across four surfaces, each with one job: the map layer (`SituationLayers` inside `<Map>`), the right-menu situations drawer (`SituationsPanel` — status line, filtered list, `UnmappableList`), the right-menu filter drawer (`SituationFilters`, beside the codespace dropdown), and the "Feed report" rail entry (`SituationStatsTables`). The selected situation's raw detail is a fifth: `SituationDetailPanel`, a left-anchored drawer over the map, mirroring what `SelectedVehiclePanel` is to a selected vehicle. Both share their geometry from `src/components/detailDrawer.ts` so the two cannot drift into looking like different kinds of surface. Keeping these apart is deliberate — one 250px column previously carried the live list, the raw dump, the unmappable list and the whole-feed statistics at once.

Key invariants worth preserving:

- The cache key combines `vehicleId` and `serviceJourneyId` so the same physical vehicle on different journeys is tracked separately, and traces don't bleed across journeys.
- The subscription is re-opened whenever `filter`, `mapViewOptions` or `enabled` changes (the previous async iterator is `.return()`ed first). Adding new subscription variables means adding them to the dependency array as well.
- The `maxDataAge` is sent to the server as an ISO 8601 duration string (`PT{n}S`) and is also used locally to compute cache TTL — keep these two uses in sync.
- The `situations` selection set is a single GraphQL fragment spread at both the timetable and the call level, so the two cannot drift apart.
- The `situations` root query and subscription are **hidden from introspection**, exactly like `timetables`. They validate and stream normally; do not conclude from an introspection dump that they are gone.
- `situations` is served with data only in **dev**. Staging and prod return an empty list, which the panel reports as "No situations published in this environment" — distinct from an error and from a filter matching nothing.
- Situation **stats tables and facet counts** are both computed over the feed narrowed by the map's codespace filter, and by nothing else. That mirrors the vehicles-mode Data report, which fetches its snapshot for one codespace. With a codespace selected the `byCodespace` table is therefore a single row — kept rather than hidden, since a table that disappears reflows the grid and removes the confirmation of scope, and the cross-codespace view now lives in the codespace dropdown, which lists every codespace with its count. The report states its own scope in its subheading so a slice is never mistaken for the whole feed.
- Situation **facet counts** are scoped to the map's codespace filter, but never to the panel's own facets. `facetCounts(all, withinCodespace, flags)` takes both: `all` supplies the set of values offered, so a chip never disappears as you narrow, and `withinCodespace` supplies the counts. Scoping to codespace is not circular — it is a separate control, so severity counts within it stay meaningful. Scoping to `filter` would be: selecting `severe` would recompute severity to `severe: N, everything else 0`, describing nothing but the click that produced it. Never pass a `filter`-narrowed set as the second argument.
- Facet chips are ordered by a fixed rule, not by count, so they hold position as counts change: severities ascend by `SEVERITY_RANK` (exported from `situationSeverity.ts` — one table, shared with `worstSeverity`, so a chip order and a worst-of comparison cannot disagree), report types alphabetically, flags in `FILTERABLE_FLAGS` order, and `(none)` always last.
- `FILTERABLE_FLAGS` is the subset of flags offered as facets. `notYetActive` is deliberately excluded: a situation that has not started yet is still relevant, so the panel should not invite you to slice it away. It stays in `FLAG_LEVEL` because rows and the detail view still badge it.
- The codespace rule lives in one place, `matchesCodespace`, shared by `applySituationFilter` and the facet-count subset. If those two drifted, the counts would contradict the list they describe.
- The right drawer has two widths. `isWideTool` (`src/domain/appMode.ts`) marks the tools whose content does not fit the default 250px — currently only the feed report, six count tables that stack into an unreadable scroll in a narrow column. The width lives in three CSS rules that must change together: `.right-menu-container.open.wide`, `.sidebar-button.right.open.wide` and `.mode-switch.open.wide`. Change one and the rail or the mode switch ends up sitting on top of the drawer.
- **The two feeds publish different codespaces, so each mode offers its own list.** `useCodespaces()` queries the API's `codespaces` root; measured on dev it matches the vehicle feed exactly (20 for 20), but situations come from a partly different set of 16. Seven situation codespaces are absent from that root — including RUT and NSB, the two largest publishers, together about three quarters of the feed — while eleven of its entries carry no situations at all. Offering one list for both made most of the situations feed unreachable and most of the options empty. Situations therefore derive their options from `feedCodespaceCounts` — a tally over the **whole** feed, deliberately separate from `stats.byCodespace`, which is scoped to the selected codespace. Building the dropdown from the scoped tally collapses it to the codespace already selected and strands the user there with no way back. vehicles keep `useCodespaces()`. See `src/domain/codespaceOptions.ts`, which also drops the `(none)` bucket — `matchesCodespace` compares against a real id, so an option for it would match nothing — and injects a selected codespace the current mode's list lacks, since codespace survives a mode switch and the `Select` would otherwise hold a value with no matching item.
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
