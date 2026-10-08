import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Filter } from "../types.ts";
import { FixedCamera } from "../domain/fixedCamera.ts";
import { ViewDimension } from "../domain/viewDimension.ts";
import { FixedKioskSettings, IDLE_MS } from "../domain/kioskSchedule.ts";
import {
  FIXED_VIEW_RUNNING,
  FixedViewEvent,
  FixedViewState,
  fixedViewStep,
} from "../domain/kioskFixedView.ts";
import { KioskSetup, devIdleOverride, readSetup } from "./useKiosk.ts";
import { useKioskInput } from "./useKioskInput.ts";

const TICK_MS = 1000;
/** Upper bound for the flight back after a visitor. */
const MAX_FLIGHT_MS = 5_000;

/** The app's own state changes, which `MapView` provides. */
export type FixedViewActions = {
  /** Vehicles mode, nothing selected, nothing followed or chased. */
  leave: () => void;
  restore: (setup: KioskSetup) => void;
  setDimension: (dimension: ViewDimension) => void;
};

type UseFixedViewKioskArgs = {
  /** From `useKioskSession`; null turns it off. A new `id` starts a fresh run. */
  session: (FixedKioskSettings & { id: number }) | null;
  beginSession: (settings: FixedKioskSettings) => void;
  endSession: () => void;
  mapRef: RefObject<MapLibreMap | null>;
  actions: FixedViewActions;
  /** Read when a run starts: what it restores on every resume. */
  currentSetup: Omit<KioskSetup, "filter">;
};

/**
 * Runs the fixed-view kiosk: holds one camera and shows every vehicle in it,
 * through the ordinary vehicle subscription bounded by that view. Input
 * pauses it and hands the visitor the app; after the idle time, or the
 * pill's Resume, it restores the setup it started with and flies back.
 *
 * The camera is placed from an effect rather than where the run starts or
 * resumes, unlike the chasing kiosk's moves: `MapView`'s effects run after
 * `ViewDimensionLayers`' in the same commit, so the flight starts after —
 * and so is not cancelled by — the pitch ease of a dimension the resume put
 * back.
 */
export function useFixedViewKiosk({
  session,
  beginSession,
  endSession,
  mapRef,
  actions,
  currentSetup,
}: UseFixedViewKioskArgs): {
  state: FixedViewState | null;
  idleMs: number;
  /** The filter the run restores. */
  setupFilter: Partial<Filter>;
  resume: () => void;
  start: (
    camera: FixedCamera,
    dimension: ViewDimension,
    idleMs: number,
  ) => void;
  stop: () => void;
} {
  const sessionId = session?.id ?? null;
  const enabled = sessionId !== null;
  const sessionIdleMs = session?.idleMs ?? IDLE_MS;
  const idleMs = useMemo(
    () => devIdleOverride() ?? sessionIdleMs,
    [sessionIdleMs],
  );
  const [setup, setSetup] = useState<KioskSetup>(() => readSetup(currentSetup));
  const [state, setState] = useState<FixedViewState>(FIXED_VIEW_RUNNING);
  // Bumped whenever the camera is to be put back: a jump at a run's start
  // (from the Kiosk tool, where the camera is already there), a flight on
  // every resume.
  const [placement, setPlacement] = useState({ count: 0, fly: false });
  // A new run starts from scratch with the setup in force at its start.
  // Adjusted during render, so no frame shows the last run's state.
  const [runId, setRunId] = useState(sessionId);
  if (sessionId !== runId) {
    setRunId(sessionId);
    setState(FIXED_VIEW_RUNNING);
    if (sessionId !== null) {
      setSetup(readSetup(currentSetup));
      setPlacement((prev) => ({ count: prev.count + 1, fly: false }));
    }
  }

  const stateRef = useRef(state);
  const liveRun = useRef<number | null>(null);
  const latest = useRef({ actions, session, setup });
  useEffect(() => {
    latest.current = { actions, session, setup };
  });

  useEffect(() => {
    if (sessionId === null) return;
    liveRun.current = sessionId;
    stateRef.current = FIXED_VIEW_RUNNING;
    return () => {
      if (liveRun.current === sessionId) liveRun.current = null;
    };
  }, [sessionId]);

  const send = useCallback(
    (event: FixedViewEvent) => {
      if (sessionId === null || liveRun.current !== sessionId) return;
      const prev = stateRef.current;
      const next = fixedViewStep(prev, event, idleMs);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      if (prev.lastInputAt !== null && next.lastInputAt === null) {
        const { actions, session, setup } = latest.current;
        actions.leave();
        actions.restore(setup);
        if (session) actions.setDimension(session.dimension);
        setPlacement((p) => ({ count: p.count + 1, fly: true }));
      }
    },
    [sessionId, idleMs],
  );

  // Vehicles mode, the setup and the dimension from the start of a run, as on
  // every resume. `setup` is new for every run.
  useEffect(() => {
    if (!enabled) return;
    const { actions, session } = latest.current;
    actions.restore(setup);
    if (session) actions.setDimension(session.dimension);
  }, [enabled, setup]);

  // A link loaded cold has no map yet: `MapView` opens it on the camera.
  useEffect(() => {
    const map = mapRef.current;
    const camera = latest.current.session?.camera;
    if (placement.count === 0 || !map || !camera) return;
    const target = {
      center: [camera.longitude, camera.latitude] as [number, number],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
    };
    if (placement.fly) {
      map.flyTo({ ...target, essential: true, maxDuration: MAX_FLIGHT_MS });
    } else {
      map.jumpTo(target);
    }
  }, [placement, mapRef]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(
      () => send({ type: "tick", now: Date.now() }),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [enabled, send]);

  const onInput = useCallback(
    () => send({ type: "input", now: Date.now() }),
    [send],
  );
  useKioskInput(enabled, onInput);

  // Lets the Playwright tests see the state. Development builds only. Written
  // only while a run exists, so it does not clear the chasing kiosk's.
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    const w = window as unknown as { __kiosk?: { phase: string } };
    w.__kiosk = { phase: state.lastInputAt === null ? "fixed" : "paused" };
    return () => {
      w.__kiosk = undefined;
    };
  }, [enabled, state]);

  const resume = useCallback(
    () => send({ type: "resume", now: Date.now() }),
    [send],
  );

  // As in the chasing kiosk, a start ends a chase or selection the person
  // left, and a stop cuts the run's callbacks off at once.
  const start = useCallback(
    (camera: FixedCamera, dimension: ViewDimension, idleMs: number) => {
      latest.current.actions.leave();
      beginSession({ kind: "fixed", camera, dimension, idleMs });
    },
    [beginSession],
  );
  const stop = useCallback(() => {
    if (sessionId === null) return;
    liveRun.current = null;
    latest.current.actions.leave();
    endSession();
  }, [sessionId, endSession]);

  return {
    state: enabled ? state : null,
    idleMs,
    setupFilter: setup.filter,
    resume,
    start,
    stop,
  };
}
