import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANIMATION_IDLE_MS } from "../../domain/animationAmount.ts";
import { burstDurationS } from "../../domain/fireworks.ts";
import {
  BARRAGE,
  BARRAGE_INTERVAL_MS,
  slotAt,
  slotEndMs,
} from "../../domain/fireworkSchedule.ts";
import { FireworksClock } from "./fireworksClock.ts";
import type { LaunchView } from "./fireworkShow.ts";

vi.mock("../../domain/fireworkSchedule.ts", async (original) => {
  const actual =
    await original<typeof import("../../domain/fireworkSchedule.ts")>();
  return { ...actual, slotAt: vi.fn(actual.slotAt) };
});

type Listener = () => void;

class FakeMap {
  repaints = 0;
  private listeners = new Map<string, Set<Listener>>();
  on(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  off(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  triggerRepaint() {
    this.repaints++;
  }
  emit(type: string) {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

// A mid-day slot start that is not a finale.
const SLOT = Date.UTC(2026, 11, 28, 10, 0, 0);
const BURST_MS = burstDurationS() * 1000;

describe("FireworksClock", () => {
  let map: FakeMap;
  let nowMs: number;
  let visible: boolean;
  let busy: boolean;
  let scatteredDue: number | null;
  let frames: Map<number, () => void>;
  let nextId: number;
  let timers: Map<number, { cb: () => void; ms: number }>;
  let frameNows: number[];
  let barrages: number[];
  let updates: boolean[];
  let cancelled: number[];
  let viewCalls: number;
  let viewsHanded: unknown[];
  let onBarrage: (untilMs: number) => void;

  beforeEach(() => {
    map = new FakeMap();
    nowMs = SLOT + 30_000;
    visible = true;
    busy = false;
    scatteredDue = null;
    frames = new Map();
    timers = new Map();
    nextId = 1;
    frameNows = [];
    barrages = [];
    updates = [];
    cancelled = [];
    viewCalls = 0;
    viewsHanded = [];
    onBarrage = (u) => barrages.push(u);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function make(reducedMotion = false, lastActivityMs?: number) {
    return new FireworksClock(map as never, {
      reducedMotion,
      show: {
        update: (_n, v, scattering) => {
          viewsHanded.push(v);
          updates.push(scattering);
          return false;
        },
        busy: () => busy,
        scatteredDueMs: () => scatteredDue,
      },
      view: (): LaunchView => {
        viewCalls++;
        return {
          pointAt: () => [0, 0],
          groundAt: () => 0,
          centreGroundM: 0,
        };
      },
      onFrame: (n) => frameNows.push(n),
      onBarrage: (u) => onBarrage(u),
      lastActivityMs,
      now: () => nowMs,
      isVisible: () => visible,
      requestFrame: (cb) => {
        const id = nextId++;
        frames.set(id, cb);
        return id;
      },
      cancelFrame: (id) => {
        cancelled.push(id);
        frames.delete(id);
      },
      setTimer: (cb, ms) => {
        const id = nextId++;
        timers.set(id, { cb, ms });
        return id;
      },
      clearTimer: (t) => {
        timers.delete(t as number);
      },
    });
  }

  /** Run the pending frame at `at`. */
  function frame(at: number) {
    nowMs = at;
    const [id, cb] = [...frames][0];
    frames.delete(id);
    cb();
  }

  function fireTimer() {
    const [id, t] = [...timers][0];
    timers.delete(id);
    nowMs += t.ms;
    t.cb();
  }

  it("requests a frame every frame while active", () => {
    make();
    for (let i = 1; i <= 5; i++) {
      expect(frames.size).toBe(1);
      frame(nowMs + 16);
    }
    expect(frameNows.length).toBe(5);
    expect(frameNows[4]).toBe(SLOT + 30_000 + 80);
    expect(updates.every((s) => s)).toBe(true);
    expect(map.repaints).toBe(5);
  });

  it("sleeps until the next scattered rocket while active and quiet", () => {
    make();
    scatteredDue = nowMs + 3_000;
    frame(nowMs + 16);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(1);
    expect([...timers.values()][0].ms).toBe(3_000 - 16);
    const repaints = map.repaints;

    fireTimer();
    expect(nowMs).toBe(scatteredDue);
    expect(frames.size).toBe(1);
    expect(map.repaints).toBe(repaints);
    // The frame that launches it, then frames while it is in the air.
    busy = true;
    frame(nowMs);
    expect(frames.size).toBe(1);
  });

  it("wakes for the next slot before a later scattered rocket", () => {
    nowMs = SLOT + BARRAGE_INTERVAL_MS - 1_000;
    make();
    scatteredDue = nowMs + 3_000;
    frame(nowMs + 16);
    expect([...timers.values()][0].ms).toBe(1_000 - 16);
  });

  it("runs frames while a scattered rocket is overdue", () => {
    make();
    scatteredDue = nowMs;
    frame(nowMs + 16);
    expect(frames.size).toBe(1);
    expect(timers.size).toBe(0);
  });

  it("requests no frame between barrages when idle", () => {
    nowMs = SLOT + 120_000;
    make(false, nowMs - ANIMATION_IDLE_MS - 1);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(1);
    expect([...timers.values()][0].ms).toBe(SLOT + BARRAGE_INTERVAL_MS - nowMs);
    expect(barrages).toEqual([]);

    fireTimer();
    expect(nowMs).toBe(SLOT + BARRAGE_INTERVAL_MS);
    const end = slotEndMs(slotAt(nowMs));
    expect(end).toBe(nowMs + BARRAGE.durationMs);
    expect(barrages).toEqual([end + BURST_MS]);
    expect(frames.size).toBe(1);

    frame(nowMs + 16);
    expect(updates).toEqual([false]);
    expect(barrages.length).toBe(1);
    // Within the slot frames carry on.
    frame(nowMs + 5_000);
    expect(frames.size).toBe(1);
    // Past the slot, sparks still in the air.
    busy = true;
    frame(end + 1);
    expect(frames.size).toBe(1);
    busy = false;
    frame(end + 2_000);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(1);
    expect([...timers.values()][0].ms).toBe(
      SLOT + 2 * BARRAGE_INTERVAL_MS - (end + 2_000),
    );
    expect(barrages.length).toBe(1);
  });

  it("announces a slot once, also on an active screen", () => {
    nowMs = SLOT + 2_000;
    make();
    frame(nowMs + 16);
    frame(nowMs + 32);
    expect(barrages).toEqual([SLOT + BARRAGE.durationMs + BURST_MS]);
  });

  it("does not announce a slot whose launches are all past", () => {
    make();
    frame(nowMs + 16);
    expect(barrages).toEqual([]);
  });

  it("restarts on a map move and on activity()", () => {
    nowMs = SLOT + 120_000;
    const clock = make(false, nowMs - ANIMATION_IDLE_MS - 1);
    expect(frames.size).toBe(0);
    map.emit("move");
    expect(frames.size).toBe(1);
    expect(timers.size).toBe(0);
    frame(nowMs + 16);
    expect(updates).toEqual([true]);

    // Sleep again once idle, then wake with activity().
    frame(nowMs + ANIMATION_IDLE_MS + 1);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(1);
    clock.activity();
    expect(frames.size).toBe(1);
    expect(timers.size).toBe(0);
    clock.activity();
    expect(frames.size).toBe(1);
  });

  it("stops on a hidden page and resumes on activity()", () => {
    const clock = make();
    visible = false;
    frame(nowMs + 16);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(0);
    expect(frameNows.length).toBe(0);
    visible = true;
    clock.activity();
    expect(frames.size).toBe(1);
  });

  it("does nothing under reduced motion", () => {
    const clock = make(true);
    clock.activity();
    map.emit("move");
    expect(map.count("move")).toBe(0);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(0);
    expect(nextId).toBe(1);
  });

  it("cancels its frame and timer on dispose", () => {
    const clock = make();
    expect(frames.size).toBe(1);
    clock.dispose();
    expect(frames.size).toBe(0);
    expect(cancelled.length).toBe(1);
    expect(map.count("move")).toBe(0);

    frames.clear();
    nowMs = SLOT + 120_000;
    const idle = make(false, nowMs - ANIMATION_IDLE_MS - 1);
    expect(timers.size).toBe(1);
    idle.dispose();
    expect(timers.size).toBe(0);
    map.emit("move");
    idle.activity();
    expect(frames.size).toBe(0);
  });

  it("never holds more than one timer", () => {
    nowMs = SLOT + 120_000;
    const clock = make(false, nowMs - ANIMATION_IDLE_MS - 1);
    clock.activity();
    frame(nowMs + ANIMATION_IDLE_MS + 1);
    expect(timers.size).toBe(1);
  });

  it("hands the show the view to ask for, and never reads it itself", () => {
    make();
    frame(nowMs + 16);
    frame(nowMs + 16);
    expect(viewsHanded).toHaveLength(2);
    expect(viewsHanded.every((v) => typeof v === "function")).toBe(true);
    expect(viewCalls).toBe(0);
  });

  it("keeps an idle screen's barrages coming when onBarrage throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    onBarrage = () => {
      throw new Error("lights");
    };
    nowMs = SLOT + 120_000;
    make(false, nowMs - ANIMATION_IDLE_MS - 1);
    fireTimer();
    expect(frames.size).toBe(1);
    frame(nowMs + 16);
    expect(frameNows).toHaveLength(1);
    expect(frames.size).toBe(1);
    // The next slot, also failing, is logged no more.
    frame(nowMs + BARRAGE_INTERVAL_MS);
    expect(frames.size).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("keeps running when looking the slot up throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    make();
    vi.mocked(slotAt).mockImplementationOnce(() => {
      throw new Error("Intl");
    });
    frame(SLOT + BARRAGE_INTERVAL_MS + 16);
    expect(frameNows).toHaveLength(1);
    expect(frames.size).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
