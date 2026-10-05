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
 * Switch early once the target has been gone from the live data this long.
 * The live cache drops a vehicle after maxDataAge (30 s by default), and some
 * operators report only once a minute.
 */
export const ABSENT_GRACE_MS = 60_000;
/** Input this soon after the last is not recorded again, sparing a render. */
export const INPUT_COALESCE_MS = 1_000;

/**
 * `?kiosk=<seconds>` as a dwell in ms; null when kiosk mode is off. Anything
 * but a positive whole number of seconds means the default dwell.
 */
export function parseKioskParam(search: string): number | null {
  const params = new URLSearchParams(search);
  if (!params.has("kiosk")) return null;
  return secondsParam(params, "kiosk") ?? DEFAULT_DWELL_MS;
}

/** A positive whole number of seconds as ms, or null for anything else. */
function secondsParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key) ?? "";
  const seconds = /^\d+$/.test(raw) ? Number(raw) : 0;
  return seconds > 0 ? seconds * 1000 : null;
}

export type KioskConfig = { dwellMs: number; idleMs: number };

/**
 * A kiosk run, from a Start in the Kiosk tool or a `?kiosk` link loaded cold.
 * `id` is new for every run, so `useKiosk` can tell a fresh start from a
 * re-render of the same one.
 */
export type KioskSession = KioskConfig & { id: number };

/**
 * `?kiosk=<seconds>&kioskIdle=<seconds>` as the kiosk's settings; null when
 * kiosk mode is off. `kioskIdle` is read like `kiosk`: anything but a
 * positive whole number of seconds, or none at all, means IDLE_MS.
 */
export function parseKioskSettings(search: string): KioskConfig | null {
  const dwellMs = parseKioskParam(search);
  if (dwellMs === null) return null;
  const idleMs = secondsParam(new URLSearchParams(search), "kioskIdle");
  return { dwellMs, idleMs: idleMs ?? IDLE_MS };
}

/**
 * `href` with the kiosk's two keys set from `settings`, or both removed when
 * it is null. `kioskIdle` is written only when it is not the default, so a
 * plain link stays `?kiosk=180`. Every other key is left as it is, and when
 * nothing changes `href` comes back as given, re-encoding nothing.
 */
export function withKioskParams(
  href: string,
  settings: KioskConfig | null,
): string {
  const url = new URL(href);
  const params = url.searchParams;
  const wanted: Record<string, string | null> = {
    kiosk: settings ? String(Math.round(settings.dwellMs / 1000)) : null,
    kioskIdle:
      settings && settings.idleMs !== IDLE_MS
        ? String(Math.round(settings.idleMs / 1000))
        : null,
  };
  let changed = false;
  for (const [key, value] of Object.entries(wanted)) {
    if (params.get(key) === value) continue;
    changed = true;
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return changed ? url.toString() : href;
}

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
  | { type: "input"; now: number }
  /** A person asked it to resume now rather than after the idle period. */
  | { type: "resume"; now: number };

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
    world.absentForMs >= ABSENT_GRACE_MS ||
    world.journeyEnded ||
    world.stillForMs >= STATIONARY_MS
  );
}

type TickEvent = Extract<KioskEvent, { type: "tick" }>;

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
    if (
      phase.kind === "paused" &&
      event.now - phase.lastInputAt < INPUT_COALESCE_MS
    ) {
      return state;
    }
    return withPhase(state, { kind: "paused", lastInputAt: event.now });
  }
  if (event.type === "resume") {
    // No pool here, so the pick waits for the next tick. Nothing is being
    // chased, so that one tick of "Finding a vehicle…" cancels no ease.
    return phase.kind === "paused" ? withPhase(state, PICK_AFRESH) : state;
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

  const next = tickStep(state, event, config);
  // A tick that ends something picks the next in the same tick, so the band
  // goes straight to "Next: …" (or to waiting) with no "Finding a vehicle…"
  // in between, and the switch is one transition with one "leave".
  return next !== state && next.phase.kind === "picking"
    ? tickStep(next, event, config)
    : next;
}

function tickStep(
  state: KioskState,
  event: TickEvent,
  config: KioskConfig,
): KioskState {
  const { phase } = state;
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
      const target = pickCandidate(pool, state.recent, random);
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
 * "leave" runs on entering `leaving`, on any move from a phase with a target
 * to one without (a pause aside), so a chase that ends early is stopped even
 * when nothing is found to replace it, and on every resume, after the
 * restore: a resume that lands in `waiting` would otherwise leave the
 * visitor's chase running under "No vehicles match". Once per transition. "holdCamera" runs when a visitor pauses
 * mid-flight, so the camera stays where it is; only `arriving` has a flight of
 * the kiosk's own to stop (leaving's move is the chase's exit ease).
 */
export function effectsOf(prev: KioskPhase, next: KioskPhase): KioskEffect[] {
  if (prev === next) return [];
  const effects: KioskEffect[] = [];
  const resuming = prev.kind === "paused" && next.kind !== "paused";
  if (resuming) effects.push("restoreSetup");
  if (
    resuming ||
    next.kind === "leaving" ||
    (targetOf(prev) !== null &&
      targetOf(next) === null &&
      next.kind !== "paused")
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
