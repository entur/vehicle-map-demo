import { describe, expect, it, vi } from "vitest";
import { burstDurationS } from "../../domain/fireworks.ts";
import { slotAt, slotLaunches } from "../../domain/fireworkSchedule.ts";
import {
  BURST_SPARKS,
  type Burst,
  FireworkShow,
  LAUNCH_GRACE_MS,
  type LaunchView,
} from "./fireworkShow.ts";

vi.mock("../../domain/fireworkSchedule.ts", async (original) => {
  const actual =
    await original<typeof import("../../domain/fireworkSchedule.ts")>();
  return { ...actual, slotAt: vi.fn(actual.slotAt) };
});

const pointAt = (fx: number, fy: number): [number, number] => [
  10 + fx,
  59 + fy,
];
const launchView: LaunchView = {
  pointAt,
  groundAt: () => 100,
  centreGroundM: 100,
};
const view = () => launchView;
// A plain barrage slot and the 00:00 finale slot of 1 January 2027, Oslo.
const BARRAGE_START = Date.UTC(2026, 11, 28, 12, 0);
const FINALE_START = Date.UTC(2026, 11, 31, 23, 0);

/** Steps the show and returns every burst that was ever in the air. */
function run(
  show: FireworkShow,
  from: number,
  durationMs: number,
  scattering = false,
  stepMs = 100,
  v: () => LaunchView = view,
): Burst[] {
  const seen = new Map<string, Burst>();
  for (let t = from; t < from + durationMs; t += stepMs) {
    show.update(t, v, scattering);
    for (const b of show.bursts()) seen.set(b.key, b);
  }
  return [...seen.values()];
}

describe("FireworkShow", () => {
  it("fires a barrage's rockets in order at their launch points", () => {
    const show = new FireworkShow(() => 0);
    const fired = run(show, BARRAGE_START, 10_000);
    const launches = slotLaunches(slotAt(BARRAGE_START));
    expect(fired).toHaveLength(24);
    fired.forEach((b, i) => {
      const l = launches[i];
      expect(b.key).toBe(`slot:${BARRAGE_START}:${i}`);
      expect(b.launchMs).toBe(l.atMs);
      expect(b.position.slice(0, 2)).toEqual(pointAt(l.fx, l.fy));
      expect(b.sparks).toHaveLength(BURST_SPARKS);
    });
  });

  it("fires 72 rockets in the finale", () => {
    expect(slotAt(FINALE_START).finale).toBe(true);
    const show = new FireworkShow(() => 0);
    expect(run(show, FINALE_START, 60_000)).toHaveLength(72);
  });

  it("skips launches older than LAUNCH_GRACE_MS", () => {
    const show = new FireworkShow(() => 0);
    const now = BARRAGE_START + 4_000;
    show.update(now, view, false);
    const firstBursts = [...show.bursts()];
    const launches = slotLaunches(slotAt(now));
    const due = launches.filter(
      (l) => l.atMs <= now && now - l.atMs <= LAUNCH_GRACE_MS,
    );
    expect(firstBursts).toHaveLength(due.length);
    const rest = run(show, now + 100, 10_000);
    const later = launches.filter((l) => l.atMs > now).length;
    expect(rest.filter((b) => b.launchMs <= now)).toHaveLength(0);
    expect(rest).toHaveLength(later);
    expect(later + due.length).toBeLessThan(24);
  });

  it("fires a launch once however many updates follow", () => {
    const show = new FireworkShow(() => 0);
    const fired = run(show, BARRAGE_START, 10_000, false, 10);
    expect(fired).toHaveLength(24);
  });

  it("scatters a rocket every 2 s while scattering, none otherwise", () => {
    const start = BARRAGE_START + 60_000;
    const show = new FireworkShow(() => 0);
    // First after one delay (2 s), then every 2 s: 2, 4, 6, 8 s.
    expect(run(show, start, 10_000, true).map((b) => b.launchMs)).toEqual([
      start + 2_000,
      start + 4_000,
      start + 6_000,
      start + 8_000,
    ]);
    const off = new FireworkShow(() => 0);
    expect(run(off, start, 10_000, false)).toHaveLength(0);
  });

  it("lets bursts in the air finish when scattering stops", () => {
    const start = BARRAGE_START + 60_000;
    const show = new FireworkShow(() => 0);
    run(show, start, 3_000, true);
    expect(show.bursts()).toHaveLength(1);
    run(show, start + 3_000, 10_000, false);
    expect(show.bursts()).toHaveLength(0);
  });

  it("keeps bursts() identical between changes and drops faded bursts", () => {
    const start = BARRAGE_START + 60_000;
    const show = new FireworkShow(() => 0);
    run(show, start, 2_100, true);
    const first = show.bursts();
    expect(first).toHaveLength(1);
    expect(show.update(start + 2_200, view, false)).toBe(false);
    expect(show.bursts()).toBe(first);
    const gone = start + 2_000 + burstDurationS() * 1000 + 1_000;
    run(show, start + 2_300, gone - start, false);
    expect(show.bursts()).not.toBe(first);
    expect(show.bursts()).toHaveLength(0);
  });

  it("is busy mid-barrage and while sparks fade, then not", () => {
    const show = new FireworkShow(() => 0);
    expect(show.busy(BARRAGE_START)).toBe(true);
    run(show, BARRAGE_START, 5_000);
    expect(show.busy(BARRAGE_START + 5_000)).toBe(true);
    run(show, BARRAGE_START + 5_000, 5_000);
    const lastLaunch = Math.max(...show.bursts().map((b) => b.launchMs), 0);
    expect(show.busy(BARRAGE_START + 10_000)).toBe(true);
    const quiet =
      Math.max(lastLaunch, BARRAGE_START) + burstDurationS() * 1000 + 1;
    expect(show.busy(Math.max(quiet, BARRAGE_START + 10_000))).toBe(false);
    expect(show.busy(BARRAGE_START + 100_000)).toBe(false);
  });

  it("times the next scattered rocket while scattering, and forgets it after", () => {
    const show = new FireworkShow(() => 0);
    const quiet = BARRAGE_START + 120_000;
    expect(show.scatteredDueMs()).toBeNull();
    show.update(quiet, view, true);
    // `() => 0` draws the shortest delay.
    expect(show.scatteredDueMs()).toBe(quiet + 2_000);
    expect(show.inAir(quiet)).toBe(0);
    show.update(quiet + 2_000, view, true);
    expect(show.inAir(quiet + 2_000)).toBe(1);
    expect(show.scatteredDueMs()).toBe(quiet + 4_000);
    expect(show.inAir(quiet + 2_000 + burstDurationS() * 1000)).toBe(0);
    show.update(quiet + 3_000, view, false);
    expect(show.scatteredDueMs()).toBeNull();
  });

  it("bursts above the ground, falling back to the centre's", () => {
    const show = new FireworkShow(() => 0);
    const flat: LaunchView = {
      ...launchView,
      groundAt: () => null,
      centreGroundM: 250,
    };
    const b = run(show, BARRAGE_START, 10_000, false, 100, () => flat)[0];
    expect(b.position[2]).toBe(250 + b.heightM);
  });

  it("asks for the view only on an update that launches, and once", () => {
    const show = new FireworkShow(() => 0);
    const spy = vi.fn(view);
    const launches = slotLaunches(slotAt(BARRAGE_START));
    let launching = 0;
    for (let t = BARRAGE_START; t < BARRAGE_START + 20_000; t += 100) {
      const calls = spy.mock.calls.length;
      show.update(t, spy, false);
      const launched = launches.some((l) => l.atMs > t - 100 && l.atMs <= t);
      if (launched) launching++;
      expect(spy.mock.calls.length - calls).toBe(launched ? 1 : 0);
    }
    expect(spy).toHaveBeenCalledTimes(launching);
    expect(launching).toBeLessThan(200);
  });

  it("does not ask for the view while waiting to scatter", () => {
    const start = BARRAGE_START + 60_000;
    const show = new FireworkShow(() => 0);
    const spy = vi.fn(view);
    for (let t = start; t < start + 1_900; t += 100) show.update(t, spy, true);
    expect(spy).not.toHaveBeenCalled();
    show.update(start + 2_000, spy, true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("looks the slot up once per slot, not per update or busy call", () => {
    const show = new FireworkShow(() => 0);
    vi.mocked(slotAt).mockClear();
    for (let t = BARRAGE_START; t < BARRAGE_START + 20_000; t += 100) {
      show.update(t, view, false);
      show.busy(t);
    }
    expect(slotAt).toHaveBeenCalledTimes(1);
  });
});
