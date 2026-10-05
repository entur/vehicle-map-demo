import { RefObject, useCallback, useEffect, useRef, useState } from "react";
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
  restore: (setup: KioskSetup) => void;
};

type UseKioskArgs = {
  /** From `useKioskQueryParam`; null turns everything off. */
  dwellMs: number | null;
  mapRef: RefObject<MapLibreMap | null>;
  data: VehicleData[];
  timetable: EstimatedTimetableUpdate | null;
  actions: KioskActions;
  /** Read once, on the first render. */
  initialSetup: Omit<KioskSetup, "filter">;
};

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
  dwellMs,
  mapRef,
  data,
  timetable,
  actions,
  initialSetup,
}: UseKioskArgs): {
  state: KioskState | null;
  config: KioskConfig;
  /** Resume now rather than after the idle period; ignored unless paused. */
  resume: () => void;
} {
  const enabled = dwellMs !== null;
  const [config] = useState<KioskConfig>(() => ({
    dwellMs: dwellMs ?? DEFAULT_DWELL_MS,
    idleMs: devIdleOverride() ?? IDLE_MS,
  }));
  // The setup the screen was loaded with: the filter from the URL, since the
  // filter state is only filled from it in an effect after this render.
  const [setup] = useState<KioskSetup>(() => ({
    ...initialSetup,
    filter: filterFromQueryParams(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    ),
  }));
  const pool = useKioskCandidates(setup.filter, enabled);

  const [state, setState] = useState<KioskState>(INITIAL_KIOSK_STATE);
  const stateRef = useRef(state);
  const track = useRef<KioskTrack>(NO_TRACK);
  const latest = useRef({ data, timetable, actions, pool });
  useEffect(() => {
    latest.current = { data, timetable, actions, pool };
  });

  const send = useCallback(
    function send(event: KioskEvent) {
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
    [config, setup, mapRef],
  );

  // Vehicles mode from the start, as on every resume: with `?mode=situations`
  // the first pick could be a long way off when nothing matches.
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
    if (!import.meta.env.DEV || !enabled) return;
    (window as unknown as { __kiosk?: { phase: string } }).__kiosk = {
      phase: state.phase.kind,
    };
  }, [enabled, state]);

  const resume = useCallback(
    () => send({ type: "resume", now: Date.now() }),
    [send],
  );

  return { state: enabled ? state : null, config, resume };
}

/** A shorter idle period for the Playwright tests. Development builds only. */
function devIdleOverride(): number | null {
  if (!import.meta.env.DEV) return null;
  const value = (window as unknown as { __kioskIdleMs?: unknown })
    .__kioskIdleMs;
  return typeof value === "number" && value > 0 ? value : null;
}
