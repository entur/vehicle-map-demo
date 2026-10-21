# Seasonal decorations: 17. mai flags

## Intent

The third season, after the Halloween pumpkins and the Christmas trees
(`2026-10-20-seasonal-decorations-design.md`, `2026-10-20-christmas-trees-design.md`). On Norway's
national day, real buses fly two small Norwegian flags from their front corners. From 1 to 17 May,
every 3D bus, coach and tram model on the map does the same, and the flags flutter gently. Like
the pumpkins and trees, this is just for fun: it carries no data and must never get in the way of
the vehicles.

This is the first decoration that rides **on the vehicles** rather than standing at stops.

## Goals

- From **1 to 17 May** inclusive (Europe/Oslo dates), every 3D model of a **bus, coach or tram**
  carries **two Norwegian flags**, one on each front corner, with no switch to turn them on.
- The flags are part of the vehicle. They move, turn and lean with it: the same position, yaw
  and terrain pitch as the model. That includes the chased vehicle in a chase or kiosk run.
- The flags are **exaggerated like the stop poles**: about `STOP_POLE_EXAGGERATION` (3×) a real
  bus flag, which is roughly a 30×20 cm flag on a pole about half a metre high. They are placed so
  they are visible from the chase camera behind the vehicle. Lasse expects to tune the size after
  seeing it, so it is one constant.
- The flags **flutter gently**:
  - each vehicle's flags in their own rhythm
  - streaming back from the pole, away from the direction of travel
  - lying still under `prefers-reduced-motion: reduce`
  - settling after 60 s without input or camera movement, like the Christmas lights
- `?season=17mai` forces the season on any date, and `?season=none` still forces everything off.

## Non-goals

- No flags on trains, metro, ferries or any other mode. Only bus, coach and tram, as Lasse chose.
- No flags on the 2D icons: they appear only where vehicles are 3D models.
- No flags on the schedule ghost, so it stays visibly different from the real vehicle.
- No flags on the directionless column drawn for a vehicle without a bearing, since it has no
  front.
- No stop decorations for this season. No bunting, crowds or other figures.
- No change to Halloween or Christmas.

## Anti-goals

Both carry over from the earlier seasons:

1. **Flags getting in the way of the vehicles.** They must not hide the line colour or the
   destination signs.
2. **Flags slowing the map down.** This season has many more instances than the others: one per
   bus, coach or tram in view, against one per stop. The flutter must therefore cost a uniform
   per tick. It must not rebuild the vehicle model layers, the signs or per-vehicle attributes.

## Constraints

- **Season window.** Add `17mai` to `Season` and `SEASONS` in `src/domain/season.ts`, on from
  1 to 17 May inclusive. The window is a fixed month/day pair that does not wrap.
- **No stop decorations.** `DECORATIONS` is `Record<Season, DecorationSpec>` today, so
  `17mai` must not be forced to have a stop spec. The decoration controller must not run for a
  season without one, and must cost nothing then.
- **Where the flags are drawn.** They are drawn with the models, through `VehicleModels`' single
  interleaved overlay. Each flag shares the model's transform: `getPosition`, the yaw `-bearing`,
  and the roll from `getTilt`. Like the models, they are built only while the models are visible,
  and only for vehicles in view.
  - Every flagged mode gets its own pair of flag meshes in model space, mounted at that model's
    front corners, using `VEHICLE_DIMENSIONS`. Model space is +y forward.
  - There is a fixed, small number of flag layers per mode, about one for the poles and one for
    the cloth, whatever the number of vehicles.
  - The chased vehicle, drawn through its own per-frame store, carries flags too.
- **The flutter is a shader effect,** following `TwinkleExtension`:
  - a per-vehicle phase attribute, a stable hash of `vehicleId`, uploaded with the data
  - `time` and `amount` uniforms per tick, the time wrapped to one period in double precision
    before it becomes a uniform
  - a vertex displacement of the cloth that grows with distance from the pole, so the pole edge
    stays fixed
    The curve is a pure function in `src/domain/`, which the shader reproduces, with its constants
    interpolated from that module. The cloth needs a per-vertex "distance from the pole". How it is
    carried is the builder's choice, for example in texture coordinates.
- **What a tick may touch.** A tick rebuilds only the flag layers, with the same data and mesh
  objects and new uniform props. The flag layers are therefore kept apart from the rest of the
  vehicle model layers, so a tick never re-creates the body, sign, details, lamp or pool layers.
- **The clock.** Reuse `TwinkleClock` (60 s idle, `move` counts as activity, ease out and back
  in, reduced motion, stops on a hidden page). Rename it to something season-neutral if it now
  serves two seasons. While the season is on, it runs only while flagged vehicles are drawn.
  With `amount` at 0, the flags hang in a still pose that reads as a flag, not as a flat plate.
- **Colours.** The flag is in the Norwegian flag's own colours: red `#BA0C2F`, white and blue
  `#00205B`, with a red field and a white-bordered blue Nordic cross. These are fixed vertex
  colours drawn with a white `getColor` and the shaded material, so dark mode dims them like the
  model. They are not lamps.
- **Testable logic in plain `.ts`:**
  - the season window
  - the flag mesh: mount points against `VEHICLE_DIMENSIONS`, size times the exaggeration, the
    cross proportions
  - the flutter curve
  - the layer builder: a fixed layer count, only bus, coach and tram, and the same data and mesh
    objects across ticks

## Decided by Lasse

- The season is 17. mai flags on the vehicles.
- Buses and trams. Coaches count as buses.
- The flags flutter gently.
- From 1 to 17 May.
- The flags are exaggerated like the stop poles; the size can be adjusted later.

## My calls (check these)

- **URL value:** `?season=17mai`.
- **Coaches** count as buses.
- **Movement rules:** reduced motion and the 60 s idle settle work as for the Christmas lights.
- **Exclusions:** no flags on 2D icons, the ghost or the directionless column.
- **Exaggeration:** the same 3× as the stop poles.
- **Mounting:** on the front corners, high enough to clear the roof line from a camera behind,
  with the pole at the corner.
- **Flutter:** each vehicle has its own phase, and the cloth streams backwards in model space.
  The wind and the vehicle's speed are ignored, because most feeds publish no speed.
- **Flag colours:** `#BA0C2F` and `#00205B`.
- **In the 2D view:** flags are drawn wherever models are drawn, which includes the 2D view
  from `VEHICLE_MODEL_MIN_ZOOM`. From straight above a flag is nearly edge-on, so this costs
  little and keeps one rule.
- **Performance bar:** the same as for the Christmas trees, "no measurable drop" on a GPU. A
  slower still map without a GPU, for up to 60 s after the last input, is accepted as it was for
  the lights. The measurement says how it went.

## Left to the builder

- The flag mesh's construction: segments along the cloth for a smooth wave, the pole, and the
  cross's proportions (the official 6:1:2:1:12 by 6:1:2:1:6 is ideal).
- The shader injection point for the model-space displacement, read from the installed deck.gl
  9.4 `SimpleMeshLayer` shaders.
- How the flag layers reach `VehicleModels` and how they share `getPosition` and `getTilt` with
  the models.
- The exact flutter curve, period and amplitude, within "gentle": no flapping, and amplitude
  growing towards the free edge.
- The names of the season, the clock rename and the new modules.

## Done means

- **Unit tests** for:
  - the season window: 30 Apr off, 1 May on, 17 May on, 18 May off, the Oslo-time edges,
    `?season=17mai` and `?season=none`
  - the flag mesh
  - the flutter curve, including that `amount` 0 gives the still pose
  - the flag layer builder
- Halloween and Christmas tests unchanged.
- `npm run lint` is clean.
- **Playwright:** with `?season=17mai&view=3d` at a busy stop, a dev hook (for example
  `window.__seasonal`, as now) shows flagged vehicles. With `?season=none` it shows none. The
  hook must report flags only for bus, coach and tram.
- **Looked at by eye in both schemes, in a chase from behind:**
  - the flags are visible and on the front corners
  - they flutter gently, out of step between vehicles
  - they lie still with reduced motion emulated
  - no destination sign or line colour is hidden
- **Measured** as for the Christmas trees, on a production build:
  - a still map while fluttering, against `?season=none`
  - render events after 60 s idle with the vehicle feed closed
  - a chase, with and without flags

## Measured (2026-10-21)

On a production build (`vite build` with the development-only `window` hooks kept by a throwaway
config, served by `vite preview`) in headless Chromium, as the Christmas trees were measured.
Each page was opened in 2D, switched with "Show 3D view", then put at zoom 16.5, pitch 60, with
live vehicles from dev. Frames are counted with `requestAnimationFrame`, MapLibre repaints with
`map.on("render")`. "Still" is 10 s with no input, straight after a key press, twice per page;
the chase is 20 s behind a bus picked near the centre, 8 s after it started; "after idle" is
10 s starting 62 s after the last input, with the vehicle feed muted from that input on (the
subscription's frames dropped in a routed WebSocket, so the last vehicles, and their flags, stay
drawn). "Flagged" is `window.__seasonal.count`: vehicles flying flags, two each, in the models'
view, which reaches past the screen's edges, plus the chased one.

**Oslo bussterminal had almost nothing to fly flags on.** At 16.5 the models there were trains;
the most flagged vehicles seen in view were two, and no bus came near the centre for a chase on
the GPU. Buses publish positions sparsely in Oslo on dev (six with a bearing over the whole city
at zoom 11.5). So the same cases were run again at **Stavanger byterminal** (58.9667, 5.7325),
the densest cluster found that also reports every few seconds (Bergen sentrum had more, but
reports about once a minute).

On the GPU (Apple M1 Max through ANGLE Metal, 1560×784, dark unless stated):

| Case                                     | Flagged | fps         | Frames > 25 ms | Worst | Repaints  |
| ---------------------------------------- | ------- | ----------- | -------------- | ----- | --------- |
| Oslo, still, `?season=none`              | –       | 60.0 / 60.0 | 0 / 0          | 17 ms | 11 / 21   |
| Oslo, still, `?season=17mai`             | 0 / 0   | 60.0 / 60.0 | 0 / 0          | 17 ms | 20 / 0    |
| Oslo, still, light, none                 | –       | 60.0 / 60.0 | 0 / 0          | 17 ms | 0 / 0     |
| Oslo, still, light, 17mai                | 0 / 0   | 60.0 / 60.0 | 0 / 0          | 17 ms | 0 / 42    |
| Oslo, after idle, feed muted, 17mai      | 2       | 60.0        | 0              | 17 ms | **0**     |
| Stavanger, still, none                   | –       | 60.0 / 60.0 | 0 / 0          | 17 ms | 222 / 304 |
| Stavanger, still while fluttering        | 11 / 12 | 60.0 / 60.0 | 0 / 0          | 17 ms | 288 / 282 |
| Stavanger, still, light, none            | –       | 60.0 / 60.0 | 0 / 0          | 17 ms | 219 / 243 |
| Stavanger, still while fluttering, light | 11 / 12 | 60.0 / 60.0 | 0 / 0          | 17 ms | 329 / 275 |
| Stavanger, chase, none                   | –       | 60.0        | 0              | 17 ms | 1150      |
| Stavanger, chase, 17mai                  | 34      | 60.0        | 0              | 17 ms | 1182      |
| Stavanger, after idle, feed muted, none  | –       | 60.0        | 0              | 17 ms | **0**     |
| Stavanger, after idle, feed muted, 17mai | 14      | 60.0        | 0              | 17 ms | **0**     |

On this GPU the flags cost nothing measurable: not one frame over 25 ms in any case, still,
chased or idle. In Stavanger the vehicles already repaint the map 20–30 times a second, so the
flutter's ticks (12.5 a second) mostly land in frames that are drawn anyway, adding about 10–50
repaints in 10 s. After 60 s idle with the feed muted the map repaints **not once** in 10 s with
14 flagged vehicles drawn, as without flags: the clock settles to the still pose and stops.

On swiftshader (`--use-angle=swiftshader`, a CPU renderer, at 640×400, as for the trees):

| Case                                     | Flagged | fps         | Frames > 25 ms | Worst  | Repaints  |
| ---------------------------------------- | ------- | ----------- | -------------- | ------ | --------- |
| Oslo, still, none                        | –       | 60.0 / 58.0 | 0 / 2          | 317 ms | 0 / 1     |
| Oslo, still while fluttering             | 1 / 1   | 49.9 / 59.9 | 19 / 1         | 333 ms | 120 / 125 |
| Oslo, still, light, none                 | –       | 57.6 / 60.0 | 4 / 0          | 300 ms | 5 / 0     |
| Oslo, still while fluttering, light      | 1 / 1   | 57.0 / 55.4 | 9 / 7          | 333 ms | 124 / 121 |
| Oslo, after idle, feed muted, 17mai      | 1       | 60.0        | 0              | 17 ms  | **0**     |
| Stavanger, still, none                   | –       | 23.7 / 28.4 | 34 / 26        | 467 ms | 43 / 34   |
| Stavanger, still while fluttering        | 12 / 12 | 8.9 / 9.2   | 89 / 89        | 467 ms | 89 / 89   |
| Stavanger, still, light, none            | –       | 27.6 / 28.9 | 32 / 27        | 517 ms | 40 / 35   |
| Stavanger, still while fluttering, light | 9 / 11  | 8.6 / 8.9   | 87 / 87        | 467 ms | 87 / 87   |
| Stavanger, chase, none                   | –       | 2.3         | 46             | 767 ms | 47        |
| Stavanger, chase, 17mai                  | 33      | 2.2         | 45             | 800 ms | 46        |
| Stavanger, after idle, feed muted, none  | –       | 60.0        | 0              | 17 ms  | **0**     |
| Stavanger, after idle, feed muted, 17mai | 11      | 60.0        | 0              | 17 ms  | **0**     |

(The Oslo chase on swiftshader followed a bus without flags, since none was flagged near the
centre with the season on, so it is left out.) Without a GPU the flags cost what the twinkle
did: every tick is a full repaint of the 3D map, about 100 ms here, so a still Stavanger map that
drew 24–29 fps between vehicle frames draws 9 while the flags flutter, and one flagged coach in
Oslo makes the otherwise idle map repaint 12 times a second. That lasts until 60 s after the last
input, after which the map is idle again — no repaint in 10 s, flags or not. A chase costs the
same with and without flags: the chase camera already repaints every frame it can.

Looked at in Stavanger in light mode, zoom 18.3: two flagged buses in one frame, and the same
view 0.5 s later, show each vehicle's flags in a different pose in each frame and the two
vehicles not in step.
