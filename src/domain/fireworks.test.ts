import { describe, expect, it } from "vitest";
import {
  FIREWORK_COLOURS,
  RISE_S,
  SPARK_DRAG,
  SPARK_GRAVITY,
  SPARK_LIFE_S,
  SPARK_SPEED,
  burstDurationS,
  burstSparks,
  rocketRise,
  sparkBrightness,
  sparkOffset,
  type Rgb,
} from "./fireworks.ts";

describe("rocketRise", () => {
  it("starts at 0 and reaches 1 at RISE_S and after", () => {
    expect(rocketRise(0)).toBe(0);
    expect(rocketRise(RISE_S)).toBe(1);
    expect(rocketRise(RISE_S + 5)).toBe(1);
    expect(rocketRise(-1)).toBe(0);
  });

  it("increases strictly in between and decelerates", () => {
    let previous = 0;
    for (let i = 1; i < 20; i++) {
      const value = rocketRise((RISE_S * i) / 20);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(rocketRise(RISE_S / 2)).toBeGreaterThan(0.5);
  });
});

describe("sparkOffset", () => {
  it("is at the burst point at t=0", () => {
    expect(sparkOffset([1, 0, 0], 70, 0)).toEqual([0, 0, 0]);
  });

  it("never reaches further than speed over drag horizontally", () => {
    for (const t of [0.5, 1, 2, 5, 50]) {
      const [x] = sparkOffset([1, 0, 0], 70, t);
      expect(x).toBeLessThanOrEqual(70 / SPARK_DRAG);
    }
  });

  it("falls for a horizontal spark", () => {
    let previous = 0;
    for (const t of [0.2, 0.6, 1, 1.5, 2.4]) {
      const up = sparkOffset([1, 0, 0], 70, t)[2];
      expect(up).toBeLessThan(previous);
      previous = up;
    }
  });

  it("matches the closed form", () => {
    const k = SPARK_DRAG;
    const t = 1.3;
    const speed = 70;
    const d = 1 - Math.exp(-k * t);
    const reach = (speed * d) / k;
    const [x, y, z] = sparkOffset([0.6, 0, 0.8], speed, t);
    expect(x).toBeCloseTo(0.6 * reach, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0.8 * reach - (SPARK_GRAVITY / k) * (t - d / k), 6);
  });
});

describe("sparkBrightness", () => {
  it("is 1 at the burst, 0 at the end of life and outside it", () => {
    expect(sparkBrightness(0)).toBe(1);
    expect(sparkBrightness(SPARK_LIFE_S)).toBe(0);
    expect(sparkBrightness(SPARK_LIFE_S + 1)).toBe(0);
    expect(sparkBrightness(-0.1)).toBe(0);
  });

  it("never rises", () => {
    let previous = 1;
    for (let i = 0; i < 50; i++) {
      const value = sparkBrightness((SPARK_LIFE_S * i) / 49);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("burstSparks", () => {
  const a: Rgb = [255, 0, 0];
  const b: Rgb = [0, 0, 255];
  const sparks = burstSparks(42, 60, [a, b]);

  it("makes unit directions spread over the sphere", () => {
    expect(sparks).toHaveLength(60);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const {
      direction: [x, y, z],
    } of sparks) {
      expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1e-9);
      sx += x;
      sy += y;
      sz += z;
    }
    expect(Math.hypot(sx, sy, sz) / sparks.length).toBeLessThan(0.1);
  });

  it("keeps speeds within 85-105% of SPARK_SPEED", () => {
    for (const { speed } of sparks) {
      expect(speed).toBeGreaterThanOrEqual(0.85 * SPARK_SPEED);
      expect(speed).toBeLessThanOrEqual(1.05 * SPARK_SPEED);
    }
  });

  it("colours every third spark in the second colour", () => {
    expect(sparks.filter((s) => s.colour === b)).toHaveLength(20);
    expect(sparks.filter((s) => s.colour === a)).toHaveLength(40);
  });

  it("is deterministic in the seed", () => {
    expect(burstSparks(42, 60, [a, b])).toEqual(sparks);
    expect(burstSparks(43, 60, [a, b])).not.toEqual(sparks);
  });
});

describe("FIREWORK_COLOURS", () => {
  it("has seven 8-bit colours", () => {
    expect(FIREWORK_COLOURS).toHaveLength(7);
    for (const colour of FIREWORK_COLOURS) {
      for (const channel of colour) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("burstDurationS", () => {
  it("runs from launch to the last light", () => {
    expect(burstDurationS()).toBeGreaterThan(RISE_S + SPARK_LIFE_S);
  });
});
