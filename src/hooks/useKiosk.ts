import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  EstimatedTimetableUpdate,
  Filter,
  MapViewOptions,
  VehicleUpdate,
} from "../types.ts";
import { VehicleData } from "./useVehiclePositionsData.ts";
import { useKioskCandidates } from "./useKioskCandidates.ts";
import { filterFromQueryParams } from "../domain/filterQueryParams.ts";
import { vehicleKey } from "../domain/kioskCandidates.ts";
import {
  MODEL_REACH_METRES,
  ViewBounds,
  padBounds,
  viewBoundsAt,
} from "../domain/vehiclesInView.ts";
import {
  KioskTrack,
  NO_TRACK,
  callsFor,
  kioskWorld,
} from "../domain/kioskJourney.ts";
import {
  DEFAULT_DWELL_MS,
  IDLE_MS,
  INITIAL_KIOSK_STATE,
  KioskConfig,
  KioskEffect,
  KioskEvent,
  KioskPhase,
  KioskSession,
  KioskState,
  effectsOf,
  step,
  targetOf,
} from "../domain/kioskSchedule.ts";

/** Close enough that the subscription's box holds the target and a few neighbours. */
export const ARRIVE_ZOOM = 14;
const TICK_MS = 1000;
/** Upper bound for the flight across the country. */
const MAX_FLIGHT_MS = 10_000;
const INPUT_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/** What the kiosk puts back when it resumes after a visitor. */
export type KioskSetup = {
  filter: Partial<Filter>;
  mapViewOptions: MapViewOptions;
  showTransitNetwork: boolean;
};

/** The app's own state changes, which `MapView` provides. */
export type KioskActions = {
  /** Vehicles mode, nothing selected, nothing followed or chased. */
  leave: () => void;
  /** Select `vehicle` and chase it. */
  chase: (vehicle: VehicleUpdate) => void;
  /**
   * Point the vehicle subscription at `boundingBox`: the view a flight is
   * headed for, so the target and its neighbours are on the map before the
   * camera gets there rather than only once it has landed.
   */
  watchArea: (boundingBox: ViewBounds) => void;
  restore: (setup: KioskSetup) => void;
};

type UseKioskArgs = {
  /**
   * From `useKioskSession`; null turns everything off. A new `id` starts a
   * fresh run.
   */
  session: KioskSession | null;
  /** Begins a session; called by the returned `start`. */
  beginSession: (dwellMs: number, idleMs: number) => void;
  /** Ends the session; called by the returned `stop`. */
  endSession: () => void;
  mapRef: RefObject<MapLibreMap | null>;
  data: VehicleData[];
  timetable: EstimatedTimetableUpdate | null;
  actions: KioskActions;
  /** Read when a session starts: what the kiosk restores on every resume. */
  currentSetup: Omit<KioskSetup, "filter">;
};

/**
 * The setup a run puts back: the filter from the URL, which the filter state
 * is synced to — and on a cold load is only filled from in an effect after
 * the first render.
 */
function readSetup(currentSetup: Omit<KioskSetup, "filter">): KioskSetup {
  return {
    ...currentSetup,
    filter: filterFromQueryParams(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    ),
  };
}

function liveVehicle(data: VehicleData[], key: string) {
  return (
    data.find(
      ({ vehicleUpdate: v }) =>
        vehicleKey(v.vehicleId, v.serviceJourney.id) === key,
    )?.vehicleUpdate ?? null
  );
}

/**
 * Runs the kiosk: ticks the state machine in `kioskSchedule.ts` once a
 * second with what it needs to know, pauses it on any input, and performs
 * the effects of each transition through `actions` and the map. The effects
 * run where the transition happens — in the tick, listener or moveend
 * callback — rather than in a React effect, so each happens exactly once.
 */
export function useKiosk({
  session,
  beginSession,
  endSession,
  mapRef,
  data,
  timetable,
  actions,
  currentSetup,
}: UseKioskArgs): {
  state: KioskState | null;
  config: KioskConfig;
  /** The filter the run restores, and so chases from. */
  setupFilter: Partial<Filter>;
  /** Resume now rather than after the idle period; ignored unless paused. */
  resume: () => void;
  /** Begin a run from a clean slate: a person's chase and selection end. */
  start: (dwellMs: number, idleMs: number) => void;
  /** End the run: the last chase stops and the selection clears. */
  stop: () => void;
} {
  const sessionId = session?.id ?? null;
  const enabled = sessionId !== null;
  const dwellMs = session?.dwellMs ?? DEFAULT_DWELL_MS;
  const idleMs = session?.idleMs ?? IDLE_MS;
  // The dev override wins over the session's idle time, as it did over the
  // default before runs could be started in the app.
  const config = useMemo<KioskConfig>(
    () => ({ dwellMs, idleMs: devIdleOverride() ?? idleMs }),
    [dwellMs, idleMs],
  );
  const [setup, setSetup] = useState<KioskSetup>(() => readSetup(currentSetup));
  const [state, setState] = useState<KioskState>(INITIAL_KIOSK_STATE);
  // A new run starts from scratch with the setup in force at its start.
  // Adjusted during render, so no frame shows the last run's phase.
  const [runId, setRunId] = useState(sessionId);
  if (sessionId !== runId) {
    setRunId(sessionId);
    setState(INITIAL_KIOSK_STATE);
    if (sessionId !== null) setSetup(readSetup(currentSetup));
  }
  const pool = useKioskCandidates(setup.filter, enabled);

  const stateRef = useRef(state);
  const track = useRef<KioskTrack>(NO_TRACK);
  // The run the listeners, the tick and a flight's moveend belong to. A
  // callback from a stopped run — a flight still landing — finds it gone.
  const liveRun = useRef<number | null>(null);
  const latest = useRef({ data, timetable, actions, pool });
  useEffect(() => {
    latest.current = { data, timetable, actions, pool };
  });

  // Declared before the tick and the listeners, so their run is live before
  // they can send anything.
  useEffect(() => {
    if (sessionId === null) return;
    liveRun.current = sessionId;
    stateRef.current = INITIAL_KIOSK_STATE;
    track.current = NO_TRACK;
    return () => {
      if (liveRun.current === sessionId) liveRun.current = null;
    };
  }, [sessionId]);

  const send = useCallback(
    function send(event: KioskEvent) {
      if (sessionId === null || liveRun.current !== sessionId) return;
      const prev = stateRef.current;
      const next = step(prev, event, config);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      for (const effect of effectsOf(prev.phase, next.phase)) {
        perform(effect, next.phase);
      }

      function perform(effect: KioskEffect, phase: KioskPhase) {
        const { actions, data } = latest.current;
        const target = targetOf(phase);
        switch (effect) {
          case "restoreSetup":
            actions.restore(setup);
            return;
          case "holdCamera":
            mapRef.current?.stop();
            return;
          case "leave":
            track.current = NO_TRACK;
            actions.leave();
            return;
          case "flyToTarget": {
            const map = mapRef.current;
            if (!map || !target) return;
            map.flyTo({
              center: [target.lon, target.lat],
              zoom: ARRIVE_ZOOM,
              // Level whatever ease a band or padding change cancelled.
              bearing: 0,
              pitch: 0,
              essential: true,
              maxDuration: MAX_FLIGHT_MS,
            });
            // Registered after flyTo: starting a flight stops any camera move
            // in progress, and that move's moveend is not this arrival.
            map.once("moveend", () =>
              send({ type: "arrived", now: Date.now() }),
            );
            // After flyTo too: the moveend of the move it stopped has been
            // captured by now, and would otherwise overwrite this box.
            const container = map.getContainer();
            actions.watchArea(
              padBounds(
                viewBoundsAt({
                  longitude: target.lon,
                  latitude: target.lat,
                  zoom: ARRIVE_ZOOM,
                  width: container.clientWidth,
                  height: container.clientHeight,
                  padding: map.getPadding(),
                }),
                MODEL_REACH_METRES,
              ),
            );
            return;
          }
          case "startChase": {
            const vehicle = target && liveVehicle(data, target.key);
            if (vehicle) actions.chase(vehicle);
            return;
          }
        }
      }
    },
    [sessionId, config, setup, mapRef],
  );

  // Vehicles mode from the start of a run, as on every resume: with
  // `?mode=situations` the first pick could be a long way off when nothing
  // matches. `setup` is new for every run.
  useEffect(() => {
    if (enabled) latest.current.actions.restore(setup);
  }, [enabled, setup]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const { data, timetable, pool } = latest.current;
      const target = targetOf(stateRef.current.phase);
      const vehicle = target && liveVehicle(data, target.key);
      const { world, track: next } = kioskWorld(
        vehicle
          ? { lon: vehicle.location.longitude, lat: vehicle.location.latitude }
          : null,
        target ? callsFor(timetable, target.serviceJourneyId) : null,
        track.current,
        now,
      );
      track.current = next;
      send({ type: "tick", now, world, pool, random: Math.random() });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, send]);

  // Captured, so input reaches the kiosk before anything that stops it. The
  // kiosk's own camera moves raise none of these events.
  useEffect(() => {
    if (!enabled) return;
    const onInput = () => send({ type: "input", now: Date.now() });
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    return () => {
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [enabled, send]);

  // Lets the Playwright tests see the phase. Development builds only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __kiosk?: { phase: string } }).__kiosk = enabled
      ? { phase: state.phase.kind }
      : undefined;
  }, [enabled, state]);

  const resume = useCallback(
    () => send({ type: "resume", now: Date.now() }),
    [send],
  );

  // Both done here, where the run begins or ends, rather than in an effect on
  // the session, so each `leave` happens exactly once. At a start it ends a
  // chase the person left running, which would otherwise go on under
  // "Waiting for vehicles…" until the first pick — indefinitely when nothing
  // matches. A link loaded cold has nothing to end.
  const start = useCallback(
    (dwellMs: number, idleMs: number) => {
      latest.current.actions.leave();
      beginSession(dwellMs, idleMs);
    },
    [beginSession],
  );
  // At a stop the run's callbacks are cut off at once, and the chase it left
  // running is stopped.
  const stop = useCallback(() => {
    if (sessionId === null) return;
    liveRun.current = null;
    latest.current.actions.leave();
    endSession();
  }, [sessionId, endSession]);

  return {
    state: enabled ? state : null,
    config,
    setupFilter: setup.filter,
    resume,
    start,
    stop,
  };
}

/** A shorter idle period for the Playwright tests. Development builds only. */
function devIdleOverride(): number | null {
  if (!import.meta.env.DEV) return null;
  const value = (window as unknown as { __kioskIdleMs?: unknown })
    .__kioskIdleMs;
  return typeof value === "number" && value > 0 ? value : null;
}
