import { describe, expect, it } from "vitest";
import {
  CHASE_BOX_HALF_SIZE_DEG,
  ChaseSample,
  FAST_INTERVAL_MS,
  addSample,
  advancePlaybackTime,
  bearingBetween,
  cadenceOf,
  chaseBoundingBox,
  chaseTarget,
  positionAt,
  smoothAngle,
} from "./chaseCamera.ts";

const OSLO = { lon: 10.75, lat: 59.91 };
/** Roughly 11 m north of Oslo per step. */
const STEP_NORTH = 0.0001;

function sample(
  received: number,
  step: number,
  overrides: Partial<ChaseSample> = {},
): ChaseSample {
  return {
    received,
    lastUpdated: `t${step}`,
    lon: OSLO.lon,
    lat: OSLO.lat + step * STEP_NORTH,
    bearing: null,
    ...overrides,
  };
}

function samplesEvery(intervalMs: number, count: number) {
  return Array.from({ length: count }, (_, i) =>
    sample(1_000_000 + i * intervalMs, i),
  );
}

describe("addSample", () => {
  it("appends a sample whose position or timestamp changed", () => {
    const a = sample(0, 0);
    const b = sample(1000, 1);
    expect(addSample(addSample([], a), b)).toEqual([a, b]);
  });

  it("ignores a redelivery of the same report", () => {
    // A re-opened subscription replays its snapshot, repeating the last report.
    const a = sample(0, 0);
    expect(addSample([a], { ...a, received: 5000 })).toEqual([a]);
  });

  it("keeps a report whose timestamp is unchanged but whose position moved", () => {
    // lastUpdated has one-second resolution; a 1 s publisher can repeat it.
    const a = sample(0, 0);
    const b = sample(500, 1, { lastUpdated: a.lastUpdated });
    expect(addSample([a], b)).toHaveLength(2);
  });

  it("drops the oldest samples beyond the limit", () => {
    const samples = samplesEvery(1000, 5).reduce<ChaseSample[]>(
      (acc, s) => addSample(acc, s, 3),
      [],
    );
    expect(samples.map((s) => s.lastUpdated)).toEqual(["t2", "t3", "t4"]);
  });
});

describe("cadenceOf", () => {
  it("is unknown until two intervals have been seen", () => {
    expect(cadenceOf(samplesEvery(1000, 2))).toBeNull();
  });

  it("classifies a 1 s publisher as fast", () => {
    const cadence = cadenceOf(samplesEvery(1000, 6))!;
    expect(cadence.fast).toBe(true);
    expect(cadence.medianIntervalMs).toBe(1000);
  });

  it("classifies a 20 s publisher as slow", () => {
    expect(cadenceOf(samplesEvery(20_000, 6))!.fast).toBe(false);
  });

  it("uses the median, so one late report does not demote a fast vehicle", () => {
    const samples = samplesEvery(1000, 6);
    samples[5] = { ...samples[5], received: samples[4].received + 30_000 };
    expect(cadenceOf(samples)!.fast).toBe(true);
  });

  it("delays playback by at least the longest recent interval", () => {
    // Otherwise playback reaches the newest report before the next arrives.
    const samples = [0, 1000, 2500, 3500].map((t, i) => sample(t, i));
    const cadence = cadenceOf(samples)!;
    expect(cadence.playbackDelayMs).toBeGreaterThanOrEqual(1500);
    expect(cadence.playbackDelayMs).toBeLessThanOrEqual(FAST_INTERVAL_MS);
  });
});

describe("positionAt", () => {
  const samples = samplesEvery(1000, 3);
  const [first, , last] = samples;

  it("interpolates linearly between the bracketing reports", () => {
    const p = positionAt(samples, first.received + 500)!;
    expect(p.lat).toBeCloseTo(OSLO.lat + 0.5 * STEP_NORTH, 9);
    expect(p.clamped).toBe(false);
  });

  it("derives the heading from the direction of travel", () => {
    expect(positionAt(samples, first.received + 500)!.heading).toBeCloseTo(
      0,
      3,
    );
  });

  it("holds at the newest report when playback runs past it", () => {
    const p = positionAt(samples, last.received + 10_000)!;
    expect(p.lat).toBe(last.lat);
    expect(p.clamped).toBe(true);
  });

  it("falls back to the published bearing when the vehicle stands still", () => {
    const still = [
      sample(0, 0, { bearing: 90 }),
      sample(1000, 0, { lastUpdated: "later", bearing: 90 }),
    ];
    expect(positionAt(still, 500)!.heading).toBe(90);
  });

  it("has no heading when standing still with no published bearing", () => {
    const still = [sample(0, 0), sample(1000, 0, { lastUpdated: "later" })];
    expect(positionAt(still, 500)!.heading).toBeNull();
  });

  it("is null with no samples", () => {
    expect(positionAt([], 0)).toBeNull();
  });
});

describe("advancePlaybackTime", () => {
  it("starts at the target", () => {
    expect(advancePlaybackTime(null, 16, 5000)).toBe(5000);
  });

  it("advances in real time when on target", () => {
    expect(advancePlaybackTime(5000, 16, 5016)).toBe(5016);
  });

  it("never runs backwards when the target delay grows", () => {
    // The playback delay tracks the longest recent interval, so one late report
    // moves the target a second or more into the past in a single frame.
    const next = advancePlaybackTime(5000, 16, 5016 - 1500);
    expect(next).toBeGreaterThan(5000);
    expect(next).toBeLessThan(5016);
  });

  it("catches up, faster than real time, when the target delay shrinks", () => {
    const next = advancePlaybackTime(5000, 16, 5016 + 1500);
    expect(next).toBeGreaterThan(5016);
  });

  it("converges on a moved target within a few seconds", () => {
    let time = 0;
    let target = -1500;
    for (let frame = 0; frame < 60 * 5; frame++) {
      target += 16;
      time = advancePlaybackTime(time, 16, target);
    }
    expect(Math.abs(time - target)).toBeLessThan(50);
  });

  it("jumps rather than crawls when far off, as after a stall", () => {
    expect(advancePlaybackTime(0, 16, 60_000)).toBe(60_000);
  });
});

describe("chaseTarget", () => {
  it("plays a fast vehicle back through the buffer, behind real time", () => {
    const samples = samplesEvery(1000, 6);
    const now = samples[5].received + 100;
    const target = chaseTarget(samples, now);
    expect(target!.buffered).toBe(true);
    expect(target!.lat).toBeLessThan(samples[5].lat);
    expect(target!.lat).toBeGreaterThan(samples[0].lat);
  });

  it("targets the newest report for a slow vehicle", () => {
    const samples = samplesEvery(20_000, 4);
    const target = chaseTarget(samples, samples[3].received + 100);
    expect(target!.buffered).toBe(false);
    expect(target!.lat).toBe(samples[3].lat);
  });

  it("plays back from a carried clock rather than jumping to the new delay", () => {
    const samples = samplesEvery(1000, 6);
    const now = samples[5].received + 100;
    const fresh = chaseTarget(samples, now)!;
    const carried = chaseTarget(samples, now, {
      previous: fresh.playbackTime! + 500,
      dtMs: 16,
    })!;
    expect(carried.playbackTime).toBeGreaterThan(fresh.playbackTime! + 500);
  });

  it("stops the clock at the newest report instead of running past it", () => {
    // Running on would make the position jump forward once a late report
    // finally arrived, by however long the clock had run past the last one.
    const samples = samplesEvery(1000, 6);
    const now = samples[5].received + 20_000;
    const target = chaseTarget(samples, now, {
      previous: samples[5].received - 5,
      dtMs: 16,
    })!;
    expect(target.playbackTime).toBe(samples[5].received);
  });

  it("resumes from where it stopped when a late report arrives", () => {
    const samples = samplesEvery(1000, 6);
    const stoppedAt = samples[5].received;
    const late = addSample(samples, sample(stoppedAt + 4000, 6));
    const target = chaseTarget(late, stoppedAt + 4000, {
      previous: stoppedAt,
      dtMs: 16,
    })!;
    expect(target.playbackTime! - stoppedAt).toBeLessThanOrEqual(16 * 1.5);
    expect(target.lat).toBeCloseTo(samples[5].lat, 5);
  });

  it("has no playback clock for a vehicle it does not buffer", () => {
    const samples = samplesEvery(20_000, 4);
    expect(chaseTarget(samples, samples[3].received)!.playbackTime).toBeNull();
  });

  it("targets the newest report before the cadence is known", () => {
    const samples = samplesEvery(1000, 1);
    expect(chaseTarget(samples, samples[0].received)!.buffered).toBe(false);
  });
});

describe("bearingBetween", () => {
  it("is 90 heading east", () => {
    expect(
      bearingBetween(OSLO, { lon: OSLO.lon + 0.001, lat: OSLO.lat }),
    ).toBeCloseTo(90, 1);
  });

  it("is within [0, 360)", () => {
    const west = bearingBetween(OSLO, { lon: OSLO.lon - 0.001, lat: OSLO.lat });
    expect(west).toBeCloseTo(270, 1);
  });
});

describe("smoothAngle", () => {
  it("turns the short way across north", () => {
    const next = smoothAngle(350, 10, 0.5);
    expect(((next % 360) + 360) % 360).toBeCloseTo(0, 6);
  });

  it("reaches the target at alpha 1", () => {
    expect(smoothAngle(10, 200, 1)).toBeCloseTo(200, 6);
  });
});

describe("chaseBoundingBox", () => {
  it("centres a new box on the vehicle", () => {
    const box = chaseBoundingBox(undefined, OSLO.lon, OSLO.lat);
    expect((box[0][1] + box[1][1]) / 2).toBeCloseTo(OSLO.lat, 9);
    expect((box[0][0] + box[1][0]) / 2).toBeCloseTo(OSLO.lon, 9);
    expect(box[1][1] - box[0][1]).toBeCloseTo(2 * CHASE_BOX_HALF_SIZE_DEG, 9);
  });

  it("keeps the same box while the vehicle stays near its centre", () => {
    // Each new box re-opens the vehicle subscription, so it must not follow
    // the vehicle metre by metre.
    const box = chaseBoundingBox(undefined, OSLO.lon, OSLO.lat);
    const moved = chaseBoundingBox(box, OSLO.lon, OSLO.lat + 0.01);
    expect(moved).toBe(box);
  });

  it("recentres once the vehicle nears the edge", () => {
    const box = chaseBoundingBox(undefined, OSLO.lon, OSLO.lat);
    const lat = OSLO.lat + CHASE_BOX_HALF_SIZE_DEG * 0.8;
    const moved = chaseBoundingBox(box, OSLO.lon, lat);
    expect(moved).not.toBe(box);
    expect((moved[0][1] + moved[1][1]) / 2).toBeCloseTo(lat, 9);
  });

  it("replaces a box that does not contain the vehicle at all", () => {
    // The map viewport box from before the chase started.
    const viewport = [
      [5, 58],
      [6, 59],
    ];
    expect(chaseBoundingBox(viewport, OSLO.lon, OSLO.lat)).not.toBe(viewport);
  });
});
