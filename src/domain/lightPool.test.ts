import { describe, expect, it } from "vitest";
import { dimensionsFor } from "./vehicleFootprint.ts";
import {
  LIGHT_POOL_LIFT,
  LIGHT_POOL_REACH,
  hasLightPool,
  lightPoolMesh,
} from "./lightPool.ts";

describe("lightPoolMesh", () => {
  const mesh = lightPoolMesh("BUS");
  const p = mesh.positions.value;
  const ys = Array.from({ length: p.length / 3 }, (_, i) => p[i * 3 + 1]);
  const zs = Array.from({ length: p.length / 3 }, (_, i) => p[i * 3 + 2]);

  // The vehicle points along +y, so the light must lie ahead of its front and
  // nowhere under the body.
  it("starts at the vehicle's front and reaches ahead of it", () => {
    const front = dimensionsFor("BUS").length / 2;
    expect(Math.min(...ys)).toBeCloseTo(front, 5);
    expect(Math.max(...ys)).toBeCloseTo(front + LIGHT_POOL_REACH, 5);
  });

  it("lies flat just above the ground, facing up", () => {
    expect(zs.every((z) => z === Math.fround(LIGHT_POOL_LIFT))).toBe(true);
    const n = mesh.normals.value;
    for (let i = 0; i < n.length; i += 3) {
      expect([n[i], n[i + 1], n[i + 2]]).toEqual([0, 0, 1]);
    }
  });

  // The texture is drawn with the lamps on its bottom row, v = 1.
  it("puts the texture's bottom row at the front of the vehicle", () => {
    const uv = mesh.texCoords.value;
    const front = Math.min(...ys);
    ys.forEach((y, i) => expect(uv[i * 2 + 1]).toBe(y === front ? 1 : 0));
  });

  it("is built once per mode", () => {
    expect(lightPoolMesh("BUS")).toBe(mesh);
  });
});

describe("hasLightPool", () => {
  it("gives every mode but the ferry a pool", () => {
    expect(hasLightPool("FERRY")).toBe(false);
    for (const mode of ["BUS", "COACH", "TRAM", "METRO", "RAIL"] as const) {
      expect(hasLightPool(mode)).toBe(true);
    }
  });
});
