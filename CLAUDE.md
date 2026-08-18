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

1. `App` holds two pieces of state: `currentFilter: Filter | null` and `mapViewOptions`.
2. `CaptureBoundingBox` (rendered inside `<Map>`) listens to map `moveend` and writes the viewport bbox into `currentFilter.boundingBox` (throttled 500ms).
3. `useFilterQueryParams` syncs `currentFilter` (minus `boundingBox`) to/from URL query params — so shareable links preserve codespace/operator/maxDataAge but not the viewport.
4. `useVehiclePositionsData(filter, mapViewOptions)` opens a `graphql-ws` subscription via `useSubscriptionClient`. Incoming `VehicleUpdate`s are written into a `CacheMap` keyed by `vehicleId + "_" + serviceJourney.id`, with a per-entry TTL computed as `maxDataAge - (now - lastUpdated)` so stale vehicles auto-expire. The filter is also re-applied client-side before pushing to state.
5. `MapView` renders markers (`VehicleMarkers`), optional traces (`VehicleTraces`), popups (`VehiclePopup`), and the `LeftMenu`/`RightMenu` overlays. Selecting a vehicle in the popup can open `useVehicleUpdateCompleteSubscription` for richer per-vehicle details.
6. Selecting a vehicle also opens `useTimetableSubscription(serviceJourneyId, date)`, whose `timetables` frames carry deviation messages as `Situation` objects in two places: `EstimatedTimetableUpdate.situations` (trip-wide) and `Call.situations` (one stop). Both render through the same `SituationList` component. Situations are shown exactly as delivered — no deduplication, no severity filtering — because the demo exists to expose what the feed actually contains; `situationNumber` and `version` are displayed so a version regression in the eventually-consistent stream stays visible.

Key invariants worth preserving:

- The cache key combines `vehicleId` and `serviceJourneyId` so the same physical vehicle on different journeys is tracked separately, and traces don't bleed across journeys.
- The subscription is re-opened whenever `filter` or `mapViewOptions` changes (the previous async iterator is `.return()`ed first). Adding new subscription variables means adding them to the dependency array as well.
- The `maxDataAge` is sent to the server as an ISO 8601 duration string (`PT{n}S`) and is also used locally to compute cache TTL — keep these two uses in sync.
- The `situations` selection set is a single GraphQL fragment spread at both the timetable and the call level, so the two cannot drift apart.

## Map / icons

- `react-map-gl` uses the `maplibre` entry point (`react-map-gl/maplibre`), not Mapbox. The style is defined inline in `src/components/mapStyle.ts` and uses Entur's tile/style endpoints — no Mapbox token is needed.
- SVG vehicle icons are loaded via `vite-svg-loader` (see `vite.config.ts` and `src/components/RegisterIcons.tsx`). New icons need to be registered there to be available as map symbols.

## TypeScript / lint conventions

- ESM only (`"type": "module"`). Local imports include the explicit `.ts`/`.tsx` extension — match the existing style when adding imports.
- TS config is split: `tsconfig.app.json` for app source, `tsconfig.node.json` for Vite config. `tsc -b` is the build orchestrator.
- ESLint config (`eslint.config.js`) uses the flat-config format with `typescript-eslint` and `react-hooks` recommended rules plus `react-refresh/only-export-components`. Don't add component files that also export non-component values.
