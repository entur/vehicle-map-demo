# Christmas Trees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the first Sunday of Advent through 6 January, one gently twinkling Christmas tree stands at every stop on the 3D map, on the same placement machinery as the Halloween pumpkins.

**Architecture:** The pumpkin placement, controller and hook become season-neutral "decoration" code driven by a per-season `DecorationSpec`. A new tree mesh is drawn as a handful of `SimpleMeshLayer`s. Its bulbs twinkle through a small deck.gl `LayerExtension`: a per-tree phase attribute is uploaded once, and a time/amount uniform is changed per tick. A plain-TypeScript `TwinkleClock` drives the ticks and stops them after 60 s without input or camera movement.

**Tech Stack:** TypeScript, React 19, MapLibre GL 6, deck.gl 9.4 (`@deck.gl/core` `LayerExtension`, `@deck.gl/mesh-layers` `SimpleMeshLayer`), Vitest (node, `src/**/*.test.ts` only), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-christmas-trees-design.md` (builds on `docs/superpowers/specs/2026-10-20-seasonal-decorations-design.md`). Read both.

## Global Constraints

- Window: first Sunday of Advent through 6 January inclusive, judged by the date in Europe/Oslo; `?season=christmas` forces on, `?season=none` forces off.
- One tree per stop, 4–5 m tall, 3–15 m from the stop, up to 24 spots tried; clearance from the road edge is measured from the canopy's widest point and is never relaxed.
- Halloween must not change: same pumpkins, same positions, same draws. A refactor that moves one pumpkin is a regression.
- Twinkle: slow brightness fades, each group cycling over roughly 2–4 s, with no blinking. Each tree has its own phase. Per tick only a uniform changes: no re-placement, no mesh rebuild, no tile read, no per-instance attribute upload.
- Twinkling runs only while trees are drawn, the page is visible and reduced motion is off. After 60 s with no input and no camera movement it eases to steady, fully lit, over about 1 s, and the map stops repainting.
- Lights are drawn in both schemes; they glow (lamp material) in dark mode only.
- No snow, sky or weather change.
- Testable logic in plain `.ts` (Vitest does not collect `.tsx`). Local imports carry `.ts`/`.tsx`. `npm run lint` with zero warnings. Type-check with `npx tsc --noEmit -p tsconfig.app.json` (the root tsconfig checks nothing).
- No codespace ids in code comments. Stage files by explicit path (`build/` and `*.iml` are untracked); never `git add -A`.
- Commit messages follow the repo: a plain imperative sentence, no prefix.

## Review Focus

1. **A pumpkin moves after the refactor.** Expected: byte-identical pumpkins for the same inputs. Pinned by the golden test in Task 2.
2. **Year boundary in Oslo time.** At 23:30 UTC on 6 January it is already 7 January in Oslo: off. On 31 December and 1 January: on. Pinned in Task 1.
3. **A chasing kiosk with no input.** The camera moves every frame, and that must count as activity, so its trees keep twinkling. Pinned in Task 6 (`move` resets idle).
4. **Scheme switch or fade step while idle.** Rebuilt layers must carry the clock's current amount (0), not a default of 1, or steady lights start twinkling again with nothing to stop them. Pinned in Task 6 (`current()` after idle) and used in Task 7.
5. **Trees leave the view while the ticker runs**, by zooming out below 16 or the season ending. The ticker must stop, and nothing may fire after dispose. Pinned in Task 6.

---

### Task 1: Christmas season window

**Files:**

- Modify: `src/domain/season.ts`
- Test: `src/domain/season.test.ts`

**Interfaces:**

- Produces: `type Season = "halloween" | "christmas"`; `firstAdventSunday(year: number): [month: number, day: number]`; `seasonOn(now: Date, search: string): Season | null` (unchanged signature).

- [ ] **Step 1: Write the failing tests** (keep every existing Halloween test unchanged)

```ts
describe("firstAdventSunday", () => {
  it.each([
    [2026, [11, 29]],
    [2027, [11, 28]],
    [2028, [12, 3]],
    [2029, [12, 2]],
    [2030, [12, 1]],
    [2033, [11, 27]],
  ])("%i", (year, expected) =>
    expect(firstAdventSunday(year)).toEqual(expected),
  );
});

describe("christmas", () => {
  const at = (iso: string) => seasonOn(new Date(iso), "");
  it("starts on the first Sunday of Advent", () => {
    expect(at("2026-11-29T12:00:00+01:00")).toBe("christmas");
    expect(at("2026-11-28T12:00:00+01:00")).toBeNull();
  });
  it("runs across the new year through 6 January", () => {
    expect(at("2026-12-31T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-01T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-06T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-07T12:00:00+01:00")).toBeNull();
  });
  it("judges by the date in Oslo", () => {
    expect(at("2027-01-06T23:30:00Z")).toBeNull(); // 7 Jan in Oslo
    expect(at("2026-11-28T23:30:00Z")).toBe("christmas"); // 29 Nov in Oslo
  });
  it("starts on 3 December in 2028", () => {
    expect(at("2028-12-02T12:00:00+01:00")).toBeNull();
    expect(at("2028-12-03T12:00:00+01:00")).toBe("christmas");
  });
  it("is forced with season=christmas and off with season=none", () => {
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=christmas"),
    ).toBe("christmas");
    expect(
      seasonOn(new Date("2026-12-24T12:00:00+01:00"), "?season=none"),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/season.test.ts`. Expected: FAIL (`firstAdventSunday` not exported).

- [ ] **Step 3: Implement.**
  - Add the year to `OSLO_DATE`.
  - Replace the `from`/`to` pairs with a per-season predicate over the Oslo date: `SEASONS: { id: Season; isOn: (year: number, month: number, day: number) => boolean }[]`. Halloween stays 24 Oct – 1 Nov.
  - Christmas is on when (month, day) ≥ `firstAdventSunday(year)`, or when month is 1 and day ≤ 6.
  - `firstAdventSunday`: take the weekday `w` of 25 December (UTC date arithmetic). The fourth Advent Sunday is 25 Dec − (`w === 0 ? 7 : w`) days, and the first is 21 days earlier.
  - Update the doc comment: wrapping windows are now supported.

- [ ] **Step 4: Run** `npx vitest run src/domain/season.test.ts`. Expected: PASS, old tests included.

- [ ] **Step 5: Commit**

```bash
git add src/domain/season.ts src/domain/season.test.ts
git commit -m "Add the Christmas season, from the first Sunday of Advent through 6 January"
```

---

### Task 2: Season-neutral decoration placement

**Files:**

- Rename: `src/domain/pumpkinPlacement.ts` → `src/domain/decorationPlacement.ts`
- Rename: `src/domain/pumpkinPlacement.test.ts` → `src/domain/decorationPlacement.test.ts`
- Modify: every importer (`src/domain/vehicleMeshes.ts`, `src/components/Seasonal/*`)

**Interfaces:**

- Consumes: `Season` (Task 1).
- Produces:

  ```ts
  export type Decoration = {
    key: string;
    position: LngLat;
    height: number;
    yaw: number;
    tint: [number, number, number];
    /** 0–1, from the key's hash, not the random stream; drives the twinkle. */
    phase: number;
  };
  export type DecorationSpec = {
    perStop: [min: number, max: number];
    heightM: [number, number];
    /** Footprint diameter over height: the widest point. */
    aspect: number;
    spreadM: [number, number];
    candidates: number;
    tints: [[number, number, number], [number, number, number]];
  };
  export const PUMPKIN_ASPECT = 1.3;
  export const TREE_ASPECT = 0.55;
  export const DECORATIONS: Record<Season, DecorationSpec>;
  export const DECORATION_CAP = 200;
  export type DecorationCache = Map<string, CachedStop>;
  export function decorationsAtStop(
    spec: DecorationSpec,
    stop: LngLat,
    traffic: TrafficLine[],
    buildings: BuildingRing[],
  ): Decoration[];
  export function decorationsInView(
    spec: DecorationSpec,
    stops: LngLat[],
    traffic: TrafficLine[],
    buildings: BuildingRing[],
    view: ViewBounds,
    options?: { cache?: DecorationCache },
  ): Decoration[];
  ```

  `TRAFFIC_HALF_WIDTH_M`, `CLEARANCE_M`, `stopKey`, `TrafficLine` and `BuildingRing` keep their names.

- [ ] **Step 1: Capture the golden output before touching the code.** Add a test to the _current_ `pumpkinPlacement.test.ts` that runs `pumpkinsInView` over a fixed scene and compares it with an inline snapshot (`toMatchInlineSnapshot`):
  - a 5×5 grid of stops 60 m apart around `OSLO`
  - a primary road through the middle row
  - a building ring next to the centre stop

  Run `npx vitest run src/domain/pumpkinPlacement.test.ts -u` once to fill it in. Expected: the snapshot is written and the test passes.

- [ ] **Step 2: Rename and generalise the tests.**
  - `git mv` both files.
  - Every existing `pumpkinsAtStop(stop, …)` becomes `decorationsAtStop(DECORATIONS.halloween, stop, …)`, and likewise for `pumpkinsInView`.
  - Rename `PUMPKIN_CAP` to `DECORATION_CAP`.
  - Assertion values stay as they are.
  - In the golden test, map each result to omit `phase` (or snapshot it as well, since it is new) so that the existing fields are compared unchanged.
  - Add:

```ts
describe("christmas trees", () => {
  const trees = DECORATIONS.christmas;
  it("puts exactly one tree at a stop with room", () => {
    expect(decorationsAtStop(trees, OSLO, [], [])).toHaveLength(1);
  });
  it("keeps every tree 4–5 m tall and 3–15 m from its stop", () => {
    /* over 50 stops */
  });
  it("keeps the canopy, not just the trunk, clear of a primary road", () => {
    // road 8 m east; every tree's centre is ≥ 7 + CLEARANCE_M + TREE_ASPECT*height/2 from the centre line
  });
  it("gives each tree a phase in [0, 1) that differs between neighbouring stops", () => {});
});
```

- [ ] **Step 3: Run** `npx vitest run src/domain/decorationPlacement.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement.**
  - `pumpkinsAtStop`/`pumpkinsInView` take a spec. The random draws stay in the same order: count, then per decoration height, yaw and tint t, then all candidates.
  - The count is `perStop[0] + Math.floor(random() * (perStop[1] - perStop[0] + 1))`, so for pumpkins `[1, 3]` it is the same draw as before.
  - `REACH_M` is computed per spec.
  - `phase` is `hash(key) / 2 ** 32` of the decoration's own key, so the random stream is not touched.
  - `DECORATIONS.halloween` is today's constants exactly: `perStop [1, 3]`, height `[2, 3]`, `PUMPKIN_ASPECT`, spread `[3, 15]`, 24 candidates, and today's `TINTS`.
  - `DECORATIONS.christmas`: `perStop [1, 1]`, height `[4, 5]`, `TREE_ASPECT`, spread `[3, 15]`, 24 candidates, tints `[0x2e,0x6b,0x3a]` → `[0x3f,0x7d,0x45]`.
  - Update `vehicleMeshes.ts`'s import of `PUMPKIN_ASPECT`.
  - Leave the old file's doc comments in place, reworded so they are season-neutral.

- [ ] **Step 5: Run** `npx vitest run src/domain/`. Expected: PASS, the golden test included, with no snapshot change to the existing fields.

- [ ] **Step 6: Commit**

```bash
git add src/domain/decorationPlacement.ts src/domain/decorationPlacement.test.ts src/domain/pumpkinPlacement.ts src/domain/pumpkinPlacement.test.ts src/domain/vehicleMeshes.ts src/components/Seasonal/
git commit -m "Make the pumpkin placement a placement for any season's decorations"
```

---

### Task 3: Season-neutral controller

**Files:**

- Rename: `src/components/Seasonal/pumpkinController.ts` → `decorationController.ts`, and its test likewise

**Interfaces:**

- Consumes: `DecorationSpec`, `decorationsInView`, `DecorationCache`, `Decoration` (Task 2).
- Produces: `class DecorationController` with constructor `(map: DecorationMap, options: { spec: DecorationSpec; viewBounds: () => ViewBounds; intervalMs: number; onPlaced: (placed: Placed) => void })`. Also `type Placed = { decorations: Decoration[]; elevations: number[]; key: string }`, `NOTHING_PLACED`, `DECORATION_SOURCE = "openmaptiles"` and `type DecorationMap`. The error log reads `"Seasonal decorations could not be placed"`.

- [ ] **Step 1:** `git mv` both files. Update the tests to construct with `spec: DECORATIONS.halloween` and to use the new names. Add one test: with `spec: DECORATIONS.christmas` and one clear stop, `onPlaced` receives exactly one decoration. In `pumpkinLayers.test.ts`, the fixture becomes a `Decoration`, with `phase: 0` added.
- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/decorationController.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Rename the class and its types and pass `spec` through to `decorationsInView`. Behaviour is otherwise unchanged. Update `usePumpkins.ts` and `pumpkinLayers.ts` to the new names; `pumpkinLayers` now takes `Decoration[]`.
- [ ] **Step 4: Run** `npx vitest run src/components/Seasonal/ && npx tsc --noEmit -p tsconfig.app.json`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/
git commit -m "Let the decoration controller place any season's decorations"
```

---

### Task 4: Christmas tree mesh

**Files:**

- Modify: `src/domain/vehicleMeshes.ts`
- Test: `src/domain/vehicleMeshes.test.ts`

**Interfaces:**

- Consumes: `TREE_ASPECT` (Task 2).
- Produces:

  ```ts
  export const TREE = {
    height: 1,
    width: TREE_ASPECT,
    trunkHeight: 0.12,
    tiers: 3,
    bulbGroups: 3,
    bulbs: 24,
  } as const;
  export type ChristmasTreeModel = {
    canopy: VehicleMesh; // white, tinted per tree
    trunk: VehicleMesh; // fixed brown
    star: VehicleMesh; // lamp colour, steady
    bulbs: VehicleMesh[]; // length TREE.bulbGroups, lamp colours
  };
  export function christmasTreeModel(): ChristmasTreeModel; // built once, cached
  ```

  Add to `MESH_COLOURS` and `LAMP_COLOURS`: `treeStar` (gold), `bulbWarm`, `bulbRed`, `bulbGold`, `bulbBlue`. Add `treeTrunk` to `MESH_COLOURS` only.

- [ ] **Step 1: Write the failing tests**, next to the pumpkin's:
  - has whole triangles with one normal and one colour per vertex in every mesh
  - has unit normals
  - has a pure white canopy
  - stands one unit tall on the ground, with the canopy's widest point `TREE_ASPECT` wide (±0.02) and centred, so placement's footprint is the mesh's
  - has `TREE.bulbGroups` bulb meshes, each non-empty, each containing all four bulb colours, and together `TREE.bulbs` bulbs
  - keeps every bulb on the canopy's surface: within 0.02 of the cone it sits on and above the trunk
  - is the same object on a second call
- [ ] **Step 2: Run** `npx vitest run src/domain/vehicleMeshes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `christmasTreeModel`** with `MeshBuilder`, low-poly in the pumpkin's style:
  - a square trunk (`box`) to `trunkHeight`
  - three stacked 8-sided cones from `triangle`s, each narrower and higher, the bottom one `TREE_ASPECT` wide
  - a small star (a flattened octahedron) at the top, with `treeStar` as `lamps`
  - bulbs as tiny boxes about 0.025 a side, a hair proud of the cone surface. Place them deterministically on a golden-angle spiral up the canopy. Bulb `i` goes in group `i % bulbGroups` with colour `[warm, red, gold, blue][Math.floor(i / bulbGroups) % 4]`, so every group carries every colour. Each group is built with its own `MeshBuilder`, and its `lamps` mesh is taken.
- [ ] **Step 4: Run** `npx vitest run src/domain/vehicleMeshes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/domain/vehicleMeshes.ts src/domain/vehicleMeshes.test.ts
git commit -m "Build a low-poly Christmas tree with three groups of bulbs"
```

---

### Task 5: The twinkle curve

**Files:**

- Create: `src/domain/twinkle.ts`
- Test: `src/domain/twinkle.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export const TWINKLE_PERIOD_S = 3;
  export const TWINKLE_MIN = 0.35; // dimmest a bulb gets, as a share of full
  export const TWINKLE_IDLE_MS = 60_000;
  export const TWINKLE_SETTLE_MS = 1_000;
  /** Brightness 0–1 of `group` (of `groups`) on a tree with `phase`, at `timeS`; `amount` 0 = steady fully lit, 1 = full twinkle. */
  export function twinkleBrightness(
    timeS: number,
    phase: number,
    group: number,
    groups: number,
    amount: number,
  ): number;
  /** How much twinkle to show: 1 while active, easing to 0 over TWINKLE_SETTLE_MS after TWINKLE_IDLE_MS without activity; 0 under reduced motion. */
  export function twinkleAmount(
    nowMs: number,
    lastActivityMs: number,
    reducedMotion: boolean,
  ): number;
  ```

  The curve, which the shader in Task 6 must reproduce exactly:

  ```ts
  const wave =
    0.5 -
    0.5 *
      Math.cos(
        2 * Math.PI * (timeS / TWINKLE_PERIOD_S + phase + group / groups),
      );
  return 1 - amount * (1 - TWINKLE_MIN) * wave;
  ```

  The amount eases with smoothstep from 1 to 0 across `[TWINKLE_IDLE_MS, TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS]`.

- [ ] **Step 1: Write the failing tests:**
  - stays within `[TWINKLE_MIN, 1]`
  - has a period of `TWINKLE_PERIOD_S`
  - two trees with phases 0 and 0.37 differ at the same time
  - two groups of one tree are out of step
  - `amount` 0 gives 1 at every time
  - never changes by more than 0.1 between ticks 1/12 s apart, so it never blinks
  - `twinkleAmount`: 1 at 59 s idle, strictly between 0 and 1 at 60.5 s, 0 at 61 s and later, 0 always under reduced motion
- [ ] **Step 2: Run** `npx vitest run src/domain/twinkle.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/domain/twinkle.ts src/domain/twinkle.test.ts
git commit -m "Define the gentle twinkle of the Christmas lights"
```

---

### Task 6: TwinkleClock

**Files:**

- Create: `src/components/Seasonal/twinkleClock.ts`
- Test: `src/components/Seasonal/twinkleClock.test.ts`

**Interfaces:**

- Consumes: `twinkleAmount`, `TWINKLE_IDLE_MS`, `TWINKLE_SETTLE_MS` (Task 5).
- Produces:

  ```ts
  export type TwinkleState = { timeS: number; amount: number };
  export const TWINKLE_TICK_MS = 80; // ~12 updates a second
  export class TwinkleClock {
    constructor(
      map: Pick<MapLibreMap, "on" | "off" | "triggerRepaint">,
      options: {
        reducedMotion: boolean;
        onTick: (state: TwinkleState) => void;
        now?: () => number; // injectable for tests
        isVisible?: () => boolean; // defaults to document.visibilityState === "visible"
      },
    );
    /** Input or camera movement: twinkle again from full. */
    activity(): void;
    current(): TwinkleState;
    dispose(): void;
  }
  ```
  - It listens to the map's `move` and calls `activity()` from it, which covers the chase and kiosk cameras. Input events reach it through `activity()` from the hook.
  - While `amount > 0` and the page is visible, it ticks every `TWINKLE_TICK_MS`, calls `onTick` and then `map.triggerRepaint()`.
  - Once the amount reaches 0 it emits one final tick and stops its timer. `activity()` starts the timer again.
  - Under reduced motion it never starts a timer, and `current()` is `{ timeS: 0, amount: 0 }`.

- [ ] **Step 1: Write the failing tests**, with `vi.useFakeTimers()` and a fake map in the style of `decorationController.test.ts`:
  - ticks and repaints while active
  - stops ticking after `TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS`, with a last tick at amount 0, and no repaints for the next 10 s
  - `current().amount` is 0 after idle (Review Focus 4)
  - a map `move` restarts the ticking and the amount is 1 again (Review Focus 3)
  - `activity()` restarts it too
  - nothing ticks under reduced motion
  - nothing ticks while `isVisible` returns false
  - no tick fires after `dispose()`, and the `move` listener is removed (Review Focus 5)
- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/twinkleClock.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Record the last activity time in a field; `move` only writes that field, so a chase pays one assignment per frame.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/twinkleClock.ts src/components/Seasonal/twinkleClock.test.ts
git commit -m "Tick the twinkle while someone is there, and stop when idle"
```

---

### Task 7: Twinkle extension and tree layers

**Files:**

- Create: `src/components/Seasonal/twinkleExtension.ts`, `src/components/Seasonal/christmasTreeLayers.ts`
- Test: `src/components/Seasonal/christmasTreeLayers.test.ts`

**Interfaces:**

- Consumes: `christmasTreeModel`, `TREE` (Task 4); `TwinkleState` (Task 6); `TWINKLE_PERIOD_S`, `TWINKLE_MIN` (Task 5); `MODEL_MATERIALS`, `MODEL_BEFORE_LAYER`, `UNTINTED` (existing, `vehicleModelLayers.ts`).
- Produces:

  ```ts
  // twinkleExtension.ts
  export type TwinkleExtensionProps<D> = {
    getPhase: (d: D) => number;
    twinkleTimeS: number;
    twinkleAmount: number;
    twinkleGroup: number;
    twinkleGroups: number;
  };
  export class TwinkleExtension extends LayerExtension {
    static extensionName = "TwinkleExtension";
  }
  // christmasTreeLayers.ts — same options as pumpkinLayers plus twinkle
  export type TreeLayerOptions = PumpkinLayerOptions & {
    twinkle: TwinkleState;
  };
  export function christmasTreeLayers(
    trees: Decoration[],
    options: TreeLayerOptions,
  ): SimpleMeshLayer<Decoration>[];
  ```
  - **The extension.** `initializeState` adds an instanced attribute `instancePhases` (size 1, accessor `getPhase`). `getShaders` returns a shader module with uniforms `timeS`, `amount`, `group` and `groups` (deck 9 / luma 9 uniform block, `uniformTypes` as `f32`). It injects into `vs:#decl` and `vs:DECKGL_FILTER_COLOR`, multiplying `color.rgb` by the Task 5 curve. Interpolate `TWINKLE_PERIOD_S` and `TWINKLE_MIN` into the GLSL from the domain constants so the two cannot drift. `draw` calls `this.setShaderModuleProps({ twinkle: {…} })` from the layer's props.
  - **The layers.** There are `3 + TREE.bulbGroups` layers:
    - `seasonal-trees-canopy`: tinted, `materials.shaded`
    - `seasonal-trees-trunk`: `UNTINTED`, shaded
    - `seasonal-trees-star`: `UNTINTED`, `materials.lamps`
    - `seasonal-trees-bulbs-<g>`: `UNTINTED`, `materials.lamps`, `extensions: [new TwinkleExtension()]`, `getPhase: (d) => d.phase`, and the twinkle props from `options.twinkle`

    The bulbs are drawn in both schemes. Keep one `TwinkleExtension` instance at module level, so a rebuild per tick does not count as an extension change.

- [ ] **Step 1: Write the failing tests:**
  - builds nothing while hidden or empty
  - has the same layer count for 1 and 200 trees
  - draws the bulbs and star in light mode as well as dark
  - uses lamp materials in dark mode
  - draws under `MODEL_BEFORE_LAYER`
  - gives every bulb layer the twinkle props from the options and `getPhase` returning `tree.phase`
  - passes the same `data` and `mesh` objects on two builds with different `twinkle`, so a tick changes uniforms only
  - `TwinkleExtension`'s shader source contains `TWINKLE_PERIOD_S` and `TWINKLE_MIN`'s values
- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/christmasTreeLayers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** `npx vitest run src/components/Seasonal/ && npx tsc --noEmit -p tsconfig.app.json`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/twinkleExtension.ts src/components/Seasonal/christmasTreeLayers.ts src/components/Seasonal/christmasTreeLayers.test.ts
git commit -m "Draw the Christmas trees, with bulbs that twinkle in the shader"
```

---

### Task 8: Wire up the season, then check it in the browser

**Files:**

- Rename: `src/components/Seasonal/usePumpkins.ts` → `useSeasonalDecorations.ts`
- Modify: `src/components/Vehicle/VehicleModels.tsx` (import, call site at the end)
- Modify: `tests/seasonal.spec.ts`

**Interfaces:**

- Consumes: Tasks 1–7.
- Produces: `useSeasonalDecorations({ map, season, opacity, scheme, chasing, onLayers })`, with the same arguments as `usePumpkins`. `PUMPKIN_CHASE_INTERVAL_MS` becomes `DECORATION_CHASE_INTERVAL_MS`. The dev hook is `window.__seasonal = { season, count, twinkling: boolean }`, cleared when `season` is null.

- [ ] **Step 1: Update the Playwright tests first.**
  - Read `__seasonal` instead of `__pumpkins`. Existing Halloween assertions also check `season === "halloween"`.
  - Add: with `?season=christmas` at Majorstuen, zoom 17.5, `count > 0` and `season === "christmas"`.
  - Add: with `?season=christmas` and `page.emulateMedia({ reducedMotion: "reduce" })`, `twinkling` is false.
  - The `season=none` test expects `__seasonal` to be undefined.
- [ ] **Step 2: Run** `npx playwright test tests/seasonal.spec.ts --project=chromium`. Expected: FAIL (`__seasonal` undefined).
- [ ] **Step 3: Implement the hook.**
  - Create the `DecorationController` with `DECORATIONS[season]`.
  - Choose `pumpkinLayers` or `christmasTreeLayers` by season.
  - For Christmas, while anything is placed and visible, create a `TwinkleClock` whose `reducedMotion` comes from `matchMedia("(prefers-reduced-motion: reduce)")`. Feed `activity()` from `useKioskInput(enabled, onInput)`; despite its name it is a generic input listener.
  - Keep the clock's latest state in a ref. `onTick` rebuilds the layers from the current `placed` with the new state and calls `onLayers`, with no React state set per tick.
  - The existing effect that rebuilds on `placed`/`opacity`/`scheme` reads `clock.current()` (Review Focus 4).
  - Dispose the clock when trees go away, the season is null, or the layers are hidden.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npx playwright test tests/seasonal.spec.ts --project=chromium`. Expected: everything passes, with zero lint warnings.
- [ ] **Step 5: Look at it.** Use a headless Playwright script with swiftshader on :5173, not the Chrome extension, which never loads MapLibre. Check `?season=christmas&view=3d` at Majorstuen, zoom 17, in both schemes:
  - the trees stand off the roads
  - the bulbs fade gently, with trees out of step with each other
  - with reduced motion emulated, the lights are steady

  Take screenshots for the user.

- [ ] **Step 6: Commit**

```bash
git add src/components/Seasonal/ src/components/Vehicle/VehicleModels.tsx tests/seasonal.spec.ts
git commit -m "Put a twinkling Christmas tree at every stop in Advent"
```

---

### Task 9: Density, measurements and docs

**Files:**

- Modify: `src/domain/decorationPlacement.ts` (only if tuning is needed)
- Modify: `docs/superpowers/specs/2026-10-20-christmas-trees-design.md` (a "Measured" section)
- Modify: `CLAUDE.md` ("Seasonal decorations")

- [ ] **Step 1: Measure density.** Count trees at stops with trees, in the same views as the pumpkin table: Oslo sentrum (3D, zoom 16.5, pitch 60), Majorstuen (zoom 17), Bergen sentrum (zoom 16), Aker brygge (zoom 16.5). If fewer than about half the stops in a city centre get a tree, raise `spreadM[1]` and/or `candidates` in `DECORATIONS.christmas` only, and measure again, density and placement time both. Never change `CLEARANCE_M`, `TRAFFIC_HALF_WIDTH_M` or `TREE_ASPECT` for this. Write the table with before and after values.
- [ ] **Step 2: Measure frames,** as in the Halloween table, in Oslo sentrum, 3D:
  - a 10 s rotation in both schemes, with `?season=none` and with `?season=christmas`
  - a 20 s chase in dark mode
  - **10 s still while twinkling**: fps, and the number of frames over 25 ms
  - **10 s still after 60 s idle**: the number of MapLibre `render` events, expected 0

  Write the numbers into the spec's "Measured" section.

- [ ] **Step 3: Update CLAUDE.md's "Seasonal decorations".**
  - Cover both seasons: the window, `?season=christmas`, the shared `DecorationSpec`/`DecorationController`/`useSeasonalDecorations`, and the golden test guarding the pumpkins.
  - Describe the tree layers.
  - Describe the twinkle: a per-tree phase attribute plus uniforms from `TwinkleExtension`, with `twinkle.ts` as the curve's single definition and the GLSL interpolating its constants. Also `TwinkleClock` (60 s idle, `move` counts as activity, a final tick then no repaints) and reduced motion.
  - Note that `window.__seasonal` replaces `__pumpkins`.
- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-20-christmas-trees-design.md CLAUDE.md src/domain/decorationPlacement.ts src/domain/decorationPlacement.test.ts
git commit -m "Measure the Christmas trees and document both seasons"
```
