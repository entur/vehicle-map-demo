# Seasonal decorations: Christmas trees

## Intent

The second season on the pattern the Halloween pumpkins set up
(`2026-10-20-seasonal-decorations-design.md`). Through Advent and Christmas, every stop on the 3D
map has a Christmas tree with lights that twinkle gently. Like the pumpkins, this is just for
fun: it carries no data and must never get in the way of the vehicles.

The picture Lasse described: a dark December afternoon, the map open, a lit tree at every stop.

## Goals

- From the **first Sunday of Advent through 6 January** (Europe/Oslo dates), one Christmas
  tree stands at every stop on the map, with no switch to turn it on. In 2026 that is 29 November
  2026 – 6 January 2027.
- **One tree per stop**, about **4–5 m** tall, varied per tree. Placed like the pumpkins: random
  but the same on every load and pan, clear of traffic, buildings and water.
- **Lights that twinkle gently**, in **both** colour schemes. In dark mode they glow like the
  vehicles' lamps. In light mode they are drawn but do not glow.
- **Reduced motion:** with `prefers-reduced-motion: reduce` the lights are lit and steady.
- `?season=christmas` forces the season on any date, and `?season=none` still forces everything
  off. Neither appears anywhere in the UI.

## Non-goals

- **No snow, and no change to the sky or the Weather layer.** The Weather layer shows MET
  readings. Snow faked by the season, next to real readings, could be mistaken for data.
- No reindeer, Santa or other figures. The Halloween spec mentioned them as possible Christmas
  ideas, but Lasse chose the trees on their own.
- No interaction, no user-facing switch, and no dependence on the feeds.
- No change to Halloween's behaviour. A refactor that moves a single pumpkin is a regression.

## Anti-goals (a failure even if it works)

Halloween's two anti-goals apply unchanged:

1. **Trees blocking vehicles.** No tree may stand where a vehicle drives.
2. **Trees slowing the map down.** Twinkling is new: the pumpkins were static and cost nothing
   between placements, but lights that change keep the map redrawing. That redraw must not cost
   frames, and the cost of each twinkle update must not grow with the number of trees.

## Constraints

Everything in the Halloween spec's constraints holds for the trees unless it is overridden here:

- stops read from `openmaptiles` with `querySourceFeatures`, independent of the Transit network
  switch
- only from `VEHICLE_MODEL_MIN_ZOOM`
- a cap per view
- off-season costs nothing
- clear of traffic, buildings and water
- placed only at start, on `moveend`, and when a tile arrives while the camera is at rest; once a
  second during a chase
- standing on the terrain through `VehicleModels`' single interleaved overlay
- scheme lighting from `MODEL_MATERIALS`
- testable logic in plain `.ts` modules
- a placement that throws is logged and shows nothing

- **Height overrides "never taller than a bus".** That was a Halloween rule. Lasse agreed to 4–5 m
  trees, which are taller than a bus (3.2 m). The footprint used for clearance is the radius of
  the tree's widest point, at the bottom of the canopy, so the clearance rule from the road edge
  holds for the canopy and not just the trunk.
- **Chase:** as with the pumpkins, nothing is hidden around the chased vehicle. A tree is taller
  and so covers more from a low camera; accepting that is _my call_, made by analogy with Lasse's
  decision for the pumpkins (see "My calls").
- **Season window.** `SEASONS` in `src/domain/season.ts` holds fixed month/day pairs and says
  that a window wrapping the new year is not supported. Christmas needs both: a start that moves
  (first Advent Sunday = the Sunday from 27 November to 3 December, i.e. the fourth Sunday before
  25 December) and an end in the next year. On 1–6 January the season is on because of the
  previous year's Advent. Halloween's window and tests stay as they are.
- **One placement, two seasons.** `pumpkinPlacement.ts`, `PumpkinController` and `usePumpkins`
  become shared seasonal-decoration code, parameterised by season. Per season, the parameters
  are:
  - count per stop
  - height range
  - footprint radius as a share of height
  - spread from the stop
  - spots tried

  The Halloween parameters must reproduce today's pumpkins exactly: same seeds, same draws in
  the same order. The existing placement tests must stay green unchanged, apart from renamed
  imports.

- **Each tree twinkles on its own** (Lasse). Trees must not pulse in step across the map. The
  bulbs are still split into a few groups, about three, that fade out of phase within a tree. On
  top of that, each tree has its own phase offset, seeded from its stop like everything else
  about it.
- **Twinkling must be cheap per update.** It must not re-place trees, rebuild meshes, re-read
  tiles or re-upload per-instance attributes for every tree. A per-tree phase therefore means
  a small deck.gl shader extension on the bulb layer or layers:
  - the per-tree phase is an instance attribute, uploaded once when trees are placed
  - each tick changes only a time uniform
  - the shader works out each bulb's brightness from time + tree phase + group
    The pure twinkle function in `src/domain/` is the reference for that curve, and the tests pin
    it. The total stays at a handful of layers, however many trees are in view.
- **Twinkling runs only when needed:** while trees are drawn, while the page is visible, and
  never under reduced motion. "Gently" means slow fades of brightness, each group cycling over
  roughly 2–4 s, with no blinking on and off. _My call:_ a ticker of about 10–15 updates a second
  is enough for a slow fade.
- **Twinkling stops when nobody is there** (Lasse). After a period with no input and no map
  movement, the lights settle to steady and the ticker stops, so a still map is not drawn again
  and again all day, whether on a phone's battery or on a wall screen. Any input or camera
  movement starts it again. _My calls:_
  - **Idle time:** 60 s.
  - **Settling:** the lights ease to fully lit over about a second rather than freezing mid-fade.
  - **Kiosk:** a chasing kiosk moves the camera continuously, so its trees keep twinkling, at
    no cost beyond the frames the chase is already drawing. A fixed-view kiosk is still, so its
    trees settle to steady after 60 s like any other still map.
- **Light mode:** `MODEL_MATERIALS.light.lamps` is a plain material, so in light mode the bulbs
  are coloured but not glowing. The twinkle there shows as a change in brightness of the bulb
  colour.
- **Bulb colours:** these are lamp colours, so they belong in `LAMP_COLOURS` (or the builder's
  replacement for it if the lamp handling is generalised).

## Decided by Lasse

- Christmas is the next season, and it is trees, not figures.
- A Christmas tree with lights at every stop: one tree per stop, about 4–5 m tall.
- The lights twinkle gently, in both colour schemes.
- The window runs from the first Sunday of Advent through 6 January.
- No snow, and no weather or sky change.
- Each tree twinkles on its own, not in step with the others.
- Twinkling stops after a while without input or movement.

## My calls (check these)

- **Steady lights under reduced motion.** I said this in chat and nobody objected, but it was
  never asked as a question.
- **Tree look:** low-poly in the style of `vehicleMeshes.ts`. Three stacked cones of dark green,
  a short brown trunk, a gold star on top that is a lamp, and about 20–30 small bulbs spread over
  the canopy's surface, a hair proud of it. Per tree there is a random yaw, a slight green tint
  variation, and a height from 4 to 5 m.
- **Bulbs are multicoloured:** warm white, red, gold and blue, with the colours shared across
  the twinkle groups so no single colour pulses on its own.
- **The star glows steadily**; it does not twinkle.
- **Spread:** a tree stands 3–15 m from its stop, like the pumpkins, and is tried at up to 24
  spots. A tree needs more room than a pumpkin, so if few city-centre stops get one, the builder
  may widen the spread and try more spots. The clearance itself may not be relaxed. Any change
  is measured in Oslo sentrum, Majorstuen and Bergen sentrum as the pumpkins were, for both
  density and placement time.
- **Cap per view:** the existing 200 decorations, which for trees means 200 stops.
- **Shown in kiosk mode,** as the pumpkins are.
- **Chased vehicle:** nothing is hidden around it (see Constraints).
- **Dev hook:** `window.__pumpkins` is generalised to `window.__seasonal = { season, count }`,
  and `tests/seasonal.spec.ts` is updated.
- **Shared code is renamed.** "Pumpkin" names in shared code become season-neutral, for example
  `decorationPlacement.ts`, `DecorationController` and `useSeasonalDecorations`. The pumpkin
  mesh and its layers keep their names.

## Left to the builder

- Module and type names, and how the per-season parameters are expressed: a table next to
  `SEASONS`, or one next to each mesh.
- The tree mesh and how the bulbs are laid out on the canopy. It must be deterministic, since
  the mesh is built once and cached like `pumpkinModel`.
- The exact twinkle curve, the tick rate and the number of groups, within the constraints above.
- What counts as input for the idle timer. `useKioskInput`'s `pointerdown`/`wheel`/`keydown`
  plus the map's `movestart` is the obvious set.
- Whether to re-check the season after mount. Like Halloween, the season is read once, so a
  kiosk left running keeps its trees past 6 January until it reloads. That is acceptable.
- Whether the ticker lives in the hook or in `VehicleModels`. It must not cause React re-renders
  of the map per tick if that can be avoided. A ref plus `handOver()`, or setting layer props
  directly, is the obvious route.
- How the Advent date is computed, as long as it is correct for any year.

## Done means

- **Unit tests:**
  - The season window: the first Advent Sunday for 2026–2030 (29 Nov, 28 Nov, 3 Dec, 2 Dec,
    1 Dec), plus 2033 (27 Nov, when Christmas Day is itself a Sunday). The window's first
    and last days in Oslo time. 1–6 January on, 7 January off, and the day before Advent off. The
    `?season=christmas` and `?season=none` parameters.
  - Halloween still behaves exactly as before.
  - Tree placement: exactly one tree per stop where a spot is clear, none otherwise, stable
    across calls, and clear of traffic and buildings.
  - The tree mesh.
  - The twinkle function, which is pure: the brightness of a group in a tree with a given phase
    at a given time. Two trees with different phases are not in step, and the lights are steady
    under reduced motion and once idle.
- `npm run lint` is clean.
- **Playwright:** with `?season=christmas` at Majorstuen, zoom 17.5, there are trees. With
  `?season=none` there are none. The existing pumpkin tests still pass.
- **Measured on dev in 3D in Oslo sentrum,** as in the Halloween table: rotation in both
  schemes and a chase, with and without trees. Add two new cases. First, **10 s with the map
  still while twinkling**, counting frames over 25 ms. Second, **after the idle time**: confirm
  that the map stops repainting by counting MapLibre `render` events over 10 s, which should be
  none. Write the numbers into
  this document. As before, the bar is no measurable drop.
- **Looked at by eye in both schemes:** no tree on a road or track, the lights visibly twinkling
  and not blinking, and steady with reduced motion emulated.
- **The CLAUDE.md section** "Seasonal decorations" is updated to cover both seasons.
