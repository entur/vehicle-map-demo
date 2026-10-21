# Seasonal decorations: New Year's fireworks

## Intent

The fourth seasonal decoration, after the Halloween pumpkins, the Christmas trees and the 17. mai
flags (`2026-10-20-seasonal-decorations-design.md`, `2026-10-20-christmas-trees-design.md`,
`2026-10-21-17-mai-flags-design.md`). Around New Year, rockets go up over the city in the 3D map
and burst into glowing sparks: scattered rockets all the time, a barrage every five minutes and a
finale at midnight on New Year's Eve. Like the other seasons, this is just for fun. It carries no
data and must never get in the way of the vehicles.

This is the first decoration that is **neither at the stops nor on the vehicles**: it hangs in the
sky. It is also the first that is a **visual event** rather than an object, so it is the first
that needs smooth, frame-rate animation.

Few people will look at the map on New Year's Eve itself, so the season runs over the days
between Christmas and New Year, when the map is actually in use.

## Goals

- From **27 December to 1 January** inclusive (Europe/Oslo dates), **around the clock**, with no
  switch to turn it on.
- **Scattered rockets:** single rockets go up at irregular moments anywhere in view. Each climbs
  on a faint trail and bursts into **glowing sparks** with trails that droop under gravity and
  fade out. This is style A in the brainstorm mockup: realistic, not low-poly, and not edged.
- **The barrage:** every five minutes, on the wall clock (:00, :05, :10…, Oslo time), many rockets
  go up over a few seconds. Every screen showing the map fires its barrage at the same moment.
- **The finale:** at midnight between 31 December and 1 January (Oslo time), a bigger and longer
  barrage takes the place of that slot's ordinary one.
- **Only in 3D**, and only from `VEHICLE_MODEL_MIN_ZOOM`, where vehicles are 3D models. Further out,
  or in 2D, nothing is drawn or computed.
- **It goes quiet like the lights and flags.** After `ANIMATION_IDLE_MS` (60 s) with no input or
  camera movement, no new scattered rockets go up. Rockets and sparks already in the air finish
  and fade; nothing freezes mid-air. When nothing is left in the air, the map is not repainted.
  Activity brings the scattered rockets back.
- **The barrage still fires when idle.** An idle screen wakes for each five-minute barrage (and
  the finale), shows it, lets it fade, and goes quiet again until the next one. A fixed-view kiosk
  at a bus terminal, which nobody touches, therefore still shows a barrage every five minutes.
- **No fireworks under `prefers-reduced-motion: reduce`.** A firework has no still pose.
- `?season=newyear` forces the season on any date. `?season=none` still forces everything off.

## Non-goals

- No sound.
- No fireworks in 2D or below `VEHICLE_MODEL_MIN_ZOOM`.
- No interaction: rockets cannot be clicked and take no input.
- No smoke, no light cast on the ground, buildings or vehicles, and no change to the sky colour.
- No link to the weather. Rockets go up in rain and snow too.
- No change to Halloween, the Christmas trees or the 17. mai flags, apart from what sharing the
  clock and the overlay requires.

## Anti-goals

1. **Fireworks getting in the way of the vehicles.** The bursts hang above the city, well above
   the models, their signs and the stop poles, and are depth-tested like everything else in the
   scene. They are not drawn over the panels or the chase HUD. With the camera tilted towards the
   horizon a burst can pass in front of a distant vehicle on screen; that is accepted, as it is
   for the stop decorations, which can briefly cover a vehicle from a camera near the horizon.
2. **Fireworks slowing the map down.** This is the one animation that needs every frame, so it
   must cost the GPU little and the CPU almost nothing. Per frame, only uniforms change: no layer
   data rebuilt, no attributes uploaded, no placement work. A barrage must not make a map without
   a GPU unusable.
3. **A screen that never rests.** Between barrages, an idle screen does no work at all, as with
   the lights and flags.

## Constraints

- **The season overlaps Christmas.** 27 December to 1 January lies inside the Christmas season,
  and the trees must stay up under the fireworks. Today `seasonOn` answers one season, the first
  window that matches. The fireworks are therefore an addition on top of the season, not a
  season that replaces Christmas. How that is modelled is the builder's choice (a second
  question beside `seasonOn`, or `seasonOn` answering several), but on 27 December both trees
  and fireworks are on, and `?season=newyear` shows the fireworks **and** the trees, as the real
  dates would. `?season=christmas` keeps showing trees without fireworks.
- **Drawn through the one overlay.** deck.gl allows one interleaved overlay per map, so the
  fireworks are drawn through `VehicleModels`' overlay, handed in through their own ref like the
  flags, so that a frame redraws only the fireworks' layers and never rebuilds the vehicle model,
  sign, flag or stop layers.
- **Motion in the shader.** A rocket's whole flight and every spark's path follow from a few
  numbers fixed at launch (launch point, launch time, burst height, colour, spark directions and
  speeds) plus elapsed time, gravity and drag. The vertex shader computes positions and fades from
  those and a time uniform, in the way `FlutterExtension` and `TwinkleExtension` do. The curves are
  pure functions in `src/domain/` that the shader reproduces, with their constants interpolated
  into the GLSL. Rockets are added to the layer's data only when they launch, and removed in
  batches after they have faded, not every frame.
- **Frame rate.** The 80 ms tick that serves the lights and flags is too coarse for a burst. While
  anything is in the air, the fireworks repaint every frame. When nothing is in the air, they
  request no frames at all.
- **The clock.** Build on `AnimationClock`'s rules (activity from `useKioskInput`'s events, `move`
  and `visibilitychange`; 60 s idle; reduced motion; a hidden page stops it) rather than on a
  second set. What is new is a **scheduled wake** for each barrage, which an idle clock must
  honour without any activity, and the different meaning of "settling": no new scattered rockets
  rather than easing an amount to 0.
- **Where rockets go up.** Inside the view the vehicles use (`cappedViewBounds`, never
  `map.getBounds()`), so tilted towards the horizon they do not go up kilometres away. Bursts are
  100–300 m above the ground at their launch point, with heights from
  `map.queryTerrainElevation`. A height not yet loaded (0) must not put a burst underground on a
  hill. Bursts are true to scale or a little larger; the builder tunes them to read at the model
  zoom.
- **Colours and blending, by scheme.** Sparks are bright colours plus white. In dark mode they
  blend additively, so overlapping sparks glow. In light mode they use ordinary alpha blending:
  additive light on the near-white Positron map washes to white and vanishes. They are data-free
  decoration, so `dataColours.test.ts`'s contrast rules do not apply, but they must not be mistaken
  for map marks.
- **Deterministic barrages.** A barrage's timing, count, colours and pattern are derived from its
  slot's time, so every screen fires the same barrage at the same moment. It is laid out over
  **each screen's own view**, not at fixed places on the map: a screen looking at Bergen sees a
  barrage too. Scattered rockets need no such agreement.
- **A barrage's wake is bounded.** On an idle screen a barrage wakes the fireworks (and the
  Christmas lights' clock) for the barrage alone: when its last sparks have faded, the screen is
  idle again at once. It is not activity in `AnimationClock`'s sense, which would buy 60 s of
  scattered rockets and twinkling after every barrage. On a screen someone is using, a barrage
  changes nothing about the idle timer.
- **A missed barrage is skipped.** A slot that passes while the page is hidden, in 2D or zoomed
  out is not fired late. A screen that comes back during a barrage joins it from where it is;
  otherwise it waits for the next slot.
- **Testable logic in plain `.ts`:** the season window and the overlap with Christmas, the barrage
  schedule (next slot, the midnight finale, Oslo time across the year's end), the flight and
  spark curves, the clock's scheduled wake, and the layer builder (rockets added on launch,
  removed after fading, the same data object between launches).

## Decided by Lasse

- The season is New Year's fireworks.
- Scattered rockets all the time, with a barrage at a regular interval of about five minutes.
- The period is longer than New Year's Eve: 27 December to 1 January, around the clock.
- The burst style is A, glowing sparks.
- It goes quiet after 60 s idle, like the lights and the flags.
- An idle screen still fires the five-minute barrage.
- Barrages on the wall clock, a finale at midnight, 3D from the model zoom only, and none under
  reduced motion.

## My calls (check these)

- **URL value:** `?season=newyear`, which also shows the trees.
- **The barrage:** about 20–30 rockets over about 10 s. **The finale:** about three times that,
  over about 60 s, at 00:00 on 1 January. Exact numbers are the builder's after measuring.
- **Scattered rockets:** about one every two to four seconds in view, at random.
- **Christmas lights during an idle barrage:** a barrage wakes the lights' clock too, for the
  barrage alone, so on an idle screen with trees the lights twinkle with the barrage and settle
  with it. I told Lasse this would happen.
- **A chase**, including a kiosk chase, moves the camera every frame and so keeps the scattered
  rockets going for its whole length.
- **Dev hook:** `window.__seasonal` keeps its shape for the trees, so the Christmas tests hold
  under `?season=newyear`, and gains a `rockets` field, the rockets and bursts in the air now,
  written by the fireworks.
- **Performance bar:** on a GPU, no measurable drop, as for the trees and flags. Without a GPU, a
  slower map while rockets are in the air is accepted, but a barrage must leave it usable. The
  measurement says how it went.

## Left to the builder

- Which deck.gl layer draws sparks and trails (points, billboards or line segments), and how the
  trail behind a spark is drawn.
- The flight and burst curves, gravity, drag, spark counts and burst shapes, within "realistic
  glowing sparks" as in the mockup.
- How the fireworks' frame loop and the shared clock fit together, and how the barrage wake
  reaches the lights' clock.
- How the season overlap is modelled, within the constraint above.
- Names of the new modules.

## Done means

- **Unit tests** for:
  - the season window: 26 December no fireworks, 27 December on, 1 January on, 2 January off, the
    Oslo-time edges, trees and fireworks together, `?season=newyear`, `?season=christmas` and
    `?season=none`
  - the barrage schedule, the midnight finale and the scheduled wake
  - the flight and spark curves
  - the layer builder
- Halloween, Christmas and 17. mai tests unchanged.
- `npm run lint` is clean.
- **Playwright:** with `?season=newyear` in 3D at the model zoom, `window.__seasonal.rockets`
  shows rockets in the air. With `?season=none` it shows none.
- **Looked at by eye in both schemes, still and in a chase:**
  - scattered rockets and a barrage that read as fireworks
  - nothing drawn over the vehicles, their signs or the panels
  - nothing under reduced motion emulated
  - an idle map going quiet, then waking for the next barrage on its own
- **Measured** as for the trees and the flags, on a production build:
  - a still map with scattered rockets, against `?season=none`
  - a barrage and the finale
  - render events while idle between barrages, with the vehicle feed closed: none
  - a chase, with and without fireworks
