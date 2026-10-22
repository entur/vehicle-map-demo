# New Year's Fireworks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 27 December to 1 January, glowing fireworks burst over the city in the 3D map: scattered rockets while someone is there, a barrage every five minutes on the wall clock (even on an idle screen), and a finale at midnight on New Year's Eve.

**Architecture:** Pure rules in `src/domain/` (season window, flight and spark curves, the barrage schedule), a plain-TypeScript show (what is in the air) and clock (when to draw frames), and one deck.gl `SimpleMeshLayer` of spark instances whose motion is computed in the vertex shader by a `FireworksExtension`, like `FlutterExtension`. A `useSeasonalFireworks` hook hands the layers to `VehicleModels`' single interleaved overlay through their own ref, like the flags. A barrage wakes the Christmas lights' clock for the barrage alone through a new `AnimationClock.holdAwake`.

**Tech Stack:** React 19, MapLibre GL, deck.gl 9.4 (`@deck.gl/core`, `@deck.gl/mesh-layers`; no new dependency), Vitest (node environment), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-new-year-fireworks-design.md`

## Global Constraints

- Season: **27 December to 1 January** inclusive, Europe/Oslo dates, around the clock. It overlaps Christmas; trees stay up under the fireworks.
- `?season=newyear` forces fireworks **and** trees; `?season=christmas` shows trees without fireworks; `?season=none` forces everything off.
- Drawn **only in 3D**, and only while the models are shown (from `VEHICLE_MODEL_MIN_ZOOM`, 16). Otherwise nothing is drawn, computed or scheduled.
- Idle after `ANIMATION_IDLE_MS` (60 s) without input (`useKioskInput`'s events), `move` or `visibilitychange` to visible: no new scattered rockets; what is in the air finishes; then no frames at all.
- Barrage every **5 minutes on the wall clock** (:00, :05…, Oslo time); it fires on idle screens too, and an idle screen is idle again as soon as it has faded. The **finale** replaces the 00:00 slot of 1 January (Oslo time).
- Barrage: **24 rockets over 10 s**. Finale: **72 rockets over 60 s**. Scattered: one every **2–4 s** while active. Bursts **100–300 m** above the ground.
- A barrage's timing, count, colours and layout are derived from its slot's time, laid out over **each screen's own view** (`cappedViewBounds`, never `map.getBounds()`).
- A missed slot (page hidden, 2D, zoomed out) is **not** fired late; a screen arriving mid-barrage joins from where it is.
- **No fireworks under `prefers-reduced-motion: reduce`** — no frames, no timers.
- Dark mode blends sparks additively; light mode uses ordinary alpha blending. Neither writes depth.
- Per frame only uniforms change: layer data is rebuilt on a launch or a prune, never per frame.
- `window.__seasonal` keeps its shape and gains `rockets`; both writers spread the previous value so neither drops the other's fields.
- Repo rules: local imports carry `.ts`/`.tsx`; testable logic in plain `.ts` (Vitest collects `src/**/*.test.ts` only); type-check with `npx tsc --noEmit -p tsconfig.app.json`; `npm run lint` with zero warnings; stage by explicit path, never `git add -A`; no codespace ids in comments; never push.

## Review Focus

1. **A page hidden for an hour, then shown mid-barrage** — must not launch every missed rocket at once. Pinned in Task 5 (`skips launches older than LAUNCH_GRACE_MS`).
2. **An idle screen between barrages** — must request no frames at all until the next slot. Pinned in Task 6 (`requests no frame between barrages when idle`).
3. **A wall screen left running for days** — float32 time must not step. Pinned in Task 7 (`launch times are relative to the data's own epoch`).
4. **Reduced motion** — no timers and no frames, not merely invisible sparks. Pinned in Task 6 (`does nothing under reduced motion`).
5. **A launch over a terrain tile still loading** (elevation 0 or null on a hill) — must not burst underground. Pinned in Task 3 (`groundFor`).

---

### Task 1: The fireworks window beside the season

**Files:**

- Modify: `src/domain/season.ts`
- Test: `src/domain/season.test.ts`

**Interfaces:**

- Produces: `fireworksOn(now: Date, search: string): boolean`; `seasonOn` answers `"christmas"` for `?season=newyear`. `Season` is unchanged.

- [ ] **Step 1: Write the failing tests** (add a `describe("fireworksOn")` and two `seasonOn` cases)

```ts
describe("fireworksOn", () => {
  it("is on from 27 Dec to 1 Jan inclusive, Oslo dates", () => {
    expect(fireworksOn(new Date("2026-12-26T12:00:00+01:00"), "")).toBe(false);
    expect(fireworksOn(new Date("2026-12-27T00:30:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2026-12-31T23:59:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2027-01-01T23:59:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2027-01-02T00:00:00+01:00"), "")).toBe(false);
  });
  it("judges the date in Oslo, not UTC", () => {
    // 23:30 UTC on 26 Dec is 00:30 on 27 Dec in Oslo.
    expect(fireworksOn(new Date("2026-12-26T23:30:00Z"), "")).toBe(true);
    // 23:30 UTC on 1 Jan is 00:30 on 2 Jan in Oslo.
    expect(fireworksOn(new Date("2027-01-01T23:30:00Z"), "")).toBe(false);
  });
  it("is forced on by season=newyear, off by any other forced season", () => {
    const june = new Date("2026-06-01T12:00:00Z");
    const dec28 = new Date("2026-12-28T12:00:00Z");
    expect(fireworksOn(june, "?season=newyear")).toBe(true);
    expect(fireworksOn(dec28, "?season=christmas")).toBe(false);
    expect(fireworksOn(dec28, "?season=none")).toBe(false);
    expect(fireworksOn(dec28, "?season=easter")).toBe(true);
  });
});

it("keeps the trees up under the fireworks", () => {
  expect(seasonOn(new Date("2026-12-28T12:00:00Z"), "")).toBe("christmas");
  expect(seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=newyear")).toBe(
    "christmas",
  );
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/season.test.ts` — Expected: FAIL, `fireworksOn` is not exported.
- [ ] **Step 3: Implement.** `fireworksOn` reuses the existing Oslo date parts (factor the parsing out of `seasonOn` into one private helper rather than copying it). `seasonOn` maps a forced `newyear` to `"christmas"` before the `isSeason` check. Doc comment: the fireworks are an addition on top of the season, not one of `SEASONS`, because they overlap Christmas.
- [ ] **Step 4: Run** `npx vitest run src/domain/season.test.ts` — Expected: PASS, existing cases unchanged.
- [ ] **Step 5: Commit**

```bash
git add src/domain/season.ts src/domain/season.test.ts
git commit -m "Add the New Year's fireworks window beside the season"
```

---

### Task 2: The flight and spark curves

**Files:**

- Create: `src/domain/fireworks.ts`
- Test: `src/domain/fireworks.test.ts`

**Interfaces:**

- Produces (all exported):
  - `RISE_S` (rocket climb, seconds), `SPARK_LIFE_S`, `SPARK_GRAVITY` (m/s²), `SPARK_DRAG` (1/s), `TRAIL_SAMPLES`, `TRAIL_LAG_S` — starting values `1.6`, `2.4`, `9.8`, `1.4`, `4`, `0.05`; the builder tunes them in Task 9.
  - `type Vec3 = [number, number, number]` (east, north, up, metres)
  - `type Rgb = [number, number, number]` (0–255); `FIREWORK_COLOURS: readonly Rgb[]` — `#ff4d4d`, `#ffd23f`, `#4dd2ff`, `#7dff6a`, `#ff7af0`, `#ffffff`, `#ffa23f` (the mockup's).
  - `rocketRise(tS: number): number` — share of the burst height climbed, 0 at 0, 1 at `RISE_S`, decelerating (derivative falls), clamped.
  - `sparkOffset(direction: Vec3, speed: number, tS: number): Vec3` — from the burst point, `tS` seconds after the burst: linear drag on the velocity, gravity pulling down under the same drag. Closed form (the shader repeats it):
    `reach = speed * (1 - e^(-k t)) / k`; `offset = direction * reach + [0, 0, -(g / k) * (t - (1 - e^(-k t)) / k)]`.
  - `sparkBrightness(tS: number): number` — 1 at 0, 0 at and after `SPARK_LIFE_S`, non-increasing, 0 before 0.
  - `type Spark = { direction: Vec3; speed: number; colour: Rgb }`
  - `burstSparks(seed: number, count: number, colours: [Rgb, Rgb]): Spark[]` — directions spread evenly over the sphere (golden-angle spiral) with a seeded jitter, speeds 85–105% of `SPARK_SPEED` (exported, start `75` m/s), every third spark in the second colour. Deterministic in `seed`.
  - `burstDurationS(): number` — `RISE_S + SPARK_LIFE_S + TRAIL_SAMPLES * TRAIL_LAG_S`: launch to last light.

- [ ] **Step 1: Write the failing tests**, in `fireworks.test.ts`:
  - `rocketRise`: `0` at 0, `1` at `RISE_S` and after, strictly increasing between, and `rocketRise(RISE_S/2) > 0.5` (decelerating).
  - `sparkOffset`: `[0,0,0]` at `t=0`; horizontal reach never exceeds `speed / SPARK_DRAG`; for `direction [1,0,0]` the up component is negative and falling for `t > 0`; matches the closed form above at `t = 1.3` to 6 decimals.
  - `sparkBrightness`: `1` at 0, `0` at `SPARK_LIFE_S` and `SPARK_LIFE_S + 1`, `0` at `-0.1`, non-increasing over 50 samples.
  - `burstSparks(42, 60, [a, b])`: 60 sparks, unit directions (length 1 ± 1e-9), mean direction length < 0.1 (spread over the sphere), every speed within `[0.85, 1.05] * SPARK_SPEED`, exactly 20 in colour `b`; equal output for equal seeds and different for seed 43.
  - `FIREWORK_COLOURS` has 7 entries, each channel an integer 0–255.
- [ ] **Step 2: Run** `npx vitest run src/domain/fireworks.test.ts` — Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `src/domain/fireworks.ts`. A small seeded PRNG for the jitter (mulberry32 is fine, private to the module). Header comment: the shader in `fireworksExtension.ts` repeats `rocketRise`, `sparkOffset` and `sparkBrightness`, so change both together.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/domain/fireworks.ts src/domain/fireworks.test.ts
git commit -m "Define the fireworks' flight and spark curves"
```

---

### Task 3: The barrage schedule and where rockets go up

**Files:**

- Create: `src/domain/fireworkSchedule.ts`
- Test: `src/domain/fireworkSchedule.test.ts`

**Interfaces:**

- Consumes: `FIREWORK_COLOURS`, `Rgb` (Task 2); `ViewBounds` from `src/domain/vehiclesInView.ts`.
- Produces:
  - `BARRAGE_INTERVAL_MS = 300_000`, `BARRAGE = { rockets: 24, durationMs: 10_000 }`, `FINALE = { rockets: 72, durationMs: 60_000 }`, `SCATTERED_DELAY_MS: [2_000, 4_000]`, `BURST_HEIGHT_M: [100, 300]`, `LAUNCH_INSET = 0.15`.
  - `type Slot = { startMs: number; finale: boolean }`
  - `slotAt(nowMs: number): Slot` — the slot containing `nowMs` (floor to 5 minutes; Oslo's offset is whole hours, so the UTC floor is the Oslo floor). `finale` when the slot starts at 00:00 on 1 January, Oslo time.
  - `nextSlotStartMs(nowMs: number): number` — strictly after `nowMs`.
  - `slotEndMs(slot: Slot): number` — `startMs + durationMs` of its kind.
  - `type Launch = { atMs: number; fx: number; fy: number; heightM: number; colours: [Rgb, Rgb]; seed: number }` — `fx`/`fy` in `[LAUNCH_INSET, 1 - LAUNCH_INSET]`, shares of the view's width (west→east) and height (south→north).
  - `slotLaunches(slot: Slot): Launch[]` — deterministic in `slot.startMs`; sorted by `atMs`; all within `[startMs, slotEndMs)`.
  - `scatteredLaunch(nowMs: number, random: () => number): Launch` and `scatteredDelayMs(random: () => number): number`.
  - `launchPoint(bounds: ViewBounds, fx: number, fy: number): [number, number]` — linear in lng/lat.
  - `groundFor(groundM: number | null, centreGroundM: number | null): number` — `groundM` when it is a number above 0, else `max(centreGroundM ?? 0, 0)`. Doc: MapLibre answers 0 (or null) for a terrain tile still loading.

- [ ] **Step 1: Write the failing tests**:
  - `slotAt(Date.parse("2026-12-28T14:07:30+01:00"))` → `startMs` of 14:05:00, `finale: false`.
  - `slotAt(Date.parse("2026-12-31T23:00:00Z"))` → `finale: true` (00:00 on 1 Jan in Oslo); `slotAt(Date.parse("2027-01-01T00:00:00Z"))` → `finale: false` (01:00 Oslo); `slotAt(Date.parse("2026-12-31T22:55:00Z"))` → `false`.
  - `nextSlotStartMs` at exactly a slot start returns the following one; mid-slot returns the next.
  - `slotEndMs` is `+10_000` for an ordinary slot, `+60_000` for the finale.
  - `slotLaunches`: 24 for an ordinary slot, 72 for the finale; sorted; every `atMs` in range; every `fx`, `fy` within the inset; every `heightM` within `BURST_HEIGHT_M`; deep-equal across two calls with the same slot, different for the next slot.
  - `scatteredDelayMs` with `random = () => 0` → 2000, `() => 0.999…` → just under 4000.
  - `launchPoint([[10, 59], [11, 60]], 0.5, 0.25)` → `[10.5, 59.25]`.
  - `groundFor`: `(120, 5) → 120`, `(0, 80) → 80`, `(null, 80) → 80`, `(null, null) → 0`, `(0, 0) → 0`, `(-3, 10) → 10`.
- [ ] **Step 2: Run** `npx vitest run src/domain/fireworkSchedule.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Seed the slot's PRNG from `slot.startMs`. Finale detection through an `Intl.DateTimeFormat` in `Europe/Oslo` (month, day, hour, minute), as `season.ts` reads dates.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/domain/fireworkSchedule.ts src/domain/fireworkSchedule.test.ts
git commit -m "Schedule the fireworks' barrages and place their rockets"
```

---

### Task 4: Hold the Christmas lights awake for a barrage

**Files:**

- Modify: `src/domain/animationAmount.ts`, `src/components/Seasonal/animationClock.ts`
- Test: `src/domain/animationAmount.test.ts`, `src/components/Seasonal/animationClock.test.ts`

**Interfaces:**

- Produces:
  - `animationHold(nowMs: number, fromMs: number, untilMs: number, fromAmount: number): number` — eases up from `fromAmount` at `fromMs` over `ANIMATION_SETTLE_MS` (as `animationWake`), holds 1 until `untilMs`, then eases to 0 over `ANIMATION_SETTLE_MS`. 0 when `nowMs >= untilMs + ANIMATION_SETTLE_MS`.
  - `AnimationClock.holdAwake(untilMs: number): void` — animates until `untilMs` without counting as activity: `lastActivityMs` is untouched, so it does not buy 60 s. The amount is the larger of the idle amount (as now) and the hold. Starts the timer if stopped; the timer stops after the hold's tick at amount 0, as today. A no-op under reduced motion or after `dispose`.

- [ ] **Step 1: Write the failing tests**:
  - `animationHold`: equals `fromAmount` at `fromMs`; 1 from `fromMs + ANIMATION_SETTLE_MS` to `untilMs`; strictly between 0 and 1 at `untilMs + ANIMATION_SETTLE_MS / 2`; 0 at `untilMs + ANIMATION_SETTLE_MS`.
  - `AnimationClock` (fake map and fake timers, as the existing tests do): a clock settled after 61 s idle, `holdAwake(now + 10_000)` → ticks resume, `current().amount` reaches 1, falls to 0 by `now + 11_000`, then the timer stops (no further `onTick`); `lastActivityMs` unchanged — a second `holdAwake` 5 minutes later behaves the same, and with no activity the clock never runs 60 s on. Activity during a hold still wakes it in the usual way. `holdAwake` under `reducedMotion: true` never ticks.
- [ ] **Step 2: Run** `npx vitest run src/domain/animationAmount.test.ts src/components/Seasonal/animationClock.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `amountAt` the single place the amount is decided.
- [ ] **Step 4: Run** — Expected: PASS, existing clock tests unchanged.
- [ ] **Step 5: Commit**

```bash
git add src/domain/animationAmount.ts src/domain/animationAmount.test.ts src/components/Seasonal/animationClock.ts src/components/Seasonal/animationClock.test.ts
git commit -m "Let a barrage hold the Christmas lights awake"
```

---

### Task 5: The show — what is in the air

**Files:**

- Create: `src/components/Seasonal/fireworkShow.ts`
- Test: `src/components/Seasonal/fireworkShow.test.ts`

**Interfaces:**

- Consumes: Tasks 2–3.
- Produces:
  - `type Burst = { key: string; launchMs: number; position: [number, number, number] /* lng, lat, burst altitude in metres */; heightM: number; sparks: Spark[] }`
  - `type LaunchView = { bounds: ViewBounds; groundAt: (lngLat: [number, number]) => number | null; centreGroundM: number | null }`
  - `LAUNCH_GRACE_MS = 500` — a due launch older than this is skipped, not fired late.
  - `class FireworkShow` with `constructor(random: () => number = Math.random)`:
    - `update(nowMs: number, view: LaunchView, scattering: boolean): boolean` — fires the current slot's launches that are due and not yet fired (and not older than `LAUNCH_GRACE_MS`); when `scattering`, fires a scattered rocket when its time has come and schedules the next; prunes bursts whose `launchMs + burstDurationS()` has passed, at most once per second. Returns whether `bursts()` changed.
    - `bursts(): readonly Burst[]` — the same array object until a change.
    - `busy(nowMs: number): boolean` — something in the air, or the current slot's launches not all fired.
  - A burst's altitude is `groundFor(view.groundAt(point), view.centreGroundM) + heightM`. Sparks per burst: `BURST_SPARKS = 60` (exported).

- [ ] **Step 1: Write the failing tests** (fixed `random`, plain objects for the view):
  - at a slot's start, updates every 100 ms over 10 s fire exactly 24 bursts, in `slotLaunches` order, at the points `launchPoint` gives for the view; the same with the finale for 60 s → 72.
  - `skips launches older than LAUNCH_GRACE_MS`: first `update` 4 s into a slot fires only launches due within the last 500 ms; none of the earlier ones ever fire.
  - a slot's launch fires once however many updates follow.
  - scattering: with `random = () => 0`, a burst every 2 s; `scattering: false` fires none, and bursts in the air still finish.
  - `bursts()` returns the identical array between changes, a new one after a launch or a prune; a burst is gone after `burstDurationS()` plus at most one prune interval.
  - `busy` is true mid-barrage and while sparks fade, false once everything has faded with `scattering: false`.
  - altitude uses `groundFor`: `groundAt` returning 0 with `centreGroundM: 250` gives `250 + heightM`.
- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/fireworkShow.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Plain TypeScript, no map, no React.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/fireworkShow.ts src/components/Seasonal/fireworkShow.test.ts
git commit -m "Track the fireworks in the air"
```

---

### Task 6: The fireworks clock — when frames are drawn

**Files:**

- Create: `src/components/Seasonal/fireworksClock.ts`
- Test: `src/components/Seasonal/fireworksClock.test.ts`

**Interfaces:**

- Consumes: `FireworkShow`'s `update`/`busy` (Task 5) through a narrow interface; `ANIMATION_IDLE_MS`; `slotAt`, `nextSlotStartMs`, `slotEndMs` (Task 3).
- Produces: `class FireworksClock` with
  - `constructor(map: Pick<MapLibreMap, "on" | "off" | "triggerRepaint">, options: { reducedMotion: boolean; show: Pick<FireworkShow, "update" | "busy">; view: () => LaunchView; onFrame: (nowMs: number, changed: boolean) => void; onBarrage: (untilMs: number) => void; lastActivityMs?: number; now?: () => number; isVisible?: () => boolean; requestFrame?: (cb: () => void) => number; cancelFrame?: (id: number) => void; setTimer?: (cb: () => void, ms: number) => unknown; clearTimer?: (t: unknown) => void })`
  - `activity(): void` (input, or the page becoming visible); `map` `move` counts the same, subscribed in the constructor.
  - `dispose(): void`.
  - Behaviour: active while `now - lastActivityMs < ANIMATION_IDLE_MS`. A frame loop runs while active, while `show.busy(now)`, or during the current slot; each frame calls `show.update(now, view(), active)`, then `onFrame(now, changed)`, then `map.triggerRepaint()`. When none holds, the loop stops and one timer is set for `nextSlotStartMs(now)`; at a slot's start (timer or loop) it calls `onBarrage(slotEndMs(slot) + burstDurationS() * 1000)` once per slot. A frame that finds the page hidden stops the loop (activity restarts it). Under `reducedMotion` it subscribes to nothing, sets no timer and requests no frame.

- [ ] **Step 1: Write the failing tests** (fake map, fake `now`, manual frame and timer queues):
  - active: a frame is requested every frame; `onFrame` gets each `now`.
  - `requests no frame between barrages when idle`: 61 s after the last activity, once `busy` is false, no frame is requested; exactly one timer is pending, for the next slot start; firing it starts frames and calls `onBarrage` once with that slot's end plus `burstDurationS()`; after the barrage has faded, frames stop again and the next timer is set.
  - `move` on the map and `activity()` make it active again and restart frames.
  - a hidden page stops the loop; `activity()` resumes it.
  - `does nothing under reduced motion`: no `on`, no timer, no frame, ever.
  - `dispose` cancels the pending frame and timer and calls `off`.
- [ ] **Step 2: Run** `npx vitest run src/components/Seasonal/fireworksClock.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**, defaults `requestAnimationFrame`/`cancelAnimationFrame`/`setTimeout`/`clearTimeout`/`Date.now`/`document.visibilityState`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/fireworksClock.ts src/components/Seasonal/fireworksClock.test.ts
git commit -m "Draw the fireworks' frames only while something is in the air"
```

---

### Task 7: The spark mesh, the shader and the layer

**Files:**

- Modify: `src/domain/vehicleMeshes.ts` (add `sparkModel`), `src/domain/vehicleMeshes.test.ts`
- Create: `src/components/Seasonal/fireworksExtension.ts`, `src/components/Seasonal/fireworkLayers.ts`
- Test: `src/components/Seasonal/fireworkLayers.test.ts`

**Interfaces:**

- Consumes: Tasks 2 and 5; `MapScheme`.
- Produces:
  - `SPARK_RADIUS_M` (start `2.5`) and `sparkModel(): VehicleMesh` — an octahedron of that radius, white vertex colours, built once.
  - `type SparkInstance = { position: [number, number, number]; launchS: number; direction: Vec3; speed: number; colour: Rgb; lagS: number; kind: 0 | 1 /* 0 rocket, 1 spark */; heightM: number }`
  - `sparkInstances(bursts: readonly Burst[], epochMs: number): SparkInstance[]` — per burst one rocket head plus `TRAIL_SAMPLES` lagged copies of each spark (`lagS = i * TRAIL_LAG_S`); `launchS = (launchMs - epochMs) / 1000`.
  - `FireworksExtension` (a `LayerExtension` on `SimpleMeshLayer`, one shared instance) with props `fireworksTimeS` and accessors for `launchS`, `direction`, `speed`, `lagS`, `kind`, `heightM` as instanced attributes. Vertex shader repeats `rocketRise`, `sparkOffset`, `sparkBrightness` with Task 2's constants interpolated as `#define`s (as `flutterExtension.ts` does): the rocket head rises from `position - [0,0,heightM]` until `RISE_S` and vanishes; sparks appear at `RISE_S`, at `position + sparkOffset(direction, speed, t - RISE_S - lagS)`, scaled and dimmed by `sparkBrightness` and further by the trail sample (`1 - lagIndex / TRAIL_SAMPLES`). Offset added in `DECKGL_FILTER_SIZE` as `flutterExtension.ts` does; brightness applied in `vs:DECKGL_FILTER_COLOR` to alpha (and to rgb in dark mode, where blending is additive).
  - `fireworkLayers(instances: SparkInstance[], options: { visible: boolean; scheme: MapScheme; timeS: number; epochKey: unknown }): Layer[]` — one `SimpleMeshLayer` (`id: "fireworks"`) with the shared extension, `sparkModel()`, white × `colour` via `getColor`, an unlit material, `parameters` with `depthWriteEnabled: false` and additive blending in dark mode, ordinary alpha blending in light mode, `beforeId` `MODEL_BEFORE_LAYER`, and `updateTriggers` on `epochKey` for every accessor.

- [ ] **Step 1: Write the failing tests**:
  - `sparkModel`: 8 triangles, every vertex at `SPARK_RADIUS_M` from the origin, outward normals.
  - `sparkInstances`: count is `bursts × (1 + BURST_SPARKS × TRAIL_SAMPLES)`; `launch times are relative to the data's own epoch` — a burst launched 30 days after the Unix epoch, with `epochMs` 1 s before it, gives `launchS` 1.
  - shader text: contains each Task 2 constant as a `#define` with its value; does not read `instanceModelMatrixCol0`/`Col1`/`Col2` (the offset is east, north and up in metres, not model space); uniform block member order matches `uniformTypes`.
  - `fireworkLayers`: one layer; the same `data` array passed through; `parameters.blendColorDstFactor` is `"one"` in dark and `"one-minus-src-alpha"` in light; `depthWriteEnabled` false in both; the extension instance is identical across two builds; nothing when `visible` is false.
- [ ] **Step 2: Run** `npx vitest run src/domain/vehicleMeshes.test.ts src/components/Seasonal/fireworkLayers.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Read deck.gl 9.4's `simple-mesh-layer-vertex.glsl` for the injection points before writing the GLSL, and match `flutterExtension.ts`'s structure and comments.
- [ ] **Step 4: Run** — Expected: PASS. Then `npx tsc --noEmit -p tsconfig.app.json`.
- [ ] **Step 5: Commit**

```bash
git add src/domain/vehicleMeshes.ts src/domain/vehicleMeshes.test.ts src/components/Seasonal/fireworksExtension.ts src/components/Seasonal/fireworkLayers.ts src/components/Seasonal/fireworkLayers.test.ts
git commit -m "Draw sparks whose flight is computed in the shader"
```

---

### Task 8: Fireworks on the map

**Files:**

- Create: `src/components/Seasonal/useSeasonalFireworks.ts`
- Modify: `src/components/Vehicle/VehicleModels.tsx`, `src/components/MapView.tsx`, `src/components/Seasonal/useSeasonalDecorations.ts`, `src/components/Seasonal/useSeasonalFlags.ts`, `tests/seasonal.spec.ts`

**Interfaces:**

- Consumes: Tasks 1, 4–7.
- Produces:
  - `useSeasonalDecorations` returns `{ holdAwake: (untilMs: number) => void }` (stable; calls `clockRef.current?.holdAwake`).
  - `useSeasonalFireworks({ map, on, shown, scheme, onLayers, onBarrage }): void` — `on` is `fireworksOn(...)`, `shown` is `viewDimension === "3d" && opacity > 0`. While `on && shown`: one `FireworkShow` and one `FireworksClock` (`view` from `cappedViewBounds(map)`, `map.queryTerrainElevation`, and the elevation at `map.getCenter()`); `onFrame` rebuilds `sparkInstances` only when `changed` (new epoch), and every frame hands `fireworkLayers(..., { timeS: (now - epochMs) / 1000 })` to `onLayers`. Input through `useKioskInput`, `visibilitychange` to visible as `activity()`. The last activity is kept in a ref across clocks, as `useSeasonalFlags` does, so leaving 3D and coming back does not reset idleness. Otherwise hands `[]` and runs nothing.
  - `VehicleModels` gets a `fireworks: boolean` prop, a `fireworkLayersRef` in `handOver` after the flags, and passes `holdAwake` as `onBarrage`. `MapView` reads `fireworksOn(new Date(), window.location.search)` once, beside `season`.
  - Dev hook: `window.__seasonal = { ...previous, rockets }` — `rockets` the bursts in the air; `useSeasonalDecorations`' and `useSeasonalFlags`' writers spread the previous value too. When the fireworks are off the hook writes nothing.

- [ ] **Step 1: Write the failing Playwright test** in `tests/seasonal.spec.ts`: `"fireworks go up in the New Year season"` — `openIn3d(page, "?season=newyear")`, then poll `__seasonal.rockets` until `> 0` (timeout 60 s); and `"no fireworks with season=christmas"` — after 15 s in 3D, `__seasonal?.rockets` is `undefined` or 0. Extend `TestWindow.__seasonal` with `rockets?: number`.
- [ ] **Step 2: Run** `npx playwright test tests/seasonal.spec.ts --project=chromium` — Expected: the two new tests FAIL, the existing seven PASS. (Port 5173 may be held by another project's dev server; if the page is not this app, run against a copy of the config on another port and say so in the report.)
- [ ] **Step 3: Implement** the hook and the wiring.
- [ ] **Step 4: Run** the Playwright file again (all 9 PASS), `npx vitest run` (all PASS), `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/Seasonal/useSeasonalFireworks.ts src/components/Vehicle/VehicleModels.tsx src/components/MapView.tsx src/components/Seasonal/useSeasonalDecorations.ts src/components/Seasonal/useSeasonalFlags.ts tests/seasonal.spec.ts
git commit -m "Fire New Year's rockets over the 3D map"
```

---

### Task 9: Look, tune, measure and document

**Files:**

- Modify: `src/domain/fireworks.ts`, `src/domain/vehicleMeshes.ts` (constants only, if tuning needs it), `docs/superpowers/specs/2026-10-21-new-year-fireworks-design.md` (add `## Measured (<date>)`), `CLAUDE.md` (Seasonal decorations section), `.claude/rules/vehicle-models.md` (one line on `sparkModel`, if meshes are listed there)

- [ ] **Step 1: Look** with headless Playwright and swiftshader (never the Chrome extension) at Oslo sentrum, `?season=newyear`, 3D, zoom 16.5, light and dark, still and in a chase. Screenshots to the scratchpad. Check: bursts read as fireworks; above models, signs and poles; nothing over the panels; nothing under emulated reduced motion; an idle map stops repainting and wakes for the next slot (use `?season=newyear` and a page clock set just before a slot via `page.clock`).
- [ ] **Step 2: Tune** `SPARK_SPEED`, `SPARK_RADIUS_M`, the trail and the life if the look needs it; re-run unit tests.
- [ ] **Step 3: Measure** on a production build (`npm run build && npx vite preview`), on the GPU and on swiftshader, as the flags were: still map with scattered rockets vs `?season=none`; a barrage; the finale (page clock at 23:59:55 on 31 Dec Oslo); `render` events in 10 s while idle between barrages with the vehicle feed closed (expect 0); a chase with and without fireworks. Record frames, p95 frame time and frames over 25 ms.
- [ ] **Step 4: Document.** Spec: the Measured table and what it showed. CLAUDE.md: a fourth season bullet in the Seasonal decorations list, and one bullet for the fireworks (window and overlap with Christmas, `fireworksOn`, the show/clock split, motion in the shader with the per-build epoch, barrage on idle screens and `holdAwake`, scheme blending, `__seasonal.rockets`), in the section's existing style.
- [ ] **Step 5: Run** `npx vitest run`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`; commit:

```bash
git add src/domain/fireworks.ts src/domain/vehicleMeshes.ts docs/superpowers/specs/2026-10-21-new-year-fireworks-design.md CLAUDE.md .claude/rules/vehicle-models.md
git commit -m "Measure the New Year's fireworks and document the fourth season"
```
