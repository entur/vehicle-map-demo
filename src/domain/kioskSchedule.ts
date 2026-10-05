import type { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskVehicle,
  RECENT_PICKS,
  pickCandidate,
} from "./kioskCandidates.ts";
import type { KioskWorld } from "./kioskJourney.ts";

/** Dwell when `?kiosk` has no usable value. */
export const DEFAULT_DWELL_MS = 180_000;
/** Time for the chase's exit ease (and any 2D switch) before the flight. */
export const LEAVE_MS = 1_500;
/** Lock on anyway if the flight's moveend never comes. */
export const ARRIVE_TIMEOUT_MS = 15_000;
/** Pick again if the target has not appeared in the live feed by then. */
export const LOCK_ON_TIMEOUT_MS = 15_000;
/** Misses in a row before waiting for a newer snapshot. */
export const MAX_MISSES = 3;
/** Past the dwell, how long to wait for a stop before switching anyway. */
export const STOP_WAIT_CAP_MS = 120_000;
/** Switch early after standing still this long. */
export const STATIONARY_MS = 90_000;
/** Resume after this long without input. */
export const IDLE_MS = 120_000;

/**
 * `?kiosk=<seconds>` as a dwell in ms; null when kiosk mode is off. Anything
 * but a positive whole number of seconds means the default dwell.
 */
export function parseKioskParam(search: string): number | null {
  const params = new URLSearchParams(search);
  if (!params.has("kiosk")) return null;
  const raw = params.get("kiosk") ?? "";
  const seconds = /^\d+$/.test(raw) ? Number(raw) : 0;
  return seconds > 0 ? seconds * 1000 : DEFAULT_DWELL_MS;
}

export type KioskConfig = { dwellMs: number; idleMs: number };

export type WaitReason = "noSnapshot" | "noMatch" | "misses";

export type KioskPhase =
  /** Until a snapshot newer than `since` (its fetchedAt) arrives. */
  | { kind: "waiting"; reason: WaitReason; since: number }
  | { kind: "picking"; misses: number }
  | { kind: "leaving"; target: KioskVehicle; since: number; misses: number }
  | { kind: "arriving"; target: KioskVehicle; since: number; misses: number }
  | { kind: "lockingOn"; target: KioskVehicle; since: number; misses: number }
  | { kind: "chasing"; target: KioskVehicle; since: number }
  | {
      kind: "waitingForStop";
      target: KioskVehicle;
      chaseSince: number;
      since: number;
    }
  | { kind: "paused"; lastInputAt: number };

export type KioskState = {
  phase: KioskPhase;
  /** Keys of the latest vehicles locked on to, newest first. */
  recent: string[];
};

export type KioskEvent =
  | {
      type: "tick";
      now: number;
      world: KioskWorld;
      pool: CandidatePool;
      /** In [0, 1); passed in so the reducer stays pure. */
      random: number;
    }
  /** The flight to the target ended. */
  | { type: "arrived"; now: number }
  /** A person touched the screen, the mouse or the keyboard. */
  | { type: "input"; now: number };

export const INITIAL_KIOSK_STATE: KioskState = {
  phase: { kind: "waiting", reason: "noSnapshot", since: -Infinity },
  recent: [],
};

function withPhase(state: KioskState, phase: KioskPhase): KioskState {
  return { ...state, phase };
}

const PICK_AFRESH: KioskPhase = { kind: "picking", misses: 0 };

function shouldLeaveEarly(world: KioskWorld) {
  return (
    !world.targetInFeed ||
    world.journeyEnded ||
    world.stillForMs >= STATIONARY_MS
  );
}

/**
 * The kiosk's next state. Returns `state` itself when nothing changes, so a
 * caller can skip the render and the effects.
 */
export function step(
  state: KioskState,
  event: KioskEvent,
  config: KioskConfig,
): KioskState {
  const { phase } = state;
  if (event.type === "input") {
    return withPhase(state, { kind: "paused", lastInputAt: event.now });
  }
  if (event.type === "arrived") {
    return phase.kind === "arriving"
      ? withPhase(state, {
          kind: "lockingOn",
          target: phase.target,
          since: event.now,
          misses: phase.misses,
        })
      : state;
  }

  const { now, world, pool, random } = event;
  const snapshotAt = pool.current?.fetchedAt ?? -Infinity;
  switch (phase.kind) {
    case "paused":
      return now - phase.lastInputAt >= config.idleMs
        ? withPhase(state, PICK_AFRESH)
        : state;
    case "waiting":
      return snapshotAt > phase.since ? withPhase(state, PICK_AFRESH) : state;
    case "picking": {
      const target = pickCandidate(pool, state.recent, now, random);
      if (!target) {
        return withPhase(state, {
          kind: "waiting",
          reason: pool.current ? "noMatch" : "noSnapshot",
          since: snapshotAt,
        });
      }
      return withPhase(state, {
        kind: "leaving",
        target,
        since: now,
        misses: phase.misses,
      });
    }
    case "leaving":
      return now - phase.since >= LEAVE_MS
        ? withPhase(state, { ...phase, kind: "arriving", since: now })
        : state;
    case "arriving":
      return now - phase.since >= ARRIVE_TIMEOUT_MS
        ? withPhase(state, { ...phase, kind: "lockingOn", since: now })
        : state;
    case "lockingOn": {
      if (world.targetInFeed) {
        const key = phase.target.key;
        return {
          phase: { kind: "chasing", target: phase.target, since: now },
          recent: [key, ...state.recent.filter((k) => k !== key)].slice(
            0,
            RECENT_PICKS,
          ),
        };
      }
      if (now - phase.since < LOCK_ON_TIMEOUT_MS) return state;
      const misses = phase.misses + 1;
      return withPhase(
        state,
        misses >= MAX_MISSES
          ? { kind: "waiting", reason: "misses", since: snapshotAt }
          : { kind: "picking", misses },
      );
    }
    case "chasing":
      if (shouldLeaveEarly(world)) return withPhase(state, PICK_AFRESH);
      return now - phase.since >= config.dwellMs
        ? withPhase(state, {
            kind: "waitingForStop",
            target: phase.target,
            chaseSince: phase.since,
            since: now,
          })
        : state;
    case "waitingForStop":
      if (shouldLeaveEarly(world)) return withPhase(state, PICK_AFRESH);
      if (world.lastArrivalAt !== null && world.lastArrivalAt >= phase.since) {
        return withPhase(state, PICK_AFRESH);
      }
      return now - phase.chaseSince >= config.dwellMs + STOP_WAIT_CAP_MS
        ? withPhase(state, PICK_AFRESH)
        : state;
  }
}

export type KioskEffect =
  "restoreSetup" | "leave" | "flyToTarget" | "startChase" | "holdCamera";

/**
 * What has to happen in the app for the kiosk to go from `prev` to `next`.
 * "leave" runs on entering `leaving` and also on any move to `picking` from a
 * phase that had a target, so a chase that ends early is stopped even when
 * nothing is found to replace it. "holdCamera" runs when a visitor pauses
 * mid-flight, so the camera stays where it is; only `arriving` has a flight of
 * the kiosk's own to stop (leaving's move is the chase's exit ease).
 */
export function effectsOf(prev: KioskPhase, next: KioskPhase): KioskEffect[] {
  if (prev === next) return [];
  const effects: KioskEffect[] = [];
  if (prev.kind === "paused" && next.kind !== "paused") {
    effects.push("restoreSetup");
  }
  if (
    next.kind === "leaving" ||
    (next.kind === "picking" && targetOf(prev) !== null)
  ) {
    effects.push("leave");
  }
  if (prev.kind === "arriving" && next.kind === "paused") {
    effects.push("holdCamera");
  }
  if (next.kind === "arriving") effects.push("flyToTarget");
  if (next.kind === "chasing" && prev.kind === "lockingOn") {
    effects.push("startChase");
  }
  return effects;
}

export function targetOf(phase: KioskPhase): KioskVehicle | null {
  return "target" in phase ? phase.target : null;
}

export type KioskView =
  | { kind: "paused"; resumesInMs: number }
  | { kind: "message"; text: string }
  | { kind: "travelling"; target: KioskVehicle }
  | {
      kind: "chasing";
      target: KioskVehicle;
      /** Share of the dwell gone, 0–1. */
      progress: number;
      waitingForStop: boolean;
    };

/** What the overlay shows at `now`. */
export function kioskView(
  state: KioskState,
  now: number,
  config: KioskConfig,
): KioskView {
  const { phase } = state;
  switch (phase.kind) {
    case "paused":
      return {
        kind: "paused",
        resumesInMs: Math.max(0, config.idleMs - (now - phase.lastInputAt)),
      };
    case "waiting":
      return {
        kind: "message",
        text:
          phase.reason === "noMatch"
            ? "No vehicles match this filter right now"
            : "Waiting for vehicles…",
      };
    case "picking":
      return { kind: "message", text: "Finding a vehicle…" };
    case "leaving":
    case "arriving":
    case "lockingOn":
      return { kind: "travelling", target: phase.target };
    case "chasing":
      return {
        kind: "chasing",
        target: phase.target,
        progress: Math.min(
          1,
          Math.max(0, (now - phase.since) / config.dwellMs),
        ),
        waitingForStop: false,
      };
    case "waitingForStop":
      return {
        kind: "chasing",
        target: phase.target,
        progress: 1,
        waitingForStop: true,
      };
  }
}

/** `m:ss`, rounded up so it never shows 0:00 while time remains. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The filter with the kiosk's own codespace, operator and maxDataAge put
 * back and the viewport kept. Returns `prev` when they already match, so an
 * untouched kiosk does not reopen the vehicle subscription on every resume.
 */
export function restoredFilter(
  prev: Filter | null,
  setup: Partial<Filter>,
): Filter | null {
  if (!prev) return prev;
  const unchanged =
    prev.codespaceId === setup.codespaceId &&
    prev.operatorRef === setup.operatorRef &&
    prev.maxDataAge === setup.maxDataAge;
  return unchanged ? prev : { ...setup, boundingBox: prev.boundingBox };
}
