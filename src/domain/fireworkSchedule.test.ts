import { describe, expect, it } from "vitest";
import {
  BURST_HEIGHT_M,
  LAUNCH_INSET,
  groundFor,
  launchPoint,
  nextSlotStartMs,
  scatteredDelayMs,
  scatteredLaunch,
  slotAt,
  slotEndMs,
  slotLaunches,
} from "./fireworkSchedule.ts";

describe("slotAt", () => {
  it("floors to five minutes", () => {
    const s = slotAt(Date.parse("2026-12-28T14:07:30+01:00"));
    expect(s.startMs).toBe(Date.parse("2026-12-28T14:05:00+01:00"));
    expect(s.finale).toBe(false);
  });
  it("marks 00:00 on 1 January in Oslo as the finale", () => {
    expect(slotAt(Date.parse("2026-12-31T23:00:00Z")).finale).toBe(true);
    expect(slotAt(Date.parse("2027-01-01T00:00:00Z")).finale).toBe(false);
    expect(slotAt(Date.parse("2026-12-31T22:55:00Z")).finale).toBe(false);
  });
});

describe("nextSlotStartMs", () => {
  it("is strictly after", () => {
    const start = Date.parse("2026-12-28T14:05:00+01:00");
    expect(nextSlotStartMs(start)).toBe(start + 300_000);
    expect(nextSlotStartMs(start + 1234)).toBe(start + 300_000);
  });
});

describe("slotEndMs", () => {
  it("lasts 10 s, or 60 s for the finale", () => {
    expect(slotEndMs({ startMs: 1000, finale: false })).toBe(11_000);
    expect(slotEndMs({ startMs: 1000, finale: true })).toBe(61_000);
  });
});

describe("slotLaunches", () => {
  const slot = {
    startMs: Date.parse("2026-12-28T14:05:00+01:00"),
    finale: false,
  };
  it("has 24 rockets, or 72 for the finale", () => {
    expect(slotLaunches(slot)).toHaveLength(24);
    expect(slotLaunches({ ...slot, finale: true })).toHaveLength(72);
  });
  it("is sorted and within the slot, inset and height range", () => {
    for (const s of [slot, { ...slot, finale: true }]) {
      const launches = slotLaunches(s);
      for (let i = 0; i < launches.length; i++) {
        const l = launches[i];
        if (i > 0) expect(l.atMs).toBeGreaterThanOrEqual(launches[i - 1].atMs);
        expect(l.atMs).toBeGreaterThanOrEqual(s.startMs);
        expect(l.atMs).toBeLessThan(slotEndMs(s));
        for (const f of [l.fx, l.fy]) {
          expect(f).toBeGreaterThanOrEqual(LAUNCH_INSET);
          expect(f).toBeLessThanOrEqual(1 - LAUNCH_INSET);
        }
        expect(l.heightM).toBeGreaterThanOrEqual(BURST_HEIGHT_M[0]);
        expect(l.heightM).toBeLessThanOrEqual(BURST_HEIGHT_M[1]);
      }
    }
  });
  it("is deterministic per slot", () => {
    expect(slotLaunches(slot)).toEqual(slotLaunches({ ...slot }));
    expect(slotLaunches(slot)).not.toEqual(
      slotLaunches({ startMs: slot.startMs + 300_000, finale: false }),
    );
  });
});

describe("scattered rockets", () => {
  it("delays 2-4 s", () => {
    expect(scatteredDelayMs(() => 0)).toBe(2000);
    const late = scatteredDelayMs(() => 0.9999999);
    expect(late).toBeLessThan(4000);
    expect(late).toBeGreaterThan(3999);
  });
  it("launches now, inside the inset", () => {
    let n = 0.1;
    const l = scatteredLaunch(5000, () => (n = (n + 0.37) % 1));
    expect(l.atMs).toBe(5000);
    expect(l.fx).toBeGreaterThanOrEqual(LAUNCH_INSET);
    expect(l.colours[0]).not.toEqual(l.colours[1]);
  });
});

describe("launchPoint", () => {
  it("is linear", () => {
    expect(
      launchPoint(
        [
          [10, 59],
          [11, 60],
        ],
        0.5,
        0.25,
      ),
    ).toEqual([10.5, 59.25]);
  });
});

describe("groundFor", () => {
  it("falls back to the centre's height", () => {
    expect(groundFor(120, 5)).toBe(120);
    expect(groundFor(0, 80)).toBe(80);
    expect(groundFor(null, 80)).toBe(80);
    expect(groundFor(null, null)).toBe(0);
    expect(groundFor(0, 0)).toBe(0);
    expect(groundFor(-3, 10)).toBe(10);
  });
});
