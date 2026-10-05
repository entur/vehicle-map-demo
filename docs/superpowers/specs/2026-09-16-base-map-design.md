# Base map (light and dark) — design

Date: 2026-09-16

## Purpose

Make the map itself follow the light/dark theme, and make the data drawn on it readable on both.
Today the base map is one OSM raster that stays light in dark mode, the data colours were tuned
against that raster, and half the transport modes have no 2D vehicle icon.

This is the second of two sub-projects on the `modernize-look-and-feel` branch. The first
(`docs/superpowers/specs/2026-09-16-modernize-look-and-feel-design.md`) built the theme, the
colour scheme toggle and the floating-card chrome; it is complete and reviewed. Both ship as one
PR.

## Decisions

| Question                        | Decision                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Light base map                  | OpenFreeMap **Positron**.                                                                                                 |
| Dark base map                   | OpenFreeMap **Fiord**.                                                                                                    |
| Switching mechanism             | Both base maps in one style under `light/` and `dark/` id prefixes; a scheme change toggles visibility. No `setStyle`.    |
| Where the base styles come from | Snapshots checked into the repo, refreshed by a script. Not fetched at runtime.                                           |
| Data colours in dark mode       | One set tuned to read on both schemes, not per-scheme variants.                                                           |
| Mark separation                 | A two-tone edge (ink inner, white outer) on situation points, situation lines and the selected route.                     |
| Vehicle icons                   | The supplied SVGs, drawn on a canvas at registration (corners clipped, white ring added); files stay exactly as supplied. |
| Modes without an icon           | A generic neutral icon — never a borrowed mode icon, never nothing.                                                       |

### Out of scope

- The non-vehicle map-symbol PNGs (update markers, traffic lights, skull, occupancy). They are
  checked visually on Fiord; anything unreadable is recorded as a follow-up.
- 3D vehicle models (`vehicleMeshes.ts`, `vehiclePaint.ts`) and line colours as published.
- Terrain source (Mapterhorn) and the 3D pitch limits.
- Any change to what data is fetched or how it is filtered.

## 1. Composing the style

### Snapshot

- `scripts/fetch-basemap-styles.mjs` downloads `https://tiles.openfreemap.org/styles/positron`
  and `https://tiles.openfreemap.org/styles/fiord` and writes them, pretty-printed and otherwise
  unmodified, to `src/components/basemap/positron.json` and `src/components/basemap/fiord.json`.
- Refreshing is: run the script, look at the map in both schemes, commit. `basemap.ts` carries a
  header comment naming the source URLs and the fetch date.

### Composition — `src/components/basemap/basemap.ts` (pure)

- `MapScheme = "light" | "dark"`; Positron is `light`, Fiord is `dark`.
- `baseLayers(scheme)` returns that snapshot's layers with ids prefixed `light/` or `dark/`, and
  `layout.visibility` set by `baseLayerVisibility` for the scheme the style is built for.
- Both snapshots use sources `openmaptiles` (vector, `https://tiles.openfreemap.org/planet`) and
  `ne2_shaded` (raster, natural earth, low zoom), the same `glyphs` URL and the same `sprite`. The
  composed style declares each source once, shared by both prefixes, and takes `glyphs` and
  `sprite` from the snapshot. Tests assert the two snapshots agree on all of this, so an upstream
  divergence fails loudly.
- `openmaptiles` is the tileset today's `openfreemap` source already serves for 3D buildings.
  `buildings-3d-layer` moves to `openmaptiles` (source-layer `building`, unchanged), and the
  `openfreemap` source is removed.

### `mapStyle.ts`

- Exports `buildMapStyle(scheme: MapScheme): StyleSpecification` instead of a constant. The
  scheme sets base-layer visibility and bakes in that scheme's `SCHEME_PAINT` (building
  extrusion colour, hillshade shadow, sky), so the first frame is already right.
- Order: shared base sources, terrain/hillshade sources, app sources; layers
  `[...baseLayers("light"), ...baseLayers("dark")]`, then `hillshade-layer` and
  `buildings-3d-layer`, then the app layers in their current order (with the new edge layers from
  section 3).
- The OSM raster source and `osm` layer are removed. Attribution now comes from the vector
  source's TileJSON (OpenFreeMap, OpenMapTiles, OpenStreetMap contributors).
- `vehicle-layer`'s `text-font` changes from `["Open Sans Regular", "Arial Unicode MS Regular"]` —
  not served by OpenFreeMap's glyph server — to `["Noto Sans Regular"]`. The dormant
  `vehicle-update-interval-text-layer` gets the same explicit font.

### Per-scheme base-map colours

These are base-map colours, not data colours, so they differ per scheme. They live in
`SCHEME_PAINT: Record<MapScheme, { buildings: string; hillshadeShadow: string; sky: SkySpecification }>`
in `src/domain/baseMapScheme.ts`.

| Property                          | Light (today's values)           | Dark (starting values, tuned by eye) |
| --------------------------------- | -------------------------------- | ------------------------------------ |
| `buildings-3d-layer` extrusion    | `#d6d0c8`                        | `#3a4560`                            |
| `hillshade-layer` shadow          | `#473b24`                        | `#1c2233`                            |
| sky `sky-color` / `horizon-color` | `#b9d7ee` / `#eef3f6`, blend 0.6 | `#1f2638` / `#2c3550`, blend 0.6     |

### Partition invariants

- `BASE_LAYERS` and `BASE_SOURCES` in `src/domain/viewDimension.ts` are derived from
  `basemap.ts` plus the terrain/hillshade sources and the two 3D layers — not hand-listed.
- `VIEW_3D_LAYERS` stays `hillshade-layer` and `buildings-3d-layer`.
- The existing `appMode.test.ts` total-partition checks run unchanged against
  `buildMapStyle("light")`: every non-base layer and source is claimed by exactly one mode.
- No app layer or source id may start with `light/` or `dark/` (tested).
- Icon names registered by the app must not collide with the OpenFreeMap sprite. All vehicle
  icons use a `vehicle-` prefix. `RegisterIcons` skips names that already exist, so a collision
  would silently show a sprite image: it logs a `console.warn` when a name it is about to register
  already exists before its first registration.

## 2. Switching at runtime

### Pure part — `src/domain/baseMapScheme.ts`

- `baseLayerVisibility(scheme)`: `[layerId, "visible" | "none"][]` for every `light/` and `dark/`
  layer — the chosen scheme visible, the other hidden. Derived from `basemap.ts`.
- `SCHEME_PAINT` (above).

### Initial style — no flash of the wrong map

- `MapView` calls `buildMapStyle(scheme)` once, in a `useState` initialiser, with
  `useColorScheme().colorScheme` (resolved; correct on first render because of `noSsr` and the
  pre-load script). Fallback `light` if it is undefined.
- The object passed to `<Map mapStyle>` never changes identity afterwards. A changed identity makes
  react-map-gl call `setStyle`, which diffs against the runtime state and resets GeoJSON data,
  visibility and images — the exact loss this design avoids. A comment at the call site says so.

### Switching — `src/components/BaseMapScheme.tsx`

- Rendered inside `<Map>` beside `ViewDimensionLayers`. Reads `useColorScheme().colorScheme`, so
  a `system` mode follows the OS live.
- On change, through `whenLayerExists` (as `ModeLayers` and `ViewDimensionLayers` do):
  - sets `visibility` from `baseLayerVisibility(scheme)`, skipping layers already correct;
  - `setPaintProperty("buildings-3d-layer", "fill-extrusion-color", …)` and
    `setPaintProperty("hillshade-layer", "hillshade-shadow-color", …)`;
  - `map.setSky(SCHEME_PAINT[scheme].sky)`.
- Ownership stays single: `BaseMapScheme` owns base-layer visibility and the three scheme paints;
  `ViewDimensionLayers` owns 3D-layer visibility and terrain; `ModeLayers` and `MapLayers` own app
  layer visibility. None writes another's property.

A scheme switch leaves untouched: registered images, GeoJSON source data, app layer visibility,
terrain, the deck.gl overlay, the camera, and open popups.

## 3. Data colours tuned for both schemes

### The constraint

Positron land is `#f2f3f0` (relative luminance ≈ 0.89); Fiord land is `#45516e` (≈ 0.08). No fill
reaches 3:1 against both. Separation from the map therefore comes from a mark's **edge**, and the
fill's job is to carry hue and to contrast with its own edge.

### Rule 1 — two-tone edges on map marks

Inner ink `#1f2430` (≈ 9:1 on Positron) and outer white `#ffffff` (≈ 8:1 on Fiord).

| Feature          | Layers, bottom to top                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Situation points | new `situation-points-edge-layer` (white circle, radius = point radius + stroke + 2), `situation-points-layer` (fill, `circle-stroke-color` ink) |
| Situation lines  | new `situation-lines-outer-casing-layer` (white, casing width + 2), `situation-lines-casing-layer` (ink, was `#2b2b2b`), `situation-lines-layer` |
| Selected route   | new `service-journey-route-outer-casing-layer` (white), new `service-journey-route-casing-layer` (ink), `service-journey-route-layer`            |

- The halo layers (`situation-*-halo-layer`) stay beneath their feature's edge layers.
- Each new layer takes the same filter as its feature layer, the same selection opacity handling
  in `SituationLayers` (dimmed together with the fill), and the same dash handling in
  `RouteLayer` where it applies (the casings are solid).
- Classification: the situation edge layers join `MODE_SWITCHED_LAYERS` under the same switch as
  their feature (`showAffectedStops` / `showAffectedLines`), so a feature and its edge always
  toggle together. The route casings join `MODE_DEFAULT_VISIBLE_LAYERS` with
  `service-journey-route-layer`.
- The situation point stroke no longer distinguishes INCIDENT (`#2b2b2b`) from other report types
  (`#ffffff`): the edge is now structural. Report type remains visible in the popup, the list and
  the facet chips.
- Vehicle traces and the heatmap get no edges.

### Rule 2 — fills in a middle luminance band

Fills sit at relative luminance ≈ 0.15–0.40, so each is ≥ 3:1 against its ink ring and ≥ 2.5:1
against its white ring.

### Rule 3 — coloured text on panels

Data-coloured text (delay label, realtime stop time, cancelled stop, flag warnings) must reach
≥ 3:1 on both panel backgrounds, `#ffffff` and `#23262d`. This is below WCAG's 4.5:1 for body text; accepted because
these labels are bold, short, and always carry their meaning in words. Colours that fail 3:1 on
either panel (slight orange, muted grey) are used only as dots and fills, never as text.

The occupancy indicator in `StopRow` is a coloured person glyph with its label in `title` and
`aria-label`, not text. Its colours must reach ≥ 2:1 on both panels — amber `#e6a700` on white
is 2.1:1, unchanged from today — and the label carries the meaning.

### The colour set — `src/domain/dataColours.ts`

| Constant                 | Meaning                                 | Old       | New       |
| ------------------------ | --------------------------------------- | --------- | --------- |
| `EDGE_INK`               | inner edge                              | `#2b2b2b` | `#1f2430` |
| `EDGE_WHITE`             | outer edge                              | —         | `#ffffff` |
| `SEVERITY_SEVERE`        | severe; also "bad" red everywhere       | `#c0392b` | `#e5483a` |
| `SEVERITY_NOTABLE`       | slight                                  | `#e07a1f` | `#f08a24` |
| `SEVERITY_MUTED`         | undefined / no impact                   | `#999999` | `#9aa1ad` |
| `ROUTE`                  | selected service journey route          | `#1fcac2` | `#1fb8b0` |
| `SELECTION_HALO`         | selected situation halo                 | `#2f6fed` | `#4c86f5` |
| `TRACE`                  | vehicle trace                           | `#9353a1` | `#b06bc0` |
| `DELAY_LATE`             | late                                    | `#c0392b` | `#e5483a` |
| `DELAY_EARLY`            | early                                   | `#2980b9` | `#3d9be0` |
| `DELAY_ON_TIME`          | on time                                 | `#1f8a3a` | `#2fa84f` |
| `OCCUPANCY_OK`           | empty / seats available                 | `#1f8a3a` | `#2fa84f` |
| `OCCUPANCY_FEW`          | few seats                               | `#e6a700` | `#e6a700` |
| `OCCUPANCY_STANDING`     | standing                                | `#e07a1f` | `#f08a24` |
| `OCCUPANCY_FULL`         | crowded / full; cancelled; flag warning | `#c0392b` | `#e5483a` |
| `OCCUPANCY_NOT_BOARDING` | not accepting passengers                | `#7a1f1f` | `#b0303a` |

- `situationSeverity.ts` re-exports the severity constants from `dataColours.ts` (existing
  imports keep working). `delayThresholds.ts`, `StopRow.tsx` (occupancy table, cancelled red),
  `SituationRow.tsx` and `UnmappableList.tsx` (flag-warning red) and `mapStyle.ts` import from it.
  No data-colour hex literal remains outside `dataColours.ts`.
- The heatmap ramp and published line colours are unchanged.
- `vehicle-layer` label text keeps published line colours and its black-on-white fallback, which
  already works on both base maps.

## 4. Vehicle icons

### Mode to icon — `src/domain/vehicleIcons.ts` (pure)

| `VehicleModeEnumeration` | Image name        | Source                                 |
| ------------------------ | ----------------- | -------------------------------------- |
| `BUS`                    | `vehicle-bus`     | `src/static/images/vehicles/bus.svg`   |
| `COACH`                  | `vehicle-coach`   | `src/static/images/vehicles/coach.svg` |
| `TRAM`                   | `vehicle-tram`    | `src/static/images/vehicles/tram.svg`  |
| `METRO`                  | `vehicle-metro`   | `src/static/images/vehicles/metro.svg` |
| `RAIL`                   | `vehicle-rail`    | `src/static/images/vehicles/rail.svg`  |
| `FERRY`                  | `vehicle-water`   | `src/static/images/vehicles/water.svg` |
| `AIR`, `TAXI`, any other | `vehicle-unknown` | generated                              |

- `vehicleIconName(mode: string): string` implements the table.
- `VEHICLE_ICON_MATCH` is the `["match", ["get", "mode"], …, "vehicle-unknown"]` expression for
  `vehicle-layer`'s `icon-image`, built from the same table. The unregistered `bus-red` fallback
  is removed.

### Drawing — files stay as supplied

- The SVGs are committed as supplied (the `.DS_Store` beside them is not).
- Each SVG is imported with Vite's native `?url`, loaded into an `HTMLImageElement`, and drawn on a
  104×104 canvas (2× of its 52px viewBox), registered with `pixelRatio: 2`. MapLibre's
  `loadImage` is not used for SVG.
- Drawing, in order: clip to the inscribed circle (removes the files' white 52×52 background
  rectangle), draw the SVG, stroke a 2px (4 device px) white ring on the circle's edge — rule 1
  applied to icons, because the mode fills have almost no contrast with Fiord (bus `#3B46AB` on
  Fiord ≈ 1.1:1).
- The generic icon is the same circle in `#5b6272` with a centred white dot of radius 6, drawn by
  the same routine.
- The drawing routine is a small function taking a `CanvasRenderingContext2D`, an image or
  `null` (generic), and a size; `RegisterIcons.tsx` calls it and registers the seven vehicle
  images alongside the existing non-vehicle PNG symbols.

### Size

`vehicle-layer`'s `icon-size` curve is re-tuned for the round icons, targeting ≈ 22px across at
zoom 4 and ≈ 32px from zoom 12. The `delay`, `occupancy` and update-interval icon layers, which sit
offset from the vehicle icon, are re-checked for overlap and their offsets adjusted if needed.

### Panels and cleanup

- `Legend` lists the six mode icons plus "Other modes" (the generic icon), rendered from the same
  SVGs/drawing so they match the map. `MapLayers` uses the bus SVG where it used `bus.png`.
- `bus.png`, `ferry.png`, `train.png` and `tram.png` are deleted once nothing imports them.
- `vite-svg-loader` is removed: the plugin in `vite.config.ts`, the dependency, and the
  `declare module "*.svg"` typing in `src/custom.d.ts` (the `*.svg?url` declaration stays).

## 5. Testing and documentation

### Unit tests (vitest, `src/**/*.test.ts`)

- `basemap.test.ts`: both snapshots declare the same sources, glyphs and sprite; every prefixed id
  is unique; no app layer id starts with `light/` or `dark/`; `baseLayerVisibility` covers every
  base layer exactly once and makes exactly one scheme visible.
- `mapStyle.test.ts`: `buildMapStyle("light")` and `buildMapStyle("dark")` differ only in
  base-layer `visibility`, `buildings-3d-layer`'s extrusion colour, `hillshade-layer`'s shadow
  colour and `sky` — each matching `SCHEME_PAINT` for its scheme.
- `appMode.test.ts`, `viewDimension.test.ts`: partitions hold with derived base ids and the new
  edge layers classified.
- `dataColours.test.ts`: a small WCAG relative-luminance/contrast helper; each map-mark fill is
  within the band against `EDGE_INK` and `EDGE_WHITE`; each colour used as text (`SEVERITY_SEVERE`,
  `DELAY_*`) reaches ≥ 3:1 on `#ffffff` and `#23262d`; each `OCCUPANCY_*` reaches ≥ 2:1 on both.
- `situationSeverity.test.ts`: pinned values updated.
- `vehicleIcons.test.ts`: every `VehicleModeEnumeration` member and an unknown string map as in
  the table; `VEHICLE_ICON_MATCH` agrees with `vehicleIconName` for every member.

### Playwright

- Dev-only test hook: `MapView` sets `window.__vehicleMap` to the MapLibre map on load when
  `import.meta.env.DEV`.
- New test — switching to dark swaps the base map and keeps app state: load light; wait until the
  `vehicles` source has features; toggle to dark; assert `dark/background` is `visible` and
  `light/background` is `none`, `vehicle-layer` visibility is unchanged, `hasImage("vehicle-bus")`
  is still true, and the `vehicles` source still has features.
- New test — reloading in dark starts with `dark/background` visible.
- The existing smoke tests keep passing.

### Manual matrix

Both modes × light/dark × 2D/3D, with screenshots: base map at zoom 5, 10, 15; situation points and
lines with edges, selected and unselected; the selected route; traces; heatmap; every vehicle icon
including a generic one if the feed has AIR or TAXI; 3D buildings, hillshade and sky; attribution
visible and not covered; the non-vehicle map-symbol PNGs on Fiord (findings recorded, not fixed).

### CLAUDE.md

- New "Base map" section: the snapshots and refresh script; prefixed layers; `BaseMapScheme` as
  sole owner of base-layer visibility and scheme paints; the style object must never change
  identity (no `setStyle`) and why; derived `BASE_LAYERS`/`BASE_SOURCES`; the two-tone edge rule.
- "Map / icons": SVG vehicle icons drawn on a canvas with clip and ring; the mode table and generic
  icon; `vite-svg-loader` gone; the stale "only BUS/FERRY/RAIL/TRAM" note replaced.
- "Theme": data colours live in `dataColours.ts`, tuned for both schemes; remove "not yet tuned for
  dark panels".
- Invariants that mention the OSM raster (3D layers "directly on the raster", the situation casing
  rationale) are rewritten for the vector base map.
