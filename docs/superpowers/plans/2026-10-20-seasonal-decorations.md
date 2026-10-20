# Halloween Pumpkins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giant low-poly pumpkins scattered near some stops on the map from 24 Oct to 1 Nov, built in code and drawn through the vehicle models' deck.gl overlay, at no measurable cost to frame rate.

**Architecture:** Three pure modules in `src/domain/`: the season check, the per-stop seeded placement with traffic and building clearance, and the pumpkin mesh (in `vehicleMeshes.ts`, next to `stopPoleModel`). A layer builder (`pumpkinLayers.ts`) turns placements into at most three `SimpleMeshLayer`s. A hook (`usePumpkins`) reads stops, roads and buildings from the `openmaptiles` source tiles, rebuilds on `moveend` (throttled during a chase, around the chased vehicle) and hands its layers to `VehicleModels`, which owns the map's only interleaved overlay.

**Tech Stack:** React 19, MapLibre GL 6 via react-map-gl 8, deck.gl 9.4 (`SimpleMeshLayer`, `MapLibreOverlay`), vitest (node environment, `.ts` only), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-seasonal-decorations-design.md`

## Global Constraints

- Season window: 24 October to 1 November inclusive, judged by the date in `Europe/Oslo`.
- `?season=halloween` forces the season on; `?season=none` forces it off; any other value or none → by date. Not part of `Filter`.
- Nothing is built below `VEHICLE_MODEL_MIN_ZOOM` (16, `src/components/mapStyle.ts`), and nothing at all off-season: no tile queries, no meshes, no layers.
- At most 200 pumpkins per view (`PUMPKIN_CAP`).
- Pumpkin height 1.5–2.5 m, never above a bus (3.2 m in `vehicleFootprint.ts`).
- About one stop in three gets pumpkins, 1–3 each, random yaw, spread 3–15 m from the stop.
- Clearance: footprint at least 1.5 m beyond each traffic line's estimated edge; never inside a building footprint; paths, footways, cycleways, pedestrian areas are not traffic.
- During a chase: rebuilt around the chased vehicle on a timer, never per frame; no pumpkin within `CHASE_CLEARANCE_M` of the chased vehicle.
- One interleaved overlay per map: pumpkin layers go through `VehicleModels`' `handOver`, never a second `MapLibreOverlay`.
- Light scheme: plain pumpkins (no face drawn). Dark scheme: body `MODEL_MATERIALS.dark.shaded`, face `MODEL_MATERIALS.dark.lamps`.
- Independent of the "Transit network" switch: read source features, not rendered layers.
- `npm run lint` with `--max-warnings 0` must stay clean.

## Review Focus

1. **Tile duplicates and clipping.** `querySourceFeatures` returns a stop once per loaded tile that holds it, and road lines clipped at tile edges. The same stop must yield the same pumpkins once, wherever the tile boundaries fall. → Task 2 test `dedupes a stop returned by two tiles`.
2. **A stop on a busy road with no room.** A stop squeezed between a primary road and a building must get zero pumpkins, not pumpkins in the lane. → Task 2 test `gives a stop with no clear spot no pumpkins`.
3. **Pans that keep pumpkins in view must not move them.** A rebuild with a shifted view that still contains a stop must return identical pumpkins for that stop. → Task 2 test `is stable across views`.
4. **Terrain not loaded yet.** In 3D, `queryTerrainElevation` returns 0 (or null) for a loading tile; pumpkins must be re-placed when the terrain tile arrives rather than staying buried or floating. → Task 5 listens to `terrain` and terrain `sourcedata`, as the stop poles do; checked by eye in Task 6.
5. **Season ends or the URL forces it off mid-session.** With `?season=none` or outside the window the hook must register no listeners and query no tiles. → Task 1 test `forces off with season=none`; Task 5 effect returns before subscribing when `season === null`.

---

## File Structure

| File                                                      | Responsibility                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/domain/season.ts` (+ `.test.ts`)                     | `Season` type, `SEASONS` table, `seasonOn(date, search)`                        |
| `src/domain/pumpkinPlacement.ts` (+ `.test.ts`)           | Seeded random, clearance geometry, `pumpkinsAtStop`, `pumpkinsInView`           |
| `src/domain/vehicleMeshes.ts` (+ `.test.ts`)              | Add `PUMPKIN`, `pumpkinModel()`, pumpkin colours, face colour in `LAMP_COLOURS` |
| `src/components/Seasonal/pumpkinLayers.ts` (+ `.test.ts`) | `Pumpkin[]` → `SimpleMeshLayer`s per scheme                                     |
| `src/components/Seasonal/usePumpkins.ts`                  | Tile reads, rebuild schedule, chase handling, dev `window.__pumpkins`           |
| `src/components/Vehicle/VehicleModels.tsx`                | New `season` prop, `pumpkinLayers` ref in `handOver`                            |
| `src/components/MapView.tsx`                              | Compute season once, pass to `VehicleModels`                                    |
| `tests/seasonal.spec.ts`                                  | Playwright on/off check                                                         |
| `CLAUDE.md`, spec                                         | Short section; measured numbers                                                 |

---

### Task 1: Season check

**Files:**

- Create: `src/domain/season.ts`
- Test: `src/domain/season.test.ts`

**Interfaces:**

- Produces: `export type Season = "halloween";` `export const SEASONS: { id: Season; from: [month: number, day: number]; to: [month: number, day: number] }[]` (one row: `halloween`, `[10, 24]`, `[11, 1]`); `export function seasonOn(now: Date, search: string): Season | null`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("seasonOn", () => {
  it("is halloween from 24 Oct to 1 Nov inclusive", () => {
    expect(seasonOn(new Date("2026-10-24T12:00:00+02:00"), "")).toBe(
      "halloween",
    );
    expect(seasonOn(new Date("2026-11-01T12:00:00+01:00"), "")).toBe(
      "halloween",
    );
    expect(seasonOn(new Date("2026-10-23T12:00:00+02:00"), "")).toBeNull();
    expect(seasonOn(new Date("2026-11-02T12:00:00+01:00"), "")).toBeNull();
  });
  it("judges the date in Oslo, not UTC", () => {
    // 23:30 UTC on 23 Oct is 01:30 on 24 Oct in Oslo.
    expect(seasonOn(new Date("2026-10-23T23:30:00Z"), "")).toBe("halloween");
    // 23:30 UTC on 1 Nov is 00:30 on 2 Nov in Oslo.
    expect(seasonOn(new Date("2026-11-01T23:30:00Z"), "")).toBeNull();
  });
  it("forces on with season=halloween", () => {
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=halloween"),
    ).toBe("halloween");
  });
  it("forces off with season=none", () => {
    expect(
      seasonOn(new Date("2026-10-31T12:00:00Z"), "?season=none"),
    ).toBeNull();
  });
  it("ignores an unknown season value", () => {
    expect(seasonOn(new Date("2026-10-31T12:00:00Z"), "?season=easter")).toBe(
      "halloween",
    );
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=easter"),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/season.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `seasonOn`** — month and day from `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", month: "numeric", day: "numeric" }).formatToParts(now)`; a window that wraps the year (`from` after `to`) need not be supported yet. Doc comment: the table is where Christmas and Easter go later.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** on a branch `seasonal-pumpkins` off `main`, with the spec and this plan in the first commit: `git add docs/superpowers/specs/2026-10-20-seasonal-decorations-design.md docs/superpowers/plans/2026-10-20-seasonal-decorations.md src/domain/season.ts src/domain/season.test.ts && git commit -m "Add the season check for seasonal decorations"`

### Task 2: Pumpkin placement

**Files:**

- Create: `src/domain/pumpkinPlacement.ts`
- Test: `src/domain/pumpkinPlacement.test.ts`

**Interfaces:**

- Consumes: `ViewBounds` from `src/domain/vehiclesInView.ts`.
- Produces:
  - `export type Pumpkin = { key: string; position: [number, number]; height: number; yaw: number; tint: [number, number, number] };` — `key` is `${stopKey}#${i}`; `yaw` degrees clockwise from north; `tint` 0–255 RGB.
  - `export type TrafficLine = { class: string; coordinates: [number, number][] };`
  - `export type BuildingRing = [number, number][];` (outer rings only)
  - `export const TRAFFIC_HALF_WIDTH_M: Record<string, number>` = `{ motorway: 7, trunk: 7, primary: 7, secondary: 5, tertiary: 5, minor: 3.5, service: 3.5, busway: 3.5, rail: 2.5, transit: 2.5 }` — any class not listed is not traffic.
  - `export const CLEARANCE_M = 1.5; export const PUMPKIN_CAP = 200; export const PUMPKIN_ASPECT = 1.3;` (width ÷ height) `export const CHASE_CLEARANCE_M = 40;`
  - `export function stopKey(position: [number, number]): string` — lng/lat rounded to 5 decimals, joined with `,`.
  - `export function pumpkinsAtStop(stop: [number, number], traffic: TrafficLine[], buildings: BuildingRing[]): Pumpkin[]`
  - `export function pumpkinsInView(stops: [number, number][], traffic: TrafficLine[], buildings: BuildingRing[], view: ViewBounds, options?: { avoid?: { position: [number, number]; radiusM: number } }): Pumpkin[]`

Approach, which the tests do not fully determine:

- Random: mulberry32 seeded with a 32-bit hash of `stopKey(stop)`. Draw in a fixed order: chance (`< 1/3` gets pumpkins), count (1–3), then per pumpkin height (1.5–2.5), yaw, tint (orange hues between `#d9620b` and `#f28c28`), and up to 8 candidate offsets (distance 3–15 m, any angle). Draws per pumpkin are fixed in number whether or not a candidate is accepted, so one rejection doesn't shift the next pumpkin's numbers.
- Geometry in local metres around the stop (equirectangular: `x = Δlng · cos(lat) · 111_320`, `y = Δlat · 110_574`). Footprint is a circle of radius `PUMPKIN_ASPECT · height / 2`. Reject a candidate if its distance to any traffic segment is less than `halfWidth + CLEARANCE_M + radius`, if its centre is inside a building ring or its distance to a ring edge is less than `radius`, or if it overlaps an already-accepted pumpkin.
- `pumpkinsInView`: dedupe stops by `stopKey`, keep those inside `view`, sort by distance to the view's centre (so the cap keeps the nearest), accumulate `pumpkinsAtStop` until `PUMPKIN_CAP`, then drop any within `avoid.radiusM` of `avoid.position`.

- [ ] **Step 1: Write the failing tests**

Fixtures: `OSLO: [number, number] = [10.7509, 59.9114]`; a helper `east(m)` / `north(m)` offsetting a lng/lat by metres; `road(cls, from, to): TrafficLine`; a `square(centre, sideM): BuildingRing`. Find, by a loop over `OSLO` shifted 1 m at a time, a `LUCKY` stop that gets 3 pumpkins with no obstacles, and fix it as a literal in the test file once found.

```ts
it("is deterministic per stop", () => {
  expect(pumpkinsAtStop(LUCKY, [], [])).toEqual(pumpkinsAtStop(LUCKY, [], []));
});
it("gives roughly one stop in three pumpkins, 1–3 each", () => {
  const stops = Array.from({ length: 3000 }, (_, i) => east(OSLO, i * 5));
  const counts = stops.map((s) => pumpkinsAtStop(s, [], []).length);
  const decorated = counts.filter((c) => c > 0).length / stops.length;
  expect(decorated).toBeGreaterThan(0.28);
  expect(decorated).toBeLessThan(0.39);
  expect(Math.max(...counts)).toBe(3);
});
it("keeps every pumpkin between 1.5 and 2.5 m tall and 3–15 m from the stop", ...);
it("keeps clear of a primary road's estimated edge", () => {
  const traffic = [road("primary", north(LUCKY, -50), north(LUCKY, 50))];
  for (const p of pumpkinsAtStop(LUCKY, traffic, []))
    expect(metresToSegment(p.position, traffic[0])).toBeGreaterThanOrEqual(7 + 1.5 + (1.3 * p.height) / 2);
});
it("does not count a footway or cycleway as traffic", () => {
  const traffic = [road("path", north(LUCKY, -50), north(LUCKY, 50))];
  expect(pumpkinsAtStop(LUCKY, traffic, [])).toEqual(pumpkinsAtStop(LUCKY, [], []));
});
it("never stands a pumpkin inside a building", ...); // a 20 m square beside the stop; every pumpkin's footprint outside it
it("gives a stop with no clear spot no pumpkins", () => {
  // Primary road through the stop, buildings filling both sides beyond its edge.
  expect(pumpkinsAtStop(LUCKY, [road("primary", ...)], [square(east(LUCKY, 20), 24), square(east(LUCKY, -20), 24)])).toEqual([]);
});
it("dedupes a stop returned by two tiles", () => {
  expect(pumpkinsInView([LUCKY, LUCKY], [], [], viewAround(LUCKY))).toHaveLength(3);
});
it("is stable across views", () => {
  const a = pumpkinsInView([LUCKY], [], [], viewAround(LUCKY));
  const b = pumpkinsInView([LUCKY], [], [], viewAround(east(LUCKY, 100)));
  expect(b).toEqual(a);
});
it("caps at PUMPKIN_CAP, keeping the stops nearest the view's centre", ...);
it("drops pumpkins within the avoid radius", ...);
```

- [ ] **Step 2: Run** `npx vitest run src/domain/pumpkinPlacement.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the exports above in `src/domain/pumpkinPlacement.ts`.
- [ ] **Step 4: Run** the same command — Expected: PASS. Run the "one in three" test five times to check it isn't flaky (it is seeded, so it shouldn't be).
- [ ] **Step 5: Commit** `git commit -m "Place seasonal pumpkins near stops, clear of traffic and buildings"`

### Task 3: Pumpkin mesh

**Files:**

- Modify: `src/domain/vehicleMeshes.ts` (`MESH_COLOURS`, `LAMP_COLOURS`, new export after `stopPoleModel`)
- Test: `src/domain/vehicleMeshes.test.ts` (new `describe("pumpkinModel")`, reusing `vertices`, `whole`, `extent`, `verticesColoured`)

**Interfaces:**

- Produces: `export const PUMPKIN = { height: 1, width: PUMPKIN_ASPECT, ribs: 8 } as const;`, importing `PUMPKIN_ASPECT` from `pumpkinPlacement.ts` so placement footprints and the mesh cannot drift apart; `export function pumpkinModel(): VehicleModel` (cached like `stopPoleModel`). `MESH_COLOURS.pumpkinStem` (`0x4a6b2a`) and `MESH_COLOURS.jackOLantern` (`0xffb030`), the latter added to `LAMP_COLOURS`.
- Model space: unit height standing on z = 0, centred on the origin; the carved face on the +y side. Body is `PAINT` (tinted per pumpkin), stem is `details`, face is `lamps`, sign is empty.

- [ ] **Step 1: Write the failing tests**

```ts
describe("pumpkinModel", () => {
  const model = pumpkinModel();
  it("has one normal and one colour per vertex, in whole triangles, in every mesh", ...); // as for modelFor
  it("has a pure white body, so getColor alone decides its colour", ...);
  it("stands one unit tall on the ground, PUMPKIN_ASPECT wide", () => {
    const { min, max } = extent(whole(model));
    expect(min[2]).toBeCloseTo(0, 5);
    expect(max[2]).toBeCloseTo(1, 1); // stem included
    expect(max[0] - min[0]).toBeCloseTo(PUMPKIN_ASPECT, 1);
  });
  it("carves its face on the +y side only, in the lamps mesh", () => {
    expect(vertices(model.lamps).length).toBeGreaterThan(0);
    for (const [, y] of vertices(model.lamps)) expect(y).toBeGreaterThan(0);
  });
  it("has no sign", () => expect(model.sign.positions.value.length).toBe(0));
  it("stays within 800 triangles", ...);
  it("is built once", () => expect(pumpkinModel()).toBe(model));
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/vehicleMeshes.test.ts` — Expected: FAIL, `pumpkinModel` is not exported.
- [ ] **Step 3: Implement `pumpkinModel`** with `MeshBuilder.triangle`/`quad`: a lathe of a squashed-sphere profile (about 8 rings) whose radius is modulated by `ribs` so the grooves read, a short tapered stem box on top, and eyes and a mouth as triangles sitting about 1 cm proud of the surface on +y, in `MESH_COLOURS.jackOLantern`. `inside` for every primitive is the pumpkin's centre `[0, 0, 0.45]`.
- [ ] **Step 4: Run** the same command — Expected: PASS, including the existing `modelFor` tests (the new lamp colour must not leak into any vehicle).
- [ ] **Step 5: Commit** `git commit -m "Add a low-poly pumpkin model"`

### Task 4: Pumpkin layers

**Files:**

- Create: `src/components/Seasonal/pumpkinLayers.ts`
- Test: `src/components/Seasonal/pumpkinLayers.test.ts`

**Interfaces:**

- Consumes: `Pumpkin` (Task 2), `pumpkinModel` (Task 3), `MODEL_BEFORE_LAYER`, `MODEL_MATERIALS`, `UNTINTED` from `vehicleModelLayers.ts`, `MapScheme`.
- Produces: `export type PumpkinLayerOptions = { visible: boolean; opacity: number; scheme: MapScheme; getElevation: (pumpkin: Pumpkin) => number; positionTrigger: unknown };` and `export function pumpkinLayers(pumpkins: Pumpkin[], options: PumpkinLayerOptions): Layer[]`.
- Layer ids: `seasonal-pumpkins-body`, `seasonal-pumpkins-stems`, `seasonal-pumpkins-faces` (dark only). Each pumpkin is scaled `[height, height, height]` and turned by `[0, -yaw, 0]`; the body takes `getColor: (p) => p.tint`.

- [ ] **Step 1: Write the failing tests**

```ts
it("builds nothing while hidden or empty", () => {
  expect(pumpkinLayers([P], { ...opts, visible: false })).toEqual([]);
  expect(pumpkinLayers([], opts)).toEqual([]);
});
it("draws plain pumpkins in light mode: body and stems, no faces", () => {
  expect(pumpkinLayers([P, Q], opts).map((l) => l.id)).toEqual(["seasonal-pumpkins-body", "seasonal-pumpkins-stems"]);
});
it("lights the faces as lamps in dark mode", () => {
  const layers = pumpkinLayers([P], { ...opts, scheme: "dark" });
  expect(layers.map((l) => l.id)).toContain("seasonal-pumpkins-faces");
  expect(layers.find((l) => l.id === "seasonal-pumpkins-faces")!.props.material).toBe(MODEL_MATERIALS.dark.lamps);
  expect(layers.find((l) => l.id === "seasonal-pumpkins-body")!.props.material).toBe(MODEL_MATERIALS.dark.shaded);
});
it("keeps the layer count fixed however many pumpkins there are", () => {
  expect(pumpkinLayers(Array(200).fill(P), { ...opts, scheme: "dark" })).toHaveLength(3);
});
it("draws under the vehicle icons", ...); // every layer's beforeId is MODEL_BEFORE_LAYER
```

- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/pumpkinLayers.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** in the style of `stopPoleLayers.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Draw seasonal pumpkins as three mesh layers"`

### Task 5: Wire into the map

**Files:**

- Create: `src/components/Seasonal/usePumpkins.ts`
- Modify: `src/components/Vehicle/VehicleModels.tsx` (Props, a `pumpkinLayersRef` in `handOver`'s list, after `stopLayers`)
- Modify: `src/components/MapView.tsx:635-643` (pass `season`)

**Interfaces:**

- Consumes: Tasks 1, 2, 4; `STOP_FILTER` and `transitPlaceKind` from `src/domain/transitNetwork.ts`; `cappedViewBounds`; `throttle`; `VehicleStore` (`chasedVehicleStore`).
- Produces: `export function usePumpkins(options: { map: maplibregl.Map | undefined; season: Season | null; opacity: number; scheme: MapScheme; chasing: boolean; chasedVehicleStore: VehicleStore; onLayers: (layers: Layer[]) => void }): void`; `export const PUMPKIN_CHASE_INTERVAL_MS = 1000;` `VehicleModels` gains `season: Season | null`.

Behaviour:

- Returns before registering anything when `season === null`. When `opacity === 0` (below zoom 16) it hands over `[]` and stops reading tiles.
- `build()`: `map.querySourceFeatures("openmaptiles", { sourceLayer: "poi", filter: STOP_FILTER })` → stop points; `sourceLayer: "transportation"` → `TrafficLine`s (LineString and MultiLineString, `properties.class`); `sourceLayer: "building"` → outer rings. Then `pumpkinsInView(stops, traffic, buildings, cappedViewBounds(map), chasing ? { avoid: { position: chased lng/lat, radiusM: CHASE_CLEARANCE_M } } : undefined)`. Elevation per pumpkin with `map.queryTerrainElevation(position) ?? 0`. Skip the handover when the key (pumpkin keys plus elevations, as the stop poles do) is unchanged.
- Triggers: `moveend`, `terrain`, `sourcedata` for the terrain source or `openmaptiles` with a `tile` — all through one `throttle(build, chasing ? PUMPKIN_CHASE_INTERVAL_MS : 250)`, cancelled on cleanup. During a chase `moveend` fires every frame; the throttle is what keeps it to once a second.
- Dev only: `window.__pumpkins = { count }` after each build, `undefined` on cleanup (as `useKiosk` sets `__kiosk`).
- `MapView` computes `const season = useMemo(() => seasonOn(new Date(), window.location.search), [])`.

- [ ] **Step 1: Implement** `usePumpkins` and the two modifications.
- [ ] **Step 2: Run** `npx vitest run && npm run lint` — Expected: all pass, no warnings.
- [ ] **Step 3: Run** `npm run dev`, open `/?season=halloween`, zoom to 17 at Jernbanetorget, switch to 3D. Expected: pumpkins near stops, none on a road or track, in both schemes; `window.__pumpkins.count` between 1 and 200. Open `/` (not in season on any day outside the window) and `/?season=none`: `window.__pumpkins` is `undefined`.
- [ ] **Step 4: Commit** `git commit -m "Show pumpkins near stops in the Halloween season"`

### Task 6: Playwright check, measurement and docs

**Files:**

- Create: `tests/seasonal.spec.ts`
- Modify: `CLAUDE.md` (a short "Seasonal decorations" section: where the pieces live, the one-overlay rule, `?season`), `docs/superpowers/specs/2026-10-20-seasonal-decorations-design.md` (a "Measured" section)

- [ ] **Step 1: Write the test** — it uses `__vehicleMap.jumpTo` like `tests/weather.spec.ts`:

```ts
test("pumpkins appear near stops in season", async ({ page }) => {
  await page.goto("/?season=halloween");
  await page.waitForFunction(() => (window as TestWindow).__vehicleMap);
  await page.evaluate(() =>
    (window as TestWindow).__vehicleMap!.jumpTo({
      center: [10.7509, 59.9114],
      zoom: 17,
    }),
  );
  await expect
    .poll(
      () => page.evaluate(() => (window as TestWindow).__pumpkins?.count ?? 0),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});
test("no pumpkins with season=none", async ({ page }) => {
  await page.goto("/?season=none");
  // same jump, then wait for the map to be idle
  expect(
    await page.evaluate(() => (window as TestWindow).__pumpkins),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run** `npx playwright test tests/seasonal.spec.ts --project=chromium` — Expected: 2 passed.
- [ ] **Step 3: Measure** on dev (`npm run dev` against `api.dev.entur.io`), Chrome, 3D, Oslo sentrum at zoom 17: fps from the Performance panel's frame rate over 20 s of slow panning, with `?season=halloween` and `?season=none`, light and dark; and the same pair during a chase of a bus through sentrum (`?kiosk=180&season=…`). Expected: no measurable drop. If there is one, stop and report it before going on.
- [ ] **Step 4: Write** the numbers into the spec's "Measured" section and the CLAUDE.md section.
- [ ] **Step 5: Commit** `git commit -m "Test and measure the Halloween pumpkins"`
