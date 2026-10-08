import { describe, expect, it } from "vitest";
import {
  MAX_FIXED_PITCH,
  formatFixedCamera,
  parseFixedCamera,
  roundCamera,
} from "./fixedCamera.ts";

describe("parseFixedCamera", () => {
  it("reads latitude, longitude, zoom, pitch and bearing", () => {
    expect(parseFixedCamera("59.911,10.755,17.5,55,-30")).toEqual({
      latitude: 59.911,
      longitude: 10.755,
      zoom: 17.5,
      pitch: 55,
      bearing: -30,
    });
  });

  it("is null without a value or with a malformed one", () => {
    for (const raw of [
      null,
      "",
      "59.9,10.7,15,0",
      "59.9,10.7,15,0,0,0",
      "59.9,x,15,0,0",
      "59.9,,15,0,0",
      "91,10.7,15,0,0",
      "59.9,181,15,0,0",
      "59.9,10.7,25,0,0",
      "59.9,10.7,-1,0,0",
      "59.9,10.7,15,-5,0",
    ]) {
      expect(parseFixedCamera(raw)).toBeNull();
    }
  });

  it("caps the pitch, as the 3D view does", () => {
    expect(parseFixedCamera("59.9,10.7,15,80,0")?.pitch).toBe(MAX_FIXED_PITCH);
  });

  it("brings the bearing into (-180, 180]", () => {
    expect(parseFixedCamera("59.9,10.7,15,0,270")?.bearing).toBe(-90);
    expect(parseFixedCamera("59.9,10.7,15,0,-180")?.bearing).toBe(180);
    expect(parseFixedCamera("59.9,10.7,15,0,720")?.bearing).toBe(0);
  });
});

describe("formatFixedCamera", () => {
  it("rounds so a link stays short, dropping trailing zeros", () => {
    expect(
      formatFixedCamera({
        latitude: 59.9110049,
        longitude: 10.75,
        zoom: 17.4999,
        pitch: 54.6,
        bearing: -30.2,
      }),
    ).toBe("59.911,10.75,17.5,55,-30");
  });

  it("never writes a negative zero", () => {
    expect(
      formatFixedCamera({
        latitude: 59.9,
        longitude: 10.7,
        zoom: 15,
        pitch: 0.2,
        bearing: -0.3,
      }),
    ).toBe("59.9,10.7,15,0,0");
  });

  it("round-trips through parseFixedCamera", () => {
    const camera = roundCamera({
      latitude: 63.4305149,
      longitude: 10.3950528,
      zoom: 16.123,
      pitch: 42.4,
      bearing: 123.6,
    });
    expect(parseFixedCamera(formatFixedCamera(camera))).toEqual(camera);
  });
});
