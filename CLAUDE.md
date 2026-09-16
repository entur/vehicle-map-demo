# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

React + TypeScript + Vite SPA that visualizes Entur's realtime vehicle positions on a MapLibre map. Data comes from Entur's GraphQL realtime vehicles API — primarily over a `graphql-ws` subscription, with `graphql-request` used for one-off snapshot queries.

## Commands

- `npm run check` — Prettier check (one of the two CI gates alongside `npm test`; `lint` is not gated)
- `npx playwright test` — run Playwright smoke tests (auto-starts `npm run dev`)

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
5. `MapView` renders markers (`VehicleMarkers`), optional traces (`VehicleTraces`), popups (`VehiclePopup`), and the `RightMenu` overlay. Selecting a vehicle in the popup can open `useVehicleUpdateCompleteSubscription` for richer per-vehicle details.
6. Selecting a vehicle also opens `useTimetableSubscription(serviceJourneyId, date)`, whose `timetables` frames carry deviation messages as `Situation` objects in two places: `EstimatedTimetableUpdate.situations` (trip-wide) and `Call.situations` (one stop). Both render through the same `SituationList` component. Situations are shown exactly as delivered — no deduplication, no severity filtering — because the demo exists to expose what the feed actually contains; `situationNumber` and `version` are displayed so a version regression in the eventually-consistent stream stays visible.
7. Separately from the vehicle pipeline, `SituationsProvider` (wrapping `<MapView>` in `App`) opens an **unfiltered** national `situations` subscription via `useSituationsSubscription`, keyed by `situationNumber` with latest-wins and no TTL. It stays mounted in both modes but only subscribes when `enabled` (`isSituationsFeedEnabled(mode)`) is true — the subscription pauses in vehicles mode rather than unmounting; unmounting is a separate change nobody has made. Everything derived from it is pure and lives in `src/domain/`: `situationFlags` (three lifecycle flags plus the structural `mistypedJourneyRef`, via `journeyRef`), `situationFeatures` (affects → GeoJSON plus the unmappable list), `situationStats` and `situationFilter`. Consumers read the context via `useSituations` and are spread across four surfaces, each with one job: the map layer (`SituationLayers` inside `<Map>`), the situations tool panel (`SituationsPanel` — status line, then the two halves of the filtered set: an "On the map" list and `UnmappableList`), the filter tool panel (`SituationFilters`, beside the codespace dropdown), and the "Feed report" toolbar entry (`SituationStatsTables`). The selected situation's raw detail is a fifth: `SituationDetailPanel`, a floating card on the left of the map, mirroring what `SelectedVehiclePanel` is to a selected vehicle. Both take their geometry from `DETAIL_PANEL_SX` in `src/components/detailDrawer.ts` so the two cannot drift into looking like different kinds of surface. That geometry places the card beside MapLibre's top-left control stack using the stack's 12px inset in `index.css` and its 29px button width — change the inset in one place and the other must follow. Keeping these apart is deliberate — one 250px column previously carried the live list, the raw dump, the unmappable list and the whole-feed statistics at once.

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
- `situationFlags` composes two kinds of flag and the split is load-bearing. `timeFlags` returns nothing when a situation has no validity period — correct for flags defined relative to "now", fatal for one that is not. `mistypedJourneyRef` is therefore computed outside that guard: the situations carrying a bad ref are disproportionately thin elsewhere too, so folding it back inside would hide exactly the rows it exists to surface. Any future flag that does not depend on `now` goes beside it, not inside `timeFlags`.
- The codespace rule lives in one place, `matchesCodespace`, shared by `applySituationFilter` and the facet-count subset. If those two drifted, the counts would contradict the list they describe.
- The right side is one flex cluster in `RightMenu`: the mode pill, then the tool panel beside the toolbar. Nothing in it is positioned by hand, so opening, closing or widening a panel moves nothing else. `isWideTool` (`src/domain/appMode.ts`) marks the tools whose content does not fit the default 300px panel — currently only the feed report — and the panel is its only reader. Tool names live in `TOOL_LABELS` (`src/components/RightMenu/toolLabels.ts`) and double as the toolbar buttons' accessible names and the open panel's region name; the smoke tests find tools by them.
- **The two feeds publish different codespaces, so each mode offers its own list, each a tally of its own feed.** No catalogue matches either. The API's `codespaces` root once matched the vehicle feed, but since the backend moved to NeTEx planned data (entur/vehicle-positions #43) it lists every codespace with timetables — measured on dev, 61 against 21 in the vehicle feed — and still misses SKA, VAR and VOT, which publish about 30% of the vehicles. Situations come from a partly different set again: RUT and NSB, together about three quarters of that feed, publish no vehicles. Vehicles therefore derive their options from `useVehicleCodespaceCounts()`, an unfiltered `vehicles { codespace { codespaceId } }` snapshot fetched once on mount (about 300 KB on dev) — not from the live subscription, whose bbox would make the list change as the map pans. Do not go back to the `codespaces` root. Situations derive theirs from `feedCodespaceCounts` — a tally over the **whole** feed, deliberately separate from `stats.byCodespace`, which is scoped to the selected codespace. Building the dropdown from the scoped tally collapses it to the codespace already selected and strands the user there with no way back. See `src/domain/codespaceOptions.ts`, which also drops the `(none)` bucket — `matchesCodespace` compares against a real id, so an option for it would match nothing — and injects a selected codespace the current mode's list lacks, since codespace survives a mode switch and the `Select` would otherwise hold a value with no matching item.
- Codespace is filtered from **one** control: the map's `Filter.codespaceId`, passed into `SituationsProvider` as a prop and applied by `applySituationFilter` as a strict equality check. The panel deliberately has no codespace facet — do not add one back to `SituationFilter`, or the two controls will contradict each other. A situation carrying no codespace drops out whenever a codespace is selected; its count stays visible in `situationStats.byCodespace`, which is computed over the whole feed.
- The selected situation is singled out on the **style, not the data**: `SituationLayers` sets the filter of the two `situation-*-halo-layer`s and the opacity of the ordinary layers from `selected`, using the pure expressions in `src/domain/situationSelection.ts`. Never rebuild features with a `selected` property — `features` would then change identity on every selection and the fitBounds effect deliberately does not depend on it. The halo layers are classified in `MODE_DEFAULT_VISIBLE_LAYERS`, like `vehicle-follow-layer`: filter-driven, never toggled, so a selection stays pointed out even with "Affected stops"/"Affected lines" switched off. Resting opacities come from `SITUATION_LAYER_OPACITY` in `mapStyle.ts`, which both the style and the dimming expression read. A selection is dropped the moment it leaves the filtered set (`selectionWithin`, applied during render in `SituationsProvider`): a hidden selection would keep the detail panel open and dim every situation that is shown with nothing highlighted, so a codespace or facet change with a selection held reads as "new set, nothing selected".
- The situations panel's two lists are the two halves of **one** split, `partitionByMappability(filtered, features)`. Each filtered situation appears in exactly one of them, so a row is never both listed as drawn and listed as undrawable. Deriving the lists separately — the top one from `filtered`, the bottom from `features.unmappable` — is what previously showed every unmappable situation twice, once badged "not on map" and once under "Not on the map". The bottom rows carry severity and reportType as well as `affectsShape` because that list is now the only place those situations appear.
- Two effects in `SituationLayers` move the map, and both frame their subject through the same `boundsFor` walk: a selection (whether it came from the list or the map popup) and a codespace change. The codespace fit depends on `codespaceId` alone — `visible`, `features` and `selected` are read from the closure — so it fires when the user picks a codespace and not when a layer is toggled back on, and it yields to a held selection rather than fighting it for the view. Both leave the view untouched when there is nothing mappable to fit, so an empty result never throws the map at null island.
- Situation features are deduplicated **within** a situation only. Two situations affecting one stop deliberately produce two coincident features; collapsing them would hide the duplication this tool exists to expose.
- Situation **point features deduplicate on stop id alone** within a situation,
  across all four stop sources (`stopPoints`, `stopPlaces`,
  `vehicleJourneys[].stops`, `affectedLines[].stops`). One situation, one stop,
  one dot. Spans deduplicate separately, each kind on its own prefixed key
  space — `journeySpan:<journeyId>` and `lineSpan:<lineRef>` — which cannot
  collide with the bare stop ids the point sources use. Six sources in all.
  Dedup remains **within**
  a situation only — two situations affecting one stop still produce two
  coincident features, which is the duplication this tool exists to expose.
- `SituationFields` and `SituationQaFields` in `src/hooks/situationFragments.ts` both target the GraphQL `Situation` type. The timetable subscription spreads only the first, at two levels; the situations subscription spreads both. Adding a field to `SituationFields` therefore adds it to the timetable query as well.
- The vehicle and situations feeds are mutually exclusive — only the active mode's subscription runs (`isVehicleFeedEnabled`/`isSituationsFeedEnabled` in `src/domain/appMode.ts`). Anything needing both live at once — the affected-vehicle halos, removed when modes were introduced — cannot work under this design.
- Every layer and source declared in `mapStyle.ts` must either be base map (`BASE_LAYERS`/`BASE_SOURCES` in `src/domain/viewDimension.ts` — never touched by a mode switch) or be claimed by exactly one mode in `MODE_LAYERS`/`MODE_SOURCES` (`src/domain/appMode.ts`), and every mode-owned layer must fall into exactly one of `MODE_SWITCHED_LAYERS` (visibility driven by a `MapViewOptions` key), `MODE_DEFAULT_VISIBLE_LAYERS` (no switch, but must be visible whenever the mode is active because content is governed by the source's data or a feature filter, not a toggle — e.g. `service-journey-route-layer`, `vehicle-follow-layer`) or `MODE_DORMANT_LAYERS` (genuinely inert, `visibility: "none"` and driven by nothing). `appMode.test.ts` enforces both as total partitions — a layer added to `mapStyle.ts` without being classified fails the build rather than being silently hidden forever whenever its mode is left. You cannot classify a layer by grepping for its id: a filter-driven layer (like `vehicle-follow-layer`, gated by `["==", ["get", "followed"], true]`) is live with no reference to its id anywhere outside `mapStyle.ts`. Check whether it carries a `visibility` key and what feeds its source before assuming "unreferenced" means "dormant" — miscategorizing one this way is what stranded a layer hidden after a mode round trip twice during development.
- `ModeLayers` and `ViewDimensionLayers` apply their changes through `whenLayerExists` (`src/utils/whenLayerExists.ts`): run now if a known layer is in the style, otherwise on the first `styledata` where it is. Do not go back to `isStyleLoaded()` with a `'load'` or `'idle'` fallback. `isStyleLoaded()` waits for every source to finish loading, and streaming vehicle frames keep a GeoJSON source busy — measured, it stayed false and no `'idle'` arrived for 8 s, so toggles were silently dropped and the React state and the map disagreed. `'load'` is worse still: it fires once per Map instance.

## Theme

- One MUI theme (`src/components/theme.ts`) built with CSS theme variables: `colorSchemes` light and dark, selected by `data-mui-color-scheme="light|dark"` on `<html>` via the explicit selector `'[data-mui-color-scheme="%s"]'`. Do not switch to the `"data"` shorthand — it sets a bare `data-dark` attribute that the pre-load script does not set.
- Every palette value is a `--mui-palette-*` CSS variable, so plain CSS (MapLibre controls, popups, `.chase-hud` in `index.css`) follows the scheme. In `sx`, use palette paths for `color`/`bgcolor`/`borderColor` and `var(--mui-palette-…)` everywhere else.
- The chrome is neutral slate on purpose: the only saturated colours on screen should be data. `palette.selection` (`main`, `bg`) marks what is selected — the active tool, the selected row, the current stop — and nothing else.
- The toggle (`ColorSchemeToggle`, in the mode pill) cycles system → light → dark (`nextColorSchemeMode`). MUI persists the mode under `COLOR_SCHEME_STORAGE_KEY` (`vehicle-map-color-scheme`); the inline script in `index.html` reads the same key to set the attribute before the bundle loads. Change one, change both. The preference is deliberately not a query param: `useFilterQueryParams` would merge it into the `Filter` and the subscription variables.
- Every surface over the map is a `FloatingCard` (10px radius, `var(--floating-shadow)`, elevation 0 — MUI lightens elevated Paper in dark mode). `--floating-shadow` is defined once in `index.css`, with a stronger value for dark.
- Data colours (severity, delay, occupancy, route, selection halo, trace, edges) live in `src/domain/dataColours.ts` as one set tuned for both base maps, deliberately outside the MUI theme. No fill contrasts with both Positron and Fiord, so map marks get a **two-tone edge** — ink `EDGE_INK` inside, white `EDGE_WHITE` outside — as separate edge layers classified with their feature's switch (`situation-points-edge-layer`, `situation-lines-outer-casing-layer`, the two `service-journey-route-*-casing-layer`s), and fills sit in a middle luminance band. `dataColours.test.ts` enforces the contrast rules; change a colour and run it. Situation point strokes no longer encode report type — the edge is structural.

## Base map

- The base map is OpenFreeMap **Positron** (light) and **Fiord** (dark). `src/components/basemap/positron.json` and `fiord.json` are unmodified snapshots written by `npm run fetch-basemap`; refresh by running it, checking both schemes in the browser, and committing. They are in `.prettierignore`.
- Both snapshots are composed into the app's one style under `light/` and `dark/` layer id prefixes, sharing one set of sources (`openmaptiles`, `ne2_shaded`), glyphs and sprite — `basemap.test.ts` fails if OpenFreeMap ever diverges them. `buildings-3d-layer` reads `openmaptiles` too.
- **The style object is built once per mount and never replaced.** `MapView` builds it in a `useState` initialiser for the scheme in force; a new object would make react-map-gl call `setStyle`, which diffs against the running map and resets GeoJSON data, layer visibility and registered images. Do not pass `<Map>` a freshly built style, and do not call `setStyle`.
- A colour scheme change is a visibility switch done by `BaseMapScheme`, the **only** writer of base-layer visibility, `buildings-3d-layer`'s colour, `hillshade-layer`'s shadow and the sky (`SCHEME_PAINT` in `src/domain/baseMapScheme.ts`). `ViewDimensionLayers` still owns 3D-layer visibility and terrain; `ModeLayers`/`MapLayers` own app layers. A layer the snapshot ships hidden stays hidden in both schemes.
- `BASE_LAYERS`/`BASE_SOURCES` are derived from the snapshots, so the mode partition tests keep checking only app layers. No app layer or source id may use a scheme prefix.
- App text layers use `Noto Sans Regular`, the font OpenFreeMap's glyph server has.
- `window.__vehicleMap` exposes the map in development builds only, for the Playwright base-map tests.

## Map / icons

- `react-map-gl` uses the `maplibre` entry point (`react-map-gl/maplibre`), not Mapbox. The style is built by `buildMapStyle(scheme)` in `src/components/mapStyle.ts` on OpenFreeMap vector tiles — see "Base map". No token is needed.
- The 2D/3D toggle (`ViewDimension`, `src/domain/viewDimension.ts`) is separate state in `App`, synced to `?view=3d` by `useViewDimensionQueryParam`. It is deliberately **not** a `MapViewOptions` key: those are single-mode layer switches, and changing them re-opens the vehicle subscription. `ViewDimensionLayers` sets terrain imperatively (`<Map terrain>` ignores `undefined` and its types reject the `null` that removes it), reveals `VIEW_3D_LAYERS` and eases the pitch. 3D adds terrain + hillshade from Mapterhorn and building extrusions from the base map's own OpenFreeMap `openmaptiles` source — all keyless. The 3D pitch stays ≤60° because the vehicle subscription's bbox comes from `getBounds()`, which balloons toward the horizon. In 3D, `RotateControl` adds two buttons under the toggle that ease the bearing to the next 45° step (`rotatedBearing`); they are labelled by how the map turns on screen, the opposite of the bearing's sign.
- From `VEHICLE_MODEL_MIN_ZOOM` (16) vehicle icons cross-fade into true-scale 3D models, in both 2D and 3D view. The models are **built in code** (`src/domain/vehicleMeshes.ts`), not loaded from glTF: no licence-clean model pack covers the Norwegian fleet (metro, coach and ferry especially), and building them makes every model match `VEHICLE_DIMENSIONS` in `vehicleFootprint.ts` by construction — the tests hold the two together. deck.gl (`SimpleMeshLayer` in an interleaved `MapLibreOverlay`, `VehicleModels.tsx`) renders them, so buildings and terrain can hide them; that occlusion is accepted. Model space is +y forward, so the layer's yaw is `-bearing` (deck.gl yaw turns counter-clockwise). A vehicle without a usable bearing is drawn as a directionless column rather than a model pointing north. Each model is three meshes, drawn as up to three layers per mode: a pure-white **body** whose colour comes entirely from the per-vehicle `getColor` (`paintFor` in `src/domain/vehiclePaint.ts`: the line's published `line.presentation.colour` when there is one, otherwise the mode colour), pure-white destination **signs** coloured the same way (`signColourFor`: the published `textColour`, otherwise a default amber), and **details** (glass, lights, wheels) in fixed vertex colours drawn with a white `getColor`. deck.gl multiplies `getColor` into vertex colours, so tinting a single mesh would tint headlights too, and the layer's default colour is black. The builder routes a primitive to the body or the signs only when passed the `PAINT` or `SIGN` marker, each compared by identity. Road and rail vehicles carry a sign at each end and on each side, so one is in view from any angle; the ferry has none, and gets no sign layer. Height comes from `map.queryTerrainElevation`, not deck.gl's experimental `TerrainExtension`.
- Line colours come from `line { presentation { colour textColour } }` on the vehicles API, selected by the live subscription only — `Line.presentation` is optional in `types.ts` because the snapshot and timetable queries do not ask for it. Like `situations`, the field is absent from introspection but validates. Colours are shown **as published**: most publishers set a brand colour per product rather than per line, and AKT publishes `000000` (with `FFFF00` text) on every line; neither is corrected or treated as missing. Only about 5% of vehicles carry one (measured on dev: 224 of 4,134), so most models keep their mode colour. Colour therefore does not tell mode apart — the model's shape does. The 2D line-code label on `vehicle-layer` uses the pair too — text in `textColour` on a halo of `colour` — but only when **both** parse (`labelColoursFor`, carried as `lineTextColour`/`lineHaloColour` feature properties); half a pair falls back to black on white, since a text colour is only chosen to be legible against its own line colour. Measured on dev, every line publishing one publishes both.
- deck.gl does not pick here. Clicks go through the invisible `vehicle-model-layer` fill-extrusion (opacity 0, extruded footprints from `vehicleFootprint`), which `VehicleMarkers` queries alongside `vehicle-layer`, so the popup path is unchanged.
- Vehicle map icons are the SVGs in `src/static/images/vehicles/`, committed exactly as supplied. `RegisterIcons.tsx` draws each onto a 104×104 canvas (`drawVehicleIcon.ts`): clipped to its circle, which removes the files' white square background, and ringed in white, without which the dark mode fills vanish on the dark base map. They are registered with `pixelRatio: 2` as `vehicle-bus`, `vehicle-coach`, `vehicle-tram`, `vehicle-metro`, `vehicle-rail` (RAIL) and `vehicle-water` (FERRY); every other mode, including AIR and TAXI, gets the generated grey `vehicle-unknown` — deliberately never a borrowed mode icon, so an unexpected mode in the feed is visible as unknown. The mapping lives once in `src/domain/vehicleIcons.ts` and `vehicle-layer`'s `icon-image` is built from it. Panels draw the same icons with `VehicleIconCanvas`, not `<img>`. The other map symbols are still PNGs registered in the same component; a name that already exists before the app registers it is warned about, because it means the OpenFreeMap sprite has taken it. `vite-svg-loader` is gone — SVGs are imported with Vite's native `?url`.

## Situations carry their own geography

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

### Mistyped journey refs

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

## TypeScript / lint conventions

- ESM only (`"type": "module"`). Local imports include the explicit `.ts`/`.tsx` extension — match the existing style when adding imports.
- Don't add component files that also export non-component values (`react-refresh/only-export-components`).
