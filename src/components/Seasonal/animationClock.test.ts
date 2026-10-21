import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANIMATION_IDLE_MS,
  ANIMATION_SETTLE_MS,
} from "../../domain/animationAmount.ts";
import {
  ANIMATION_TICK_MS,
  AnimationClock,
  AnimationState,
} from "./animationClock.ts";

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

describe("AnimationClock", () => {
  let map: FakeMap;
  let ticks: AnimationState[];
  let visible: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    map = new FakeMap();
    ticks = [];
    visible = true;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make(
    reducedMotion = false,
    since: { startMs?: number; lastActivityMs?: number } = {},
  ) {
    return new AnimationClock(map as never, {
      reducedMotion,
      onTick: (s) => ticks.push(s),
      now: () => Date.now(),
      isVisible: () => visible,
      ...since,
    });
  }

  it("ticks and repaints while active", () => {
    make();
    vi.advanceTimersByTime(ANIMATION_TICK_MS * 10);
    expect(ticks.length).toBe(10);
    expect(map.repaints).toBe(10);
    expect(ticks.every((t) => t.amount === 1)).toBe(true);
    expect(ticks[9].timeS).toBeGreaterThan(ticks[0].timeS);
  });

  it("stops after idle and settle, with a last tick at amount 0", () => {
    const clock = make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS + 200);
    expect(ticks[ticks.length - 1].amount).toBe(0);
    expect(clock.current().amount).toBe(0);
    const repaints = map.repaints;
    const n = ticks.length;
    vi.advanceTimersByTime(10_000);
    expect(map.repaints).toBe(repaints);
    expect(ticks.length).toBe(n);
  });

  it("restarts on a map move", () => {
    make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS + 200);
    const n = ticks.length;
    map.emit("move");
    vi.advanceTimersByTime(ANIMATION_TICK_MS * 3);
    expect(ticks.length).toBe(n + 3);
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("restarts on activity()", () => {
    const clock = make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS + 200);
    const n = ticks.length;
    clock.activity();
    vi.advanceTimersByTime(ANIMATION_TICK_MS * 2);
    expect(ticks.length).toBeGreaterThanOrEqual(n + 2);
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS);
    expect(clock.current().amount).toBe(1);
  });

  /** The largest change in amount between consecutive ticks from `from`. */
  const largestAmountStep = (from: number) =>
    ticks
      .slice(from)
      .reduce(
        (m, t, i, a) =>
          i ? Math.max(m, Math.abs(t.amount - a[i - 1].amount)) : m,
        0,
      );

  it("eases the lights back in when activity wakes it from idle", () => {
    const clock = make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS + 200);
    const n = ticks.length;
    expect(ticks[n - 1].amount).toBe(0);
    clock.activity();
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS + ANIMATION_TICK_MS * 2);
    expect(ticks[n].amount).toBeLessThan(0.1);
    expect(largestAmountStep(n - 1)).toBeLessThanOrEqual(0.13);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("eases back up from where it was when a move comes mid-settle", () => {
    make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS / 2);
    const n = ticks.length;
    const before = ticks[n - 1].amount;
    expect(before).toBeGreaterThan(0.2);
    expect(before).toBeLessThan(0.8);
    map.emit("move");
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS + ANIMATION_TICK_MS * 2);
    expect(Math.abs(ticks[n].amount - before)).toBeLessThan(0.13);
    expect(largestAmountStep(n - 1)).toBeLessThanOrEqual(0.13);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("is not held back by moves every frame while easing in", () => {
    make();
    vi.advanceTimersByTime(ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS + 200);
    for (let i = 0; i < (ANIMATION_SETTLE_MS / 16) * 1.2; i++) {
      map.emit("move");
      vi.advanceTimersByTime(16);
    }
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("does nothing under reduced motion", () => {
    const clock = make(true);
    clock.activity();
    map.emit("move");
    vi.advanceTimersByTime(5_000);
    expect(ticks.length).toBe(0);
    expect(map.repaints).toBe(0);
    expect(clock.current()).toEqual({ timeS: 0, amount: 0 });
  });

  it("stops its timer on a hidden page and resumes on activity", () => {
    visible = false;
    const clock = make();
    vi.advanceTimersByTime(5_000);
    expect(ticks.length).toBe(0);
    expect(map.repaints).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    visible = true;
    clock.activity();
    vi.advanceTimersByTime(ANIMATION_TICK_MS * 2);
    expect(ticks.length).toBe(2);
  });

  it("starts settled when the last activity was before the idle time", () => {
    const clock = make(false, {
      lastActivityMs: Date.now() - ANIMATION_IDLE_MS - ANIMATION_SETTLE_MS - 1,
    });
    expect(clock.current().amount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(ticks.length).toBe(0);
    expect(map.repaints).toBe(0);
  });

  it("wakes a clock that started settled with the usual ease", () => {
    const clock = make(false, {
      lastActivityMs: Date.now() - ANIMATION_IDLE_MS - ANIMATION_SETTLE_MS - 1,
    });
    clock.activity();
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS + ANIMATION_TICK_MS * 2);
    expect(ticks[0].amount).toBeLessThan(0.1);
    expect(largestAmountStep(0)).toBeLessThanOrEqual(0.13);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("wakes a clock that started settled on a map move", () => {
    make(false, {
      lastActivityMs: Date.now() - ANIMATION_IDLE_MS - ANIMATION_SETTLE_MS - 1,
    });
    map.emit("move");
    vi.advanceTimersByTime(ANIMATION_SETTLE_MS + ANIMATION_TICK_MS * 2);
    expect(ticks[0].amount).toBeLessThan(0.1);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("continues from an earlier activity and start", () => {
    const startMs = Date.now() - 50_000;
    const clock = make(false, { startMs, lastActivityMs: startMs + 10_000 });
    expect(clock.current()).toEqual({ timeS: 50, amount: 1 });
    // Settles 60 s after that activity, 20 s from now, not 60 s from now.
    vi.advanceTimersByTime(20_000 + ANIMATION_SETTLE_MS + 200);
    expect(ticks[ticks.length - 1].amount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not tick after dispose and removes its listener", () => {
    const clock = make();
    vi.advanceTimersByTime(ANIMATION_TICK_MS * 2);
    clock.dispose();
    const n = ticks.length;
    expect(map.count("move")).toBe(0);
    map.emit("move");
    clock.activity();
    vi.advanceTimersByTime(5_000);
    expect(ticks.length).toBe(n);
  });
});
