# Seasonal decorations: Halloween pumpkins

## Intent

Inspired by the Snapchat map: a seasonal layer of decorations on the 3D map that turns on by
itself around a holiday. Halloween is first (pumpkins by stops); Christmas (reindeer, Santa) and
Easter (bunnies) follow later on the same pattern. It is for delight. Nothing in it carries data,
and it must never get in the way of the vehicles, which are what the map is for.

## Goals

- From 24 October to 1 November (Europe/Oslo dates), giant pumpkins sit scattered near some of
  the stops on the map, with no switch to turn them on.
- They are true 3D objects in the map's own style: built in code like the vehicle models,
  standing on the terrain, hidden by buildings.
- Snapchat-style oversized but **never taller than a bus**: each pumpkin is between about 1.5 and
  2.5 m tall, varied per pumpkin so a group does not look copy-pasted.
- A few per stop, at some stops only, at random, but **stable**: the same stop gets the same
  pumpkins in the same places on every load and pan.
- Dark scheme: lit jack-o'-lanterns (carved face glowing, as the vehicles' lamps glow). Light
  scheme: plain pumpkins.
- A hidden URL parameter, `?season=halloween`, shows them on any date for trying out and for
  tests. Not shown anywhere in the UI.

## Non-goals

- Christmas, Easter or any other season now. The season check should be a small table that a
  second season can be added to, but nothing beyond Halloween is designed or built.
- Animation, interaction (click, hover, tooltip) or anything that changes with the feeds.
- A user-facing on/off switch.
- Any change to the vehicle-positions backend or a new data source.

## Anti-goals (a failure even if it works)

1. **Pumpkins blocking vehicles.** No pumpkin may stand where a vehicle drives, and none may hide
   the vehicle being chased.
2. **Pumpkins slowing the map down.** The map must feel exactly as fast with them as without.
   The destination signs once took the map from 25 to 1.9 fps by adding layers; that is the
   failure mode to avoid.

## Constraints

- **Where the stops come from:** the base map's `openmaptiles` tiles, the same features
  `src/domain/transitNetwork.ts` already reads (`transitPlaceKind(...) === "stop"`). It is
  OpenStreetMap data, no `NSR:` ids, and that is fine for decoration. Pumpkins do not depend on
  the "Transit network" switch: they read the source features (e.g. `querySourceFeatures`), not
  the rendered stop layer. _(My call.)_
- **Only zoomed in:** nothing is built below `VEHICLE_MODEL_MIN_ZOOM` (16), the zoom where
  vehicles become 3D models. Below that the layer returns no deck.gl layers at all.
- **One layer:** all pumpkins are one `SimpleMeshLayer` instance list sharing one mesh, plus at
  most one more for the glowing face in dark mode if the lamp material needs its own layer, as it
  does for vehicles. Never a layer per pumpkin or per stop.
- **A cap per view:** at most 200 pumpkins built for the current view _(my call on the number)_.
  Placements are recomputed on `moveend` outside a chase, as `vehiclesInView` is. During a chase
  `moveend` fires every frame (`ChaseCamera` calls `jumpTo`), so placement must never run per
  frame there; see the chase constraint below.
- **Off-season costs nothing:** outside the window and without `?season`, no tiles are queried,
  no meshes built, no layers added.
- **Clear of traffic:** the `openmaptiles` `transportation` layer has centre lines but no
  widths, so clearance is measured from an _estimated edge_: each class gets a half-width
  (e.g. motorway/trunk/primary ~7 m, secondary/tertiary ~5 m, minor/service/busway ~3.5 m,
  rail/transit ~2.5 m), and a pumpkin's footprint stays at least 1.5 m beyond that edge.
  Footways, paths, cycleways and pedestrian areas do not count as traffic: vehicles in the feed
  don't drive there, and counting them would leave no pumpkins in a city centre. _(My call on
  the classes and numbers; the builder may tune the widths after looking at Oslo sentrum.)_
  Pumpkins go on the side of the stop away from the road. A stop with no clear spot gets no
  pumpkins; skipping is always allowed.
- **Clear of buildings:** pumpkins must not stand inside a building footprint (`openmaptiles`
  `building` layer), or a stop looks empty in 3D and pumpkins sit on roofs in 2D. _(My call.)_
- **During a chase** pumpkins keep appearing along the way: placement is rebuilt around the
  chased vehicle on a timer (every few seconds, as `AerialBuildingColours` refreshes during a
  chase), never per frame. A pumpkin within a set distance of the chased vehicle (on the order
  of 15–20 m, builder's call) is not drawn, so it can never hide it. Since placement is stable
  per stop, a rebuild only adds and drops pumpkins at the edges; ones already shown don't move.
  _(Decided by Lasse: option 1 of three; hiding them in a chase or freezing them were rejected.)_
- **Ground and occlusion** follow the vehicle models: height from `map.queryTerrainElevation`,
  drawn through the same interleaved `MapLibreOverlay` and `withLayerAsStyleLoaded` handover so
  buildings and terrain hide them. deck.gl allows one interleaved overlay per map and
  `VehicleModels` owns it, so pumpkin layers are handed to `VehicleModels` (prop or store, as the
  stop poles and schedule ghost are) and joined in its `handOver`; the pumpkin logic can live in
  its own hook/component but never creates a second overlay. A pumpkin sits level (no terrain lean needed).
- **Scheme lighting** follows `MODEL_MATERIALS` in `vehicleModelLayers.ts`: in dark mode the
  pumpkin body takes `DARK_SHADING`, and the carved face and inner glow are lamp colours (added
  to `LAMP_COLOURS`) lit like the vehicles' lamps.
- **Testable logic in plain `.ts` modules in `src/domain/`** (vitest does not collect `.tsx`):
  the season window, the per-stop seeded placement, the road-clearance check and the mesh
  builder each get unit tests.

## Decided

- Look: option B from the mockups, giant 3D pumpkins never taller than a bus (3.2 m in
  `vehicleFootprint.ts`); in practice 1.5–2.5 m.
- Placement: a few, at random, near some stops; static.
- Timing: automatic around Halloween; Halloween ships before the other seasons.
- Hard rules: never block vehicles, never slow the map.
- In a chase (and so in a chasing kiosk), pumpkins are rebuilt around the chased vehicle.

## My calls (check these)

- Window 24 Oct – 1 Nov inclusive, judged by the date in Europe/Oslo.
- Roughly one stop in three gets pumpkins, 1–3 each, 1.5–2.5 m tall, random yaw.
- "Random but stable": seeded from the stop's coordinates (rounded so tile boundaries don't
  change the seed), so no stored state is needed.
- 200 per view cap, 4 m road clearance.
- Dark mode jack-o'-lanterns; light mode plain pumpkins.
- `?season=halloween` forces the season (and, I suggest, `?season=none` forces it off); read
  like the kiosk params, not part of `Filter`, so it never reaches subscription variables.
- Shown in kiosk mode too: a wall screen is where delight pays off most.
- Independent of the "Transit network" switch.

## Left to the builder

- Whether the pumpkin builder lives in `vehicleMeshes.ts` (where `LAMP_COLOURS` is private) or
  the mesh-building helpers get exported.
- The pumpkin mesh: low-poly, ribbed, with a stem, in the style of `vehicleMeshes.ts`, and
  how the carved face is modelled (separate primitives in a lamp colour is the obvious route).
- How to find the stop's road side and test clearance against the tile geometry.
- Exact seeding and spread radius around the stop (a few metres to ~15 m).
- Module and component names, and where the component mounts next to `VehicleModels`.

## Done means

- Unit tests for season window, seeding stability, clearance and mesh pass; `npm run lint` clean.
- A Playwright check with `?season=halloween` at a known stop at zoom 17 finds pumpkins; without
  the parameter (and with `?season=none`) it finds none. Interleaved deck.gl layers don't show in
  the map style, so this needs a dev-only `window` hook (e.g. the pumpkin count), in the style of
  `window.__kiosk`. _(My call.)_
- Measured on dev in 3D at street level in a busy area (e.g. Oslo sentrum), and during a chase
  through it: fps with and without pumpkins, in both schemes, with the numbers written into this
  document. No measurable drop is
  the bar.
- Looked at by eye in both schemes: no pumpkin on a road or track, none hiding a chased vehicle.

## Measured (2026-10-20, dev, Chrome, 1560×784 viewport, 60 Hz display)

Frames counted with `requestAnimationFrame` during a 10 s linear 90° rotation
(3D, zoom 16.5, pitch 60, Oslo sentrum), twice per case; and over 20 s of a
chase (bus 600 at Oslo bussterminal, zoom 17.5, pitch 60). "Worst" is the
longest single frame.

| Case                                 | Pumpkins | fps                    | Worst frame |
| ------------------------------------ | -------- | ---------------------- | ----------- |
| Rotation, light, `?season=none`      | –        | 60.0 / 60.0            | 19 ms       |
| Rotation, light, `?season=halloween` | 20       | 59.4 / 59.9            | 33 ms       |
| Rotation, dark, `?season=none`       | –        | 60.0 / 60.0            | 18 ms       |
| Rotation, dark, `?season=halloween`  | 20       | 59.3 / 60.0            | 34 / 18 ms  |
| Chase, dark, `?season=none`          | –        | 60.0, 0 frames > 25 ms | 18 ms       |
| Chase, dark, `?season=halloween`     | 9        | 60.0, 1 frame > 25 ms  | 33 ms       |

One build in that sentrum 3D view: about 7 ms reading stops, roads and
buildings from the tiles (153 stops, 4,567 road lines, 3,044 buildings) and
about 6 ms placing (14 ms cold). Average frame rate does not move; what does
is an occasional single dropped frame when a build lands in a frame — about
one per 10–20 s in these runs. Against "no measurable drop" that is a
measurable cost, left for the user to judge.

Density: at zoom 16 with no tilt, buildings leave few clear spots in city
centres — Oslo sentrum 14 pumpkins at 9 of 97 stops, Majorstuen 20 at 11 of
66, Bergen sentrum 8 at 5 of 49, Grorud 6 at 4 of 28.
