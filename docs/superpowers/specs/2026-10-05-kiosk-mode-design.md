# Kiosk mode — design

Date: 2026-10-05

## Purpose

Let the map run unattended on a wall screen in an open work area. In vehicles mode it
picks a vehicle, chases it, and after a while moves on to another — indefinitely, with
nobody at the screen.

The filters in force decide what it may pick. A kiosk loaded with `?codespace=ATB` only
ever chases ATB vehicles; operator and `maxDataAge` narrow it the same way.

Out of scope, and deliberately left for later: scheduled page reloads, screen wake-lock,
choosing vehicles by delay or mode, a fixed-area kiosk, and a phone-specific kiosk
layout.

## Decisions

| Question                       | Decision                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| How random is "random"?        | Random among **good chase candidates**; uniformly random among all eligible vehicles when none qualifies. |
| Where may the next vehicle be? | **Anywhere the filter allows.** Every switch may be a long jump.                                          |
| Someone touches the screen     | **Pause**, hand them the normal app, **resume after an idle period**.                                     |
| What the screen shows          | **A clean view**: app chrome hidden, a bottom band with a large caption and the next stops.               |
| When to switch                 | After _N_ minutes, **at the vehicle's next stop arrival**, capped at _N_ + 2 minutes.                     |
| What a visitor leaves behind   | **Restored on resume** to the kiosk's own setup.                                                          |

## Turning it on

`?kiosk=<seconds>` enables kiosk mode with a dwell of that many seconds. `?kiosk` with no
value, or one that does not parse as a positive integer, means the default dwell of
**180 s**. It combines with the existing params, so a screen is set up by loading one
link, e.g. `?kiosk=180&codespace=ATB`.

Read by `useKioskQueryParam`, a sibling of `useModeQueryParam` and
`useViewDimensionQueryParam`. It is read once on load and never written: kiosk mode is
not something toggled from the UI, and keeping it out of `Filter` keeps it out of the
subscription variables, like the colour scheme. The parsing is a pure function in
`src/domain/kioskSchedule.ts`.

`?kiosk` forces `mode` to `vehicles` at start and on every resume; situations mode has
nothing to chase.

## Architecture

The kiosk is a **controller that drives state the app already has**. It does not draw a
second map, own a camera loop, or synthesise clicks. Its outputs are:

- the selected vehicle and the chase, through the same `MapView` callbacks a person
  uses (selection, `handleChaseToggle` / `stopChase`), so 3D switching, map padding,
  `ChaseCamera`, the timetable subscription and the route all behave exactly as for a
  person;
- camera moves for the transitions between vehicles (`flyTo` / `fitBounds` on the map);
- the restored setup on resume (filter, mode, layer switches);
- what the overlay shows.

### Units

| Unit                              | Kind      | Job                                                                                                                             |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/kioskCandidates.ts`   | pure      | From the current and previous snapshots, the filter, recent picks, `now` and a random number, return the next target or `null`. |
| `src/domain/kioskSchedule.ts`     | pure      | The state machine: phases, timers, switch triggers, pause/resume. Also parses `?kiosk=`.                                        |
| `src/hooks/useKioskCandidates.ts` | hook      | Polls the filtered vehicle snapshot every 60 s and keeps the previous one.                                                      |
| `src/hooks/useKioskQueryParam.ts` | hook      | Reads `?kiosk=` once.                                                                                                           |
| `src/hooks/useKiosk.ts`           | hook      | Wires the machine to `MapView`'s setters, the map, the live `data` and the timetable; listens for input.                        |
| `src/components/KioskOverlay.tsx` | component | The bottom band, the transition caption and the paused pill.                                                                    |

Both domain modules take `now` and random numbers as parameters, so they are
deterministic under test. Per `vitest.config.ts`, all logic that needs testing lives in
these `.ts` modules; the hook and component stay thin.

## Candidates

The live subscription cannot supply the next vehicle: while chasing, its bounding box
is the few kilometres around the chased vehicle (`chaseBoundingBox`). Candidates
therefore come from the existing filtered snapshot query
(`useVehiclePositionsSnapshotFetcher`: `vehicles(codespaceId, operatorRef)`, no bbox),
polled every **60 s** by `useKioskCandidates`, which keeps the previous result so a
vehicle can be compared with itself.

A vehicle is **eligible** when it has a valid location and its `lastUpdated` is within
`maxDataAge` of `now` (applied client-side; the query does not take it).

An eligible vehicle is a **good candidate** when, additionally:

- it is `monitored`;
- it appears in the previous snapshot under the same `vehicleId + serviceJourneyId`
  (the cache key, so a vehicle that changed journey is not compared with its old one)
  and has moved at least **100 m** since;
- its `lastUpdated` is no more than **10 s** before the snapshot's fetch time — a proxy
  for reporting often, since a vehicle that reports every 60 s is usually seen with an
  older timestamp. Occasionally wrong; harmless when it is.

Vehicles among the last **10 picks** are excluded from both sets, unless that empties
the eligible set.

Selection: a uniformly random good candidate; if there are none (including the first
minute after load, before a previous snapshot exists), a uniformly random eligible
vehicle; if there are none of those, `null`.

The thresholds are named constants in `kioskCandidates.ts`.

## How a switch works

```
picking ──► leaving ──► arriving ──► lockingOn ──► chasing ──► waitingForStop
   ▲                                     │            │              │
   └─────────── pick again ──────────────┴────────────┴──────────────┘
```

1. **Picking.** Ask `kioskCandidates` for a target. `null` → stay here, show the
   empty state (below), retry on the next snapshot.
2. **Leaving.** Stop the current chase (`stopChase`) and ease out to a 2D overview that
   fits both the current position and the target's snapshot position.
3. **Arriving.** Fly to the target's snapshot position at about zoom 14. The vehicle
   subscription's bbox follows the viewport, so the target's live reports start
   arriving.
4. **Locking on.** As soon as `vehicleId + serviceJourneyId` is in the live `data`,
   select it and start the chase. Not there within **15 s** → back to picking, from
   where the map now is. Such a miss is not added to the recent picks. After **3**
   misses in a row, wait for the next snapshot before picking again.
5. **Chasing.** For the dwell _N_.
6. **Waiting for stop.** After _N_, switch when the vehicle arrives at its next stop
   (the next call's `actualArrivalTime` is set). Hard cap at _N_ + 120 s.

Early switch from chasing or waiting, straight to picking:

- the vehicle is no longer in the live `data` (expired from the cache);
- its journey has ended (past its last call);
- it has not moved more than 25 m for **90 s**.

## Pause and resume

Any `pointerdown`, `wheel` or `keydown` on the window pauses the kiosk, whatever phase
it is in. The kiosk's own camera moves raise none of these, so it cannot pause itself.

Paused, the kiosk does nothing: the app is the normal app, with the chase (if any)
still running, and the visitor may stop it, pan, pick another vehicle, open panels or
change filters. A transition interrupted by a pause leaves the camera where it was.

Each input restarts an idle timer. After **120 s** without input the kiosk resumes:

1. restore the **setup snapshot** taken when the kiosk started — `currentFilter`
   (codespace, operator, maxDataAge; not the bbox), `mode` (forced to vehicles),
   `mapViewOptions` and the transit-network switch;
2. go to picking.

Restoring means a visitor who sets `codespace=RUT` and walks away does not turn an ATB
screen into a RUT screen until it is reloaded. The view dimension is not restored; the
next chase sets 3D and its end sets 2D as it already does.

## What the screen shows

### Hidden while the kiosk runs

`RightMenu` (toolbar, mode pill, tool panels), MapLibre's control stack,
`SelectedVehiclePanel`, the vehicle popup and the chase HUD. All of it returns at once
when the kiosk pauses.

The **attribution strip stays**: the tile credits are required.

### The band

A `FloatingCard` across the bottom of the map, standing clear above the attribution
strip like the sheet does (`sheetBottom`).

- **Left — the caption, in large type:** the mode icon (`VehicleIconCanvas`), the line
  code in the line's published colours when both parse (`labelColoursFor`, as the map
  label does), destination; below it operator/codespace and the delay in the existing
  delay colours (`DELAY_*` in `dataColours.ts`, thresholds from `delayThresholds.ts`).
- **Right — the next stops**, as a horizontal strip: the next 4–5 calls with their
  expected times, the stop being approached marked with `palette.selection`. Built from
  the timetable frames `MapView` already subscribes to for the selected journey; no new
  subscription. Hidden when there is no timetable.
- **Top edge — a thin progress line** filling towards the switch. While waiting for a
  stop it stays full and pulses gently.

During leaving, arriving and locking on, the band reads _"Next: <icon> <line>
<destination>"_ from the snapshot record, so a jump reads as deliberate.

Paused, the band shrinks to a pill: _"Kiosk paused · resumes in 1:45"_.

### Padding

The band reports its height into `MapBottomPadding`, as the sheet does, so the chase
centres the vehicle in the visible part of the map. `MapBottomPadding` stays the only
writer of the bottom padding; no new padding owner is introduced. A side column was
rejected because the chase already owns the top and restores left/right.

### Phone width

Below `DETAIL_SHEET_MEDIA_QUERY` the kiosk still runs, but shows the existing bottom
sheet at `peek` instead of the band. No phone-specific kiosk layout.

## Error handling

Every failure ends in "pick again"; none leaves the screen stuck.

| Failure                                           | Behaviour                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Snapshot fetch fails                              | Keep the previous snapshot, retry on the next poll. With none ever loaded, the band shows _"Waiting for vehicles…"_ over the default view. |
| Snapshot empty for the filter (e.g. ATB at night) | Show _"No vehicles match this filter right now"_ at the current overview; retry each poll. The filter is never relaxed.                    |
| Target never appears in the live feed             | Lock-on timeout and miss counting, above.                                                                                                  |
| Vehicle subscription drops mid-chase              | The vehicle leaves `data`; the "no longer in the feed" early switch handles it.                                                            |
| No timetable for the journey                      | Stop strip hidden; no stop to wait for, so switch at the _N_ + 120 s cap.                                                                  |
| Input during a transition                         | Pause immediately; the camera stays where it is.                                                                                           |

## Testing

**Vitest** (pure modules):

- `kioskCandidates`: each good-candidate condition on its own; the 100 m and 10 s
  boundaries; a vehicle that changed journey between snapshots is not "moved"; recent
  picks excluded, and allowed back when nothing else is eligible; fallback to eligible;
  `null` when empty; `maxDataAge` applied; the random number selects deterministically.
- `kioskSchedule`: each phase transition; dwell → waiting for stop → stop arrival; the
  cap; each early switch; lock-on timeout, miss counting and the 3-miss wait;
  pause from every phase; idle timer restarted by input; resume goes to picking;
  `?kiosk=` parsing (absent, empty, valid, zero, negative, garbage).

**Playwright** (Chromium, stubbed snapshot):

- Load `?kiosk=20&codespace=…`: toolbar hidden, band visible, a chase starts.
- Click the map: kiosk paused, toolbar back, pill shown.
- Change the codespace, advance the clock past the idle period with `page.clock`: kiosk
  resumes and the codespace is restored.

**Manually on dev:** a wide window for about 30 minutes, once with ATB and once
unfiltered, watching for transitions that fail to lock on, stuck phases and memory
growth.
