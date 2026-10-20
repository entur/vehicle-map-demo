import { describe, expect, it } from "vitest";
import { VehicleModeEnumeration } from "../types.ts";
import { dimensionsFor } from "./vehicleFootprint.ts";
import { PUMPKIN_ASPECT, TREE_ASPECT } from "./decorationPlacement.ts";
import {
  MESH_COLOURS,
  SIGN_TEXTURE_ASPECT,
  VehicleMesh,
  VehicleModel,
  STOP_POLE,
  TREE,
  bodyColourFor,
  christmasTreeModel,
  modelFor,
  pumpkinModel,
  stopPoleModel,
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
function whole({ body, sign, details, lamps }: VehicleModel): VehicleMesh {
  const parts = [body, sign, details, lamps];
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

function emptyMesh(): VehicleMesh {
  return {
    positions: { value: new Float32Array(), size: 3 },
    normals: { value: new Float32Array(), size: 3 },
    colors: { value: new Float32Array(), size: 3 },
  };
}

function joinMeshes(a: VehicleMesh, b: VehicleMesh): VehicleMesh {
  return whole({
    body: a,
    sign: { ...emptyMesh(), texCoords: { value: new Float32Array(), size: 2 } },
    details: b,
    lamps: emptyMesh(),
  });
}

type Point = [number, number, number];

/** Distance from p to triangle abc (Ericson, Real-Time Collision Detection). */
function distanceToTriangle(p: Point, a: Point, b: Point, c: Point): number {
  const sub = (u: Point, v: Point): Point => [
    u[0] - v[0],
    u[1] - v[1],
    u[2] - v[2],
  ];
  const dot = (u: Point, v: Point) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const along = (o: Point, u: Point, t: number): Point => [
    o[0] + u[0] * t,
    o[1] + u[1] * t,
    o[2] + u[2] * t,
  ];
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  let q: Point;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b);
    const d3 = dot(ab, bp);
    const d4 = dot(ac, bp);
    const cp = sub(p, c);
    const d5 = dot(ab, cp);
    const d6 = dot(ac, cp);
    const vc = d1 * d4 - d3 * d2;
    const vb = d5 * d2 - d1 * d6;
    const va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) q = b;
    else if (d6 >= 0 && d5 <= d6) q = c;
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = along(a, ab, d1 / (d1 - d3));
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = along(a, ac, d2 / (d2 - d6));
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
      q = along(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
    else {
      const denom = 1 / (va + vb + vc);
      q = along(along(a, ab, vb * denom), ac, vc * denom);
    }
  }
  return Math.hypot(...sub(p, q));
}

function verticesColoured(mesh: VehicleMesh, colour: readonly number[]) {
  const c = mesh.colors.value;
  return vertices(mesh).filter((_, i) =>
    [0, 1, 2].every((k) => Math.abs(c[i * 3 + k] - colour[k]) < 1e-6),
  );
}

type Face = { normal: Vec3; du: Vec3; dv: Vec3 };
type Vec3 = [number, number, number];

/** Per sign triangle: its normal and how u and v change per metre. */
function faces(mesh: VehicleModel["sign"]): Face[] {
  const p = vertices(mesh);
  const n = mesh.normals.value;
  const t = mesh.texCoords.value;
  const out: Face[] = [];
  for (let i = 0; i < p.length; i += 3) {
    const e1 = p[i + 1].map((c, k) => c - p[i][k]) as Vec3;
    const e2 = p[i + 2].map((c, k) => c - p[i][k]) as Vec3;
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const [a, b, c] = [dot(e1, e1), dot(e1, e2), dot(e2, e2)];
    const det = a * c - b * b;
    // The in-plane gradient of a value given at the three vertices.
    const gradient = (value: (j: number) => number): Vec3 => {
      const [d1, d2] = [value(i + 1) - value(i), value(i + 2) - value(i)];
      const alpha = (c * d1 - b * d2) / det;
      const beta = (a * d2 - b * d1) / det;
      return [0, 1, 2].map((k) => alpha * e1[k] + beta * e2[k]) as Vec3;
    };
    out.push({
      normal: [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]],
      du: gradient((j) => t[j * 2]),
      dv: gradient((j) => t[j * 2 + 1]),
    });
  }
  return out;
}

describe("modelFor", () => {
  for (const mode of MODES) {
    describe(mode, () => {
      const model = modelFor(mode);
      const mesh = whole(model);

      it("has one normal and one colour per vertex, in whole triangles, in every mesh", () => {
        for (const part of [model.body, model.details, model.lamps]) {
          expect(part.positions.value.length).toBeGreaterThan(0);
        }
        for (const part of [
          model.body,
          model.sign,
          model.details,
          model.lamps,
        ]) {
          const n = part.positions.value.length;
          expect(n % 9).toBe(0);
          expect(part.normals.value.length).toBe(n);
          expect(part.colors.value.length).toBe(n);
        }
        expect(model.sign.texCoords.value.length).toBe(
          (model.sign.positions.value.length / 3) * 2,
        );
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

      // The renderer lights the lamps differently in dark mode, so a lamp left
      // among the details would stay unlit, and a detail among the lamps
      // would glow.
      it("puts every lamp, and nothing else, in the lamps mesh", () => {
        const lampColours = [
          MESH_COLOURS.headlight,
          MESH_COLOURS.taillight,
          MESH_COLOURS.indicator,
          MESH_COLOURS.starboard,
        ];
        const count = (part: VehicleMesh) =>
          lampColours.reduce(
            (n, colour) => n + verticesColoured(part, colour).length,
            0,
          );
        expect(count(model.details)).toBe(0);
        expect(count(model.lamps)).toBe(model.lamps.positions.value.length / 3);
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

      // Every vehicle of a mode shares one instanced mesh, so detail is cheap —
      // but not free. The budget keeps it from growing unnoticed.
      it("stays within its triangle budget", () => {
        expect(mesh.positions.value.length / 9).toBeLessThan(5000);
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
        modelFor(mode).lamps,
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

  // The texture is drawn to be read from in front. Seen from outside, text
  // runs to the viewer's right and down the face, and the texture keeps its
  // proportions whatever the shape of the face it is on.
  describe("sign texture coordinates", () => {
    // Right as seen by someone facing each way the signs face.
    const directions: [string, Vec3, Vec3][] = [
      ["front", [0, 1, 0], [-1, 0, 0]],
      ["rear", [0, -1, 0], [1, 0, 0]],
      ["right side", [1, 0, 0], [0, 1, 0]],
      ["left side", [-1, 0, 0], [0, -1, 0]],
    ];

    for (const mode of MODES.filter((m) => m !== "FERRY")) {
      describe(mode, () => {
        const all = faces(modelFor(mode).sign);

        for (const [name, outward, right] of directions) {
          it(`reads left to right and top to bottom on the ${name}`, () => {
            const facing = all.filter(
              ({ normal }) =>
                normal[0] * outward[0] +
                  normal[1] * outward[1] +
                  normal[2] * outward[2] >
                0.7,
            );
            expect(facing.length).toBeGreaterThan(0);
            for (const { du, dv } of facing) {
              const along = du[0] * right[0] + du[1] * right[1];
              expect(along).toBeGreaterThan(0);
              expect(dv[2]).toBeLessThan(0);
            }
          });
        }

        it("keeps the texture's proportions", () => {
          for (const { normal, du, dv } of all) {
            if (Math.abs(normal[2]) > 0.7) continue;
            const ratio = Math.hypot(...dv) / Math.hypot(...du);
            expect(ratio).toBeCloseTo(SIGN_TEXTURE_ASPECT, 3);
          }
        });
      });
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

describe("stopPoleModel", () => {
  const model = stopPoleModel();

  it("stands a pole on the stop's position, with the name board on top", () => {
    const pole = extent(model.details);
    expect(pole.z.min).toBeCloseTo(0, 5);
    expect(Math.abs(pole.x.min)).toBeLessThan(0.1);
    expect(Math.abs(pole.y.min)).toBeLessThan(0.1);

    const board = extent(whole({ ...model, details: model.body }));
    expect(board.z.max).toBeCloseTo(STOP_POLE.height, 5);
    expect(board.x.max - board.x.min).toBeCloseTo(STOP_POLE.boardWidth, 5);
    expect(pole.z.max).toBeLessThanOrEqual(STOP_POLE.height);
  });

  it("has no lamps", () => {
    expect(model.lamps.positions.value).toHaveLength(0);
  });

  // The board faces along the route, so it is read by someone travelling it
  // in either direction — including the chase camera, behind the vehicle.
  for (const [name, outward, right] of [
    ["oncoming side", [0, -1, 0], [1, 0, 0]],
    ["far side", [0, 1, 0], [-1, 0, 0]],
  ] as [string, Vec3, Vec3][]) {
    it(`reads left to right and top to bottom from the ${name}`, () => {
      const facing = faces(model.sign).filter(
        ({ normal }) =>
          normal[0] * outward[0] +
            normal[1] * outward[1] +
            normal[2] * outward[2] >
          0.7,
      );
      expect(facing.length).toBeGreaterThan(0);
      for (const { du, dv } of facing) {
        expect(du[0] * right[0] + du[1] * right[1]).toBeGreaterThan(0);
        expect(dv[2]).toBeLessThan(0);
        expect(Math.hypot(...dv) / Math.hypot(...du)).toBeCloseTo(
          SIGN_TEXTURE_ASPECT,
          3,
        );
      }
    });
  }

  it("is built once", () => {
    expect(stopPoleModel()).toBe(stopPoleModel());
  });
});

describe("pumpkinModel", () => {
  const model = pumpkinModel();

  it("has one normal and one colour per vertex, in whole triangles, in every mesh", () => {
    for (const part of [model.body, model.details, model.lamps]) {
      expect(part.positions.value.length).toBeGreaterThan(0);
    }
    for (const part of [model.body, model.sign, model.details, model.lamps]) {
      const n = part.positions.value.length;
      expect(n % 9).toBe(0);
      expect(part.normals.value.length).toBe(n);
      expect(part.colors.value.length).toBe(n);
    }
  });

  it("has a pure white body, so getColor alone decides its colour", () => {
    expect(model.body.colors.value.every((channel) => channel === 1)).toBe(
      true,
    );
  });

  it("has unit normals and finite positions", () => {
    const mesh = whole(model);
    const normals = mesh.normals.value;
    for (let i = 0; i < normals.length; i += 3) {
      expect(
        Math.hypot(normals[i], normals[i + 1], normals[i + 2]),
      ).toBeCloseTo(1, 4);
    }
    expect(mesh.positions.value.every(Number.isFinite)).toBe(true);
  });

  // Placement keeps a footprint of PUMPKIN_ASPECT × height clear, and scales
  // the mesh by the height, so the mesh must be exactly that shape.
  it("stands one unit tall on the ground, PUMPKIN_ASPECT wide, centred", () => {
    const { x, y, z } = extent(whole(model));
    expect(z.min).toBeCloseTo(0, 5);
    expect(z.max).toBeCloseTo(1, 2);
    expect(x.max - x.min).toBeCloseTo(PUMPKIN_ASPECT, 1);
    expect(x.max - x.min).toBeLessThanOrEqual(PUMPKIN_ASPECT + 0.02);
    expect(y.max - y.min).toBeLessThanOrEqual(PUMPKIN_ASPECT + 0.02);
    expect(Math.abs(x.max + x.min)).toBeLessThan(0.02);
  });

  // Lit as a lamp in dark mode, so the face — and only the face — glows.
  it("carves its face on the +y side only, in the lamps mesh", () => {
    expect(vertices(model.lamps).length).toBeGreaterThan(0);
    for (const [, y] of vertices(model.lamps)) expect(y).toBeGreaterThan(0);
    expect(verticesColoured(model.details, MESH_COLOURS.jackOLantern)).toEqual(
      [],
    );
    expect(
      verticesColoured(model.lamps, MESH_COLOURS.jackOLantern),
    ).toHaveLength(model.lamps.positions.value.length / 3);
  });

  it("has no sign", () => {
    expect(model.sign.positions.value).toHaveLength(0);
  });

  // Up to 200 copies in view, all one instanced mesh.
  it("stays within 800 triangles", () => {
    expect(whole(model).positions.value.length / 9).toBeLessThan(800);
  });

  it("is built once", () => {
    expect(pumpkinModel()).toBe(model);
  });
});

describe("christmasTreeModel", () => {
  const model = christmasTreeModel();
  const meshes = [model.canopy, model.trunk, model.star, ...model.bulbs];
  const all = meshes.reduce(joinMeshes);
  // A bulb is a box: six faces of two triangles each.
  const BOX_VERTICES = 36;
  const bulbCentres = (mesh: VehicleMesh) => {
    const vs = vertices(mesh);
    const centres: [number, number, number][] = [];
    for (let i = 0; i < vs.length; i += BOX_VERTICES) {
      const box = vs.slice(i, i + BOX_VERTICES);
      centres.push(
        [0, 1, 2].map(
          (k) => box.reduce((sum, v) => sum + v[k], 0) / box.length,
        ) as [number, number, number],
      );
    }
    return centres;
  };

  it("has whole triangles with one normal and one colour per vertex in every mesh", () => {
    for (const part of meshes) {
      const n = part.positions.value.length;
      expect(n).toBeGreaterThan(0);
      expect(n % 9).toBe(0);
      expect(part.normals.value.length).toBe(n);
      expect(part.colors.value.length).toBe(n);
    }
  });

  it("has unit normals and finite positions", () => {
    const normals = all.normals.value;
    for (let i = 0; i < normals.length; i += 3) {
      expect(
        Math.hypot(normals[i], normals[i + 1], normals[i + 2]),
      ).toBeCloseTo(1, 4);
    }
    expect(all.positions.value.every(Number.isFinite)).toBe(true);
  });

  it("has a pure white canopy, so getColor alone decides its colour", () => {
    expect(model.canopy.colors.value.every((channel) => channel === 1)).toBe(
      true,
    );
  });

  // Placement keeps a footprint of TREE_ASPECT × height clear, and scales the
  // mesh by the height, so the mesh must be exactly that shape.
  it("stands one unit tall on the ground, its canopy TREE_ASPECT wide at the widest, centred", () => {
    const { x, y, z } = extent(all);
    expect(z.min).toBeCloseTo(0, 5);
    expect(z.max).toBeCloseTo(TREE.height, 2);
    const canopy = extent(model.canopy);
    expect(canopy.x.max - canopy.x.min).toBeCloseTo(TREE_ASPECT, 2);
    expect(Math.abs(canopy.x.max - canopy.x.min - TREE_ASPECT)).toBeLessThan(
      0.02,
    );
    expect(Math.abs(canopy.y.max - canopy.y.min - TREE_ASPECT)).toBeLessThan(
      0.02,
    );
    expect(x.max - x.min).toBeLessThanOrEqual(TREE_ASPECT + 0.02);
    expect(y.max - y.min).toBeLessThanOrEqual(TREE_ASPECT + 0.02);
    expect(Math.abs(x.max + x.min)).toBeLessThan(0.02);
    expect(Math.abs(y.max + y.min)).toBeLessThan(0.02);
  });

  it("has TREE.bulbGroups groups of bulbs, each carrying every bulb colour, TREE.bulbs in all", () => {
    expect(model.bulbs).toHaveLength(TREE.bulbGroups);
    const { bulbWarm, bulbRed, bulbGold, bulbBlue } = MESH_COLOURS;
    let total = 0;
    for (const group of model.bulbs) {
      expect(group.positions.value.length).toBeGreaterThan(0);
      expect(vertices(group).length % BOX_VERTICES).toBe(0);
      for (const colour of [bulbWarm, bulbRed, bulbGold, bulbBlue]) {
        expect(verticesColoured(group, colour).length).toBeGreaterThan(0);
      }
      total += vertices(group).length / BOX_VERTICES;
    }
    expect(total).toBe(TREE.bulbs);
  });

  it("keeps every bulb on the canopy's surface, above the trunk", () => {
    const triangles = vertices(model.canopy);
    for (const group of model.bulbs) {
      for (const v of vertices(group)) {
        expect(v[2]).toBeGreaterThan(TREE.trunkHeight);
      }
      for (const centre of bulbCentres(group)) {
        let nearest = Infinity;
        for (let i = 0; i < triangles.length; i += 3) {
          nearest = Math.min(
            nearest,
            distanceToTriangle(
              centre,
              triangles[i],
              triangles[i + 1],
              triangles[i + 2],
            ),
          );
        }
        expect(nearest).toBeLessThan(0.02);
      }
    }
  });

  it("is built once", () => {
    expect(christmasTreeModel()).toBe(model);
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
