import { describe, expect, it } from "vitest";
import type { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskVehicle,
  RECENT_PICKS,
  vehicleKey,
} from "./kioskCandidates.ts";
import type { KioskWorld } from "./kioskJourney.ts";
import {
  ARRIVE_TIMEOUT_MS,
  DEFAULT_DWELL_MS,
  INITIAL_KIOSK_STATE,
  KioskConfig,
  KioskEvent,
  KioskPhase,
  KioskState,
  LEAVE_MS,
  LOCK_ON_TIMEOUT_MS,
  MAX_MISSES,
  STATIONARY_MS,
  STOP_WAIT_CAP_MS,
  effectsOf,
  formatCountdown,
  kioskView,
  parseKioskParam,
  restoredFilter,
  step,
  targetOf,
} from "./kioskSchedule.ts";

const T0 = Date.parse("2026-10-05T12:00:00Z");
const CONFIG: KioskConfig = { dwellMs: 180_000, idleMs: 120_000 };

function vehicle(id: string): KioskVehicle {
  return {
    key: vehicleKey(id, `SJ:${id}`),
    vehicleId: id,
    serviceJourneyId: `SJ:${id}`,
    date: "2026-10-05",
    codespaceId: "ATB",
    mode: "BUS",
    lineCode: "3",
    destinationName: "Hallset",
    lon: 10.4,
    lat: 63.43,
    lastUpdated: T0 - 1_000,
    monitored: true,
  };
}

const TARGET = vehicle("a");
const NO_WORLD: KioskWorld = {
  targetInFeed: false,
  stillForMs: 0,
  journeyEnded: false,
  lastArrivalAt: null,
};
const IN_FEED: KioskWorld = { ...NO_WORLD, targetInFeed: true };
const EMPTY_POOL: CandidatePool = {
  current: null,
  previous: null,
  maxDataAgeSeconds: 30,
};
const POOL: CandidatePool = {
  current: { fetchedAt: T0, vehicles: [TARGET] },
  previous: null,
  maxDataAgeSeconds: 30,
};
const NO_MATCH_POOL: CandidatePool = {
  current: { fetchedAt: T0, vehicles: [] },
  previous: null,
  maxDataAgeSeconds: 30,
};

function tick(
  now: number,
  world: KioskWorld = NO_WORLD,
  pool: CandidatePool = POOL,
): KioskEvent {
  return { type: "tick", now, world, pool, random: 0 };
}

function at(phase: KioskPhase, recent: string[] = []): KioskState {
  return { phase, recent };
}

const CHASING = at({ kind: "chasing", target: TARGET, since: T0 });
const WAITING_FOR_STOP = at({
  kind: "waitingForStop",
  target: TARGET,
  chaseSince: T0,
  since: T0 + CONFIG.dwellMs,
});

describe("parseKioskParam", () => {
  it("is off without the param", () => {
    expect(parseKioskParam("")).toBeNull();
    expect(parseKioskParam("?codespaceId=ATB")).toBeNull();
  });

  it("reads whole seconds as a dwell in ms", () => {
    expect(parseKioskParam("?kiosk=60")).toBe(60_000);
    expect(parseKioskParam("?codespaceId=ATB&kiosk=30")).toBe(30_000);
  });

  it("falls back to the default dwell on anything else", () => {
    for (const search of [
      "?kiosk",
      "?kiosk=",
      "?kiosk=0",
      "?kiosk=-5",
      "?kiosk=abc",
      "?kiosk=1.5",
    ]) {
      expect(parseKioskParam(search)).toBe(DEFAULT_DWELL_MS);
    }
  });
});

describe("step: finding a vehicle", () => {
  it("waits for the first snapshot", () => {
    const state = step(
      INITIAL_KIOSK_STATE,
      tick(T0, NO_WORLD, EMPTY_POOL),
      CONFIG,
    );
    expect(state).toBe(INITIAL_KIOSK_STATE);
    expect(step(INITIAL_KIOSK_STATE, tick(T0), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("after no match, waits for a newer snapshot", () => {
    const waiting = at({ kind: "waiting", reason: "noMatch", since: T0 });
    expect(step(waiting, tick(T0 + 1_000), CONFIG)).toBe(waiting);
    const newer: CandidatePool = {
      ...POOL,
      current: { fetchedAt: T0 + 60_000, vehicles: [TARGET] },
    };
    expect(
      step(waiting, tick(T0 + 61_000, NO_WORLD, newer), CONFIG).phase.kind,
    ).toBe("picking");
  });

  it("picks a vehicle and leaves for it", () => {
    const picking = at({ kind: "picking", misses: 2 });
    expect(step(picking, tick(T0 + 1_000), CONFIG).phase).toEqual({
      kind: "leaving",
      target: TARGET,
      since: T0 + 1_000,
      misses: 2,
    });
  });

  it("waits when nothing matches, keyed to that snapshot", () => {
    const picking = at({ kind: "picking", misses: 0 });
    expect(
      step(picking, tick(T0 + 1_000, NO_WORLD, NO_MATCH_POOL), CONFIG).phase,
    ).toEqual({ kind: "waiting", reason: "noMatch", since: T0 });
  });
});

describe("step: travelling", () => {
  const leaving = at({ kind: "leaving", target: TARGET, since: T0, misses: 1 });
  const arriving = at({
    kind: "arriving",
    target: TARGET,
    since: T0,
    misses: 1,
  });

  it("leaves for LEAVE_MS before flying", () => {
    expect(step(leaving, tick(T0 + LEAVE_MS - 1), CONFIG)).toBe(leaving);
    expect(step(leaving, tick(T0 + LEAVE_MS), CONFIG).phase).toEqual({
      kind: "arriving",
      target: TARGET,
      since: T0 + LEAVE_MS,
      misses: 1,
    });
  });

  it("locks on when the flight ends", () => {
    expect(
      step(arriving, { type: "arrived", now: T0 + 4_000 }, CONFIG).phase,
    ).toEqual({
      kind: "lockingOn",
      target: TARGET,
      since: T0 + 4_000,
      misses: 1,
    });
  });

  it("locks on anyway if the flight never reports its end", () => {
    expect(
      step(arriving, tick(T0 + ARRIVE_TIMEOUT_MS), CONFIG).phase.kind,
    ).toBe("lockingOn");
  });

  it("ignores a flight ending after the kiosk was paused", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(step(paused, { type: "arrived", now: T0 + 1 }, CONFIG)).toBe(paused);
  });
});

describe("step: locking on", () => {
  const lockingOn = (misses: number, recent: string[] = []) =>
    at({ kind: "lockingOn", target: TARGET, since: T0, misses }, recent);

  it("starts the chase once the target is in the feed", () => {
    const state = step(lockingOn(0, ["x"]), tick(T0 + 2_000, IN_FEED), CONFIG);
    expect(state.phase).toEqual({
      kind: "chasing",
      target: TARGET,
      since: T0 + 2_000,
    });
    expect(state.recent).toEqual([TARGET.key, "x"]);
  });

  it("keeps recent picks unique and capped", () => {
    const many = Array.from({ length: RECENT_PICKS }, (_, i) => `k${i}`);
    const state = step(
      lockingOn(0, [...many.slice(0, 3), TARGET.key, ...many.slice(3)]),
      tick(T0 + 2_000, IN_FEED),
      CONFIG,
    );
    expect(state.recent).toHaveLength(RECENT_PICKS);
    expect(state.recent[0]).toBe(TARGET.key);
    expect(state.recent.filter((k) => k === TARGET.key)).toHaveLength(1);
  });

  it("picks again after LOCK_ON_TIMEOUT_MS, counting a miss", () => {
    expect(
      step(lockingOn(0), tick(T0 + LOCK_ON_TIMEOUT_MS - 1), CONFIG),
    ).toEqual(lockingOn(0));
    const state = step(lockingOn(0), tick(T0 + LOCK_ON_TIMEOUT_MS), CONFIG);
    expect(state.phase).toEqual({ kind: "picking", misses: 1 });
    expect(state.recent).toEqual([]);
  });

  it(`waits for a new snapshot after ${MAX_MISSES} misses`, () => {
    const state = step(
      lockingOn(MAX_MISSES - 1),
      tick(T0 + LOCK_ON_TIMEOUT_MS),
      CONFIG,
    );
    expect(state.phase).toEqual({
      kind: "waiting",
      reason: "misses",
      since: T0,
    });
  });
});

describe("step: chasing", () => {
  it("chases for the dwell, then waits for a stop", () => {
    expect(step(CHASING, tick(T0 + CONFIG.dwellMs - 1, IN_FEED), CONFIG)).toBe(
      CHASING,
    );
    expect(
      step(CHASING, tick(T0 + CONFIG.dwellMs, IN_FEED), CONFIG).phase,
    ).toEqual({
      kind: "waitingForStop",
      target: TARGET,
      chaseSince: T0,
      since: T0 + CONFIG.dwellMs,
    });
  });

  it.each([
    ["the vehicle left the feed", NO_WORLD],
    ["the journey ended", { ...IN_FEED, journeyEnded: true }],
    ["it stood still too long", { ...IN_FEED, stillForMs: STATIONARY_MS }],
  ])("moves on early when %s", (_, world) => {
    expect(step(CHASING, tick(T0 + 5_000, world), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
    expect(
      step(WAITING_FOR_STOP, tick(T0 + CONFIG.dwellMs + 5_000, world), CONFIG)
        .phase,
    ).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("keeps chasing a vehicle that has stood still a little less", () => {
    const world = { ...IN_FEED, stillForMs: STATIONARY_MS - 1 };
    expect(step(CHASING, tick(T0 + 5_000, world), CONFIG)).toBe(CHASING);
  });
});

describe("step: waiting for a stop", () => {
  const waitStart = T0 + CONFIG.dwellMs;

  it("moves on at an arrival after the wait began", () => {
    const world = { ...IN_FEED, lastArrivalAt: waitStart + 10_000 };
    expect(
      step(WAITING_FOR_STOP, tick(waitStart + 12_000, world), CONFIG).phase,
    ).toEqual({
      kind: "picking",
      misses: 0,
    });
  });

  it("does not count an arrival from before the wait", () => {
    const world = { ...IN_FEED, lastArrivalAt: waitStart - 1 };
    expect(
      step(WAITING_FOR_STOP, tick(waitStart + 12_000, world), CONFIG),
    ).toBe(WAITING_FOR_STOP);
  });

  it("moves on at the cap with no arrival", () => {
    const cap = T0 + CONFIG.dwellMs + STOP_WAIT_CAP_MS;
    expect(step(WAITING_FOR_STOP, tick(cap - 1, IN_FEED), CONFIG)).toBe(
      WAITING_FOR_STOP,
    );
    expect(step(WAITING_FOR_STOP, tick(cap, IN_FEED), CONFIG).phase.kind).toBe(
      "picking",
    );
  });
});

describe("step: pause and resume", () => {
  const phases: KioskPhase[] = [
    { kind: "waiting", reason: "noSnapshot", since: -Infinity },
    { kind: "picking", misses: 0 },
    { kind: "leaving", target: TARGET, since: T0, misses: 0 },
    { kind: "arriving", target: TARGET, since: T0, misses: 0 },
    { kind: "lockingOn", target: TARGET, since: T0, misses: 0 },
    { kind: "chasing", target: TARGET, since: T0 },
    { kind: "waitingForStop", target: TARGET, chaseSince: T0, since: T0 },
    { kind: "paused", lastInputAt: T0 - 50_000 },
  ];

  it.each(phases.map((p) => [p.kind, p] as const))(
    "pauses on input from %s",
    (_, phase) => {
      expect(
        step(at(phase), { type: "input", now: T0 + 1 }, CONFIG).phase,
      ).toEqual({ kind: "paused", lastInputAt: T0 + 1 });
    },
  );

  it("resumes after the idle period, picking afresh", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(step(paused, tick(T0 + CONFIG.idleMs - 1), CONFIG)).toBe(paused);
    expect(step(paused, tick(T0 + CONFIG.idleMs), CONFIG).phase).toEqual({
      kind: "picking",
      misses: 0,
    });
  });
});

describe("effectsOf", () => {
  const paused: KioskPhase = { kind: "paused", lastInputAt: T0 };
  const picking: KioskPhase = { kind: "picking", misses: 0 };
  const leaving: KioskPhase = {
    kind: "leaving",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const arriving: KioskPhase = {
    kind: "arriving",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const lockingOn: KioskPhase = {
    kind: "lockingOn",
    target: TARGET,
    since: T0,
    misses: 0,
  };
  const chasing: KioskPhase = { kind: "chasing", target: TARGET, since: T0 };

  it("restores the setup on resume", () => {
    expect(effectsOf(paused, picking)).toEqual(["restoreSetup"]);
  });

  it("leaves, flies and chases on the way to a vehicle", () => {
    expect(effectsOf(picking, leaving)).toEqual(["leave"]);
    expect(effectsOf(leaving, arriving)).toEqual(["flyToTarget"]);
    expect(effectsOf(lockingOn, chasing)).toEqual(["startChase"]);
  });

  it("does nothing on pausing, on more input, or without a change", () => {
    expect(effectsOf(chasing, paused)).toEqual([]);
    expect(effectsOf(paused, { kind: "paused", lastInputAt: T0 + 1 })).toEqual(
      [],
    );
    expect(effectsOf(chasing, chasing)).toEqual([]);
  });
});

describe("targetOf", () => {
  it("is the target of a travelling or chasing phase, else null", () => {
    expect(targetOf({ kind: "chasing", target: TARGET, since: T0 })).toBe(
      TARGET,
    );
    expect(targetOf({ kind: "picking", misses: 0 })).toBeNull();
    expect(targetOf({ kind: "paused", lastInputAt: T0 })).toBeNull();
  });
});

describe("kioskView", () => {
  it("counts down to resuming", () => {
    const paused = at({ kind: "paused", lastInputAt: T0 });
    expect(kioskView(paused, T0 + 15_000, CONFIG)).toEqual({
      kind: "paused",
      resumesInMs: 105_000,
    });
    expect(kioskView(paused, T0 + 999_999, CONFIG)).toEqual({
      kind: "paused",
      resumesInMs: 0,
    });
  });

  it("names why it is waiting", () => {
    const view = (reason: "noSnapshot" | "noMatch" | "misses") =>
      kioskView(at({ kind: "waiting", reason, since: T0 }), T0, CONFIG);
    expect(view("noMatch")).toEqual({
      kind: "message",
      text: "No vehicles match this filter right now",
    });
    expect(view("noSnapshot")).toEqual({
      kind: "message",
      text: "Waiting for vehicles…",
    });
    expect(view("misses")).toEqual({
      kind: "message",
      text: "Waiting for vehicles…",
    });
  });

  it("shows the next vehicle while travelling", () => {
    expect(
      kioskView(
        at({ kind: "arriving", target: TARGET, since: T0, misses: 0 }),
        T0,
        CONFIG,
      ),
    ).toEqual({ kind: "travelling", target: TARGET });
  });

  it("reports progress through the dwell, full while waiting for a stop", () => {
    expect(kioskView(CHASING, T0 + 90_000, CONFIG)).toEqual({
      kind: "chasing",
      target: TARGET,
      progress: 0.5,
      waitingForStop: false,
    });
    expect(kioskView(WAITING_FOR_STOP, T0 + 200_000, CONFIG)).toEqual({
      kind: "chasing",
      target: TARGET,
      progress: 1,
      waitingForStop: true,
    });
  });
});

describe("formatCountdown", () => {
  it("is minutes and seconds, rounded up", () => {
    expect(formatCountdown(105_000)).toBe("1:45");
    expect(formatCountdown(59_001)).toBe("1:00");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("restoredFilter", () => {
  const box = [
    [10, 63],
    [11, 64],
  ];

  it("leaves a filter not yet set alone", () => {
    expect(restoredFilter(null, { codespaceId: "ATB" })).toBeNull();
  });

  it("puts back the kiosk's codespace and keeps the viewport", () => {
    const prev: Filter = {
      boundingBox: box,
      codespaceId: "RUT",
      operatorRef: "RUT:Operator:1",
    };
    expect(restoredFilter(prev, { codespaceId: "ATB" })).toEqual({
      boundingBox: box,
      codespaceId: "ATB",
    });
  });

  it("returns the same filter when the visitor changed nothing", () => {
    const prev: Filter = { boundingBox: box, codespaceId: "ATB" };
    expect(restoredFilter(prev, { codespaceId: "ATB" })).toBe(prev);
  });
});
