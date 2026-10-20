import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TWINKLE_IDLE_MS, TWINKLE_SETTLE_MS } from "../../domain/twinkle.ts";
import { TWINKLE_TICK_MS, TwinkleClock, TwinkleState } from "./twinkleClock.ts";

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

describe("TwinkleClock", () => {
  let map: FakeMap;
  let ticks: TwinkleState[];
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

  function make(reducedMotion = false) {
    return new TwinkleClock(map as never, {
      reducedMotion,
      onTick: (s) => ticks.push(s),
      now: () => Date.now(),
      isVisible: () => visible,
    });
  }

  it("ticks and repaints while active", () => {
    make();
    vi.advanceTimersByTime(TWINKLE_TICK_MS * 10);
    expect(ticks.length).toBe(10);
    expect(map.repaints).toBe(10);
    expect(ticks.every((t) => t.amount === 1)).toBe(true);
    expect(ticks[9].timeS).toBeGreaterThan(ticks[0].timeS);
  });

  it("stops after idle and settle, with a last tick at amount 0", () => {
    const clock = make();
    vi.advanceTimersByTime(TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS + 200);
    expect(ticks[ticks.length - 1].amount).toBe(0);
    expect(clock.current().amount).toBe(0);
    const repaints = map.repaints;
    const n = ticks.length;
    vi.advanceTimersByTime(10_000);
    expect(map.repaints).toBe(repaints);
    expect(ticks.length).toBe(n);
  });

  it("restarts on a map move", () => {
    const clock = make();
    vi.advanceTimersByTime(TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS + 200);
    const n = ticks.length;
    map.emit("move");
    expect(clock.current().amount).toBe(1);
    vi.advanceTimersByTime(TWINKLE_TICK_MS * 3);
    expect(ticks.length).toBe(n + 3);
    expect(ticks[ticks.length - 1].amount).toBe(1);
  });

  it("restarts on activity()", () => {
    const clock = make();
    vi.advanceTimersByTime(TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS + 200);
    const n = ticks.length;
    clock.activity();
    vi.advanceTimersByTime(TWINKLE_TICK_MS * 2);
    expect(ticks.length).toBe(n + 2);
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

  it("does not tick while the page is hidden", () => {
    visible = false;
    make();
    vi.advanceTimersByTime(5_000);
    expect(ticks.length).toBe(0);
    expect(map.repaints).toBe(0);
    visible = true;
    vi.advanceTimersByTime(TWINKLE_TICK_MS * 2);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("does not tick after dispose and removes its listener", () => {
    const clock = make();
    vi.advanceTimersByTime(TWINKLE_TICK_MS * 2);
    clock.dispose();
    const n = ticks.length;
    expect(map.count("move")).toBe(0);
    map.emit("move");
    clock.activity();
    vi.advanceTimersByTime(5_000);
    expect(ticks.length).toBe(n);
  });
});
