import { describe, expect, it } from "vitest";
import { VehicleModeEnumeration } from "../types.ts";
import { dimensionsFor } from "./vehicleFootprint.ts";
import {
  MESH_COLOURS,
  VehicleMesh,
  VehicleModel,
  bodyColourFor,
  modelFor,
  unknownHeadingMeshUnit,
} from "./vehicleMeshes.ts";

const MODES: VehicleModeEnumeration[] = [
  "BUS",
  "COACH",
  "TRAM",
  "METRO",
  "RAIL",
  "FERRY",
  "TAXI",
];

function vertices(mesh: VehicleMesh): [number, number, number][] {
  const p = mesh.positions.value;
  return Array.from({ length: p.length / 3 }, (_, i) => [
    p[i * 3],
    p[i * 3 + 1],
    p[i * 3 + 2],
  ]);
}

/** Every part as one mesh, for checks about the model as a whole. */
function whole({ body, sign, details }: VehicleModel): VehicleMesh {
  const parts = [body, sign, details];
  const join = (pick: (mesh: VehicleMesh) => Float32Array) => {
    const arrays = parts.map(pick);
    const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  };
  return {
    positions: { value: join((m) => m.positions.value), size: 3 },
    normals: { value: join((m) => m.normals.value), size: 3 },
    colors: { value: join((m) => m.colors.value), size: 3 },
  };
}

function extent(mesh: VehicleMesh) {
  const vs = vertices(mesh);
  const axis = (i: number) => {
    const values = vs.map((v) => v[i]);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return { x: axis(0), y: axis(1), z: axis(2) };
}

function verticesColoured(mesh: VehicleMesh, colour: readonly number[]) {
  const c = mesh.colors.value;
  return vertices(mesh).filter((_, i) =>
    [0, 1, 2].every((k) => Math.abs(c[i * 3 + k] - colour[k]) < 1e-6),
  );
}

describe("modelFor", () => {
  for (const mode of MODES) {
    describe(mode, () => {
      const model = modelFor(mode);
      const mesh = whole(model);

      it("has one normal and one colour per vertex, in whole triangles, in every mesh", () => {
        for (const part of [model.body, model.details]) {
          expect(part.positions.value.length).toBeGreaterThan(0);
        }
        for (const part of [model.body, model.sign, model.details]) {
          const n = part.positions.value.length;
          expect(n % 9).toBe(0);
          expect(part.normals.value.length).toBe(n);
          expect(part.colors.value.length).toBe(n);
        }
      });

      // The renderer multiplies getColor into the vertex colours. Pure white is
      // what lets a per-vehicle colour land on the body exactly.
      it("has a pure white body and sign, so getColor alone decides their colours", () => {
        for (const part of [model.body, model.sign]) {
          expect(part.colors.value.every((channel) => channel === 1)).toBe(
            true,
          );
        }
      });

      // A detail in pure white would be indistinguishable from paint — and is
      // only drawn untinted because it lives in the details mesh.
      it("keeps every detail off pure white", () => {
        const c = model.details.colors.value;
        for (let i = 0; i < c.length; i += 3) {
          expect(c[i] === 1 && c[i + 1] === 1 && c[i + 2] === 1).toBe(false);
        }
      });

      it("has unit normals and finite positions", () => {
        const normals = mesh.normals.value;
        for (let i = 0; i < normals.length; i += 3) {
          expect(
            Math.hypot(normals[i], normals[i + 1], normals[i + 2]),
          ).toBeCloseTo(1, 4);
        }
        expect(mesh.positions.value.every(Number.isFinite)).toBe(true);
      });

      // True scale is the point: the model is the vehicle's size on the map,
      // so it must agree with the footprint dimensions it shares a table with.
      it("matches the mode's nominal dimensions and stands on the ground", () => {
        const { length, width, height } = dimensionsFor(mode);
        const { x, y, z } = extent(mesh);
        expect(y.max - y.min).toBeGreaterThan(length * 0.99);
        expect(y.max - y.min).toBeLessThan(length * 1.02);
        expect(x.max - x.min).toBeGreaterThan(width * 0.97);
        expect(x.max - x.min).toBeLessThan(width * 1.03);
        expect(z.max).toBeCloseTo(height, 2);
        expect(z.min).toBeCloseTo(0, 5);
      });

      it("is centred on the reported position", () => {
        const { x, y } = extent(mesh);
        expect(Math.abs(x.max + x.min)).toBeLessThan(0.05);
        expect(Math.abs(y.max + y.min)).toBeLessThan(0.1);
      });
    });
  }

  // Heading is only legible if the front is unambiguous: the renderer turns
  // the model by -bearing on the assumption that +y is forward.
  it("puts every road and rail vehicle's headlights at the +y end", () => {
    for (const mode of MODES.filter((m) => m !== "FERRY")) {
      const lights = verticesColoured(
        modelFor(mode).details,
        MESH_COLOURS.headlight,
      );
      expect(lights.length, mode).toBeGreaterThan(0);
      for (const [, y] of lights) expect(y, mode).toBeGreaterThan(0);
    }
  });

  // A sign that faces only one way is invisible from most angles, and the
  // side view is the one a pitched map shows most.
  it("gives every road and rail vehicle a sign at both ends and on both sides", () => {
    for (const mode of MODES.filter((m) => m !== "FERRY")) {
      const { width } = dimensionsFor(mode);
      const signs = vertices(modelFor(mode).sign);
      expect(
        signs.some(([, y]) => y > 0),
        mode,
      ).toBe(true);
      expect(
        signs.some(([, y]) => y < 0),
        mode,
      ).toBe(true);
      expect(
        signs.some(([x]) => x > width * 0.45),
        mode,
      ).toBe(true);
      expect(
        signs.some(([x]) => x < -width * 0.45),
        mode,
      ).toBe(true);
    }
  });

  it("gives the ferry no sign", () => {
    expect(modelFor("FERRY").sign.positions.value).toHaveLength(0);
  });

  it("points the ferry's bow along +y", () => {
    const { length } = dimensionsFor("FERRY");
    const bow = vertices(whole(modelFor("FERRY"))).filter(
      ([, y]) => Math.abs(y - length / 2) < 1e-4,
    );
    expect(bow.length).toBeGreaterThan(0);
    for (const [x] of bow) expect(Math.abs(x)).toBeLessThan(1e-4);
  });

  it("builds each mode once", () => {
    expect(modelFor("BUS")).toBe(modelFor("BUS"));
  });
});

describe("unknownHeadingMeshUnit", () => {
  it("is a white unit column with no front", () => {
    const mesh = unknownHeadingMeshUnit();
    expect(mesh.colors.value.every((channel) => channel === 1)).toBe(true);
    const { x, y, z } = extent(mesh);
    expect(z.min).toBeCloseTo(0, 5);
    expect(z.max).toBeCloseTo(1, 5);
    // Symmetric front to back and side to side.
    expect(y.max).toBeCloseTo(-y.min, 5);
    expect(x.max).toBeCloseTo(-x.min, 5);
    expect(y.max).toBeLessThanOrEqual(1);
  });
});

describe("bodyColourFor", () => {
  it("returns 0–255 channels", () => {
    for (const mode of MODES) {
      for (const channel of bodyColourFor(mode)) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});
