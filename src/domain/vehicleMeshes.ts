import { VehicleModeEnumeration } from "../types.ts";
import { dimensionsFor } from "./vehicleFootprint.ts";

/**
 * Low-poly vehicle models built from boxes, prisms and wheels, in the shape
 * deck.gl's SimpleMeshLayer takes: flat triangle lists of positions (metres),
 * normals and vertex colours.
 *
 * Built in code rather than loaded from glTF because no licence-clean model
 * pack covers the Norwegian fleet — metro, coach and ferry in particular — and
 * code makes every model true to `VEHICLE_DIMENSIONS` by construction.
 *
 * Model space: origin at the vehicle's reported position on the ground,
 * +y forward, +x to the vehicle's right, +z up.
 */
export type VehicleMesh = {
  positions: { value: Float32Array; size: 3 };
  normals: { value: Float32Array; size: 3 };
  colors: { value: Float32Array; size: 3 };
};

type Vec3 = [number, number, number];
type RGB = readonly [number, number, number];

const rgb = (hex: number): RGB => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

export const MESH_COLOURS = {
  glass: rgb(0x26313d),
  dark: rgb(0x2b2b2b),
  tyre: rgb(0x1e1e1e),
  hub: rgb(0xb8b8b8),
  roofUnit: rgb(0xd5d8dc),
  headlight: rgb(0xfff4c2),
  taillight: rgb(0x9c2020),
  sign: rgb(0xf0a830),
  deck: rgb(0xdedad2),
  white: rgb(0xf4f4f2),
} as const;

/** Body colour per mode, baked into the mesh. */
const BODY_COLOURS: Partial<Record<VehicleModeEnumeration, RGB>> = {
  BUS: rgb(0xd9322b),
  COACH: rgb(0x8a2c8f),
  TRAM: rgb(0x1f7ac2),
  METRO: rgb(0xe8762d),
  RAIL: rgb(0x2e7d32),
  FERRY: rgb(0x1d3f6e),
};
const DEFAULT_BODY = rgb(0x6b6b6b);

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];

  /**
   * One triangle, wound so its normal points away from `inside`. Taking an
   * interior point instead of trusting call-site winding keeps every
   * primitive below free of winding bookkeeping.
   */
  triangle(a: Vec3, b: Vec3, c: Vec3, colour: RGB, inside: Vec3) {
    const u = sub(b, a);
    const v = sub(c, a);
    let n: Vec3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const length = Math.hypot(...n);
    if (length < 1e-9) return;
    n = [n[0] / length, n[1] / length, n[2] / length];

    const centroid: Vec3 = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    const outward = sub(centroid, inside);
    let vertices = [a, b, c];
    if (n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0) {
      n = [-n[0], -n[1], -n[2]];
      vertices = [a, c, b];
    }
    for (const vertex of vertices) {
      this.positions.push(...vertex);
      this.normals.push(...n);
      this.colors.push(...colour);
    }
  }

  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: RGB, inside: Vec3) {
    this.triangle(a, b, c, colour, inside);
    this.triangle(a, c, d, colour, inside);
  }

  /** Axis-aligned box centred on (cx, cy), standing on z0. */
  box(
    cx: number,
    cy: number,
    z0: number,
    width: number,
    length: number,
    height: number,
    colour: RGB,
  ) {
    const [x0, x1] = [cx - width / 2, cx + width / 2];
    const [y0, y1] = [cy - length / 2, cy + length / 2];
    const z1 = z0 + height;
    const inside: Vec3 = [cx, cy, z0 + height / 2];
    const corner = (x: number, y: number, z: number): Vec3 => [x, y, z];
    const faces: Vec3[][] = [
      [
        corner(x0, y0, z1),
        corner(x1, y0, z1),
        corner(x1, y1, z1),
        corner(x0, y1, z1),
      ],
      [
        corner(x0, y0, z0),
        corner(x0, y1, z0),
        corner(x1, y1, z0),
        corner(x1, y0, z0),
      ],
      [
        corner(x1, y0, z0),
        corner(x1, y1, z0),
        corner(x1, y1, z1),
        corner(x1, y0, z1),
      ],
      [
        corner(x0, y0, z0),
        corner(x0, y0, z1),
        corner(x0, y1, z1),
        corner(x0, y1, z0),
      ],
      [
        corner(x0, y1, z0),
        corner(x0, y1, z1),
        corner(x1, y1, z1),
        corner(x1, y1, z0),
      ],
      [
        corner(x0, y0, z0),
        corner(x1, y0, z0),
        corner(x1, y0, z1),
        corner(x0, y0, z1),
      ],
    ];
    for (const [a, b, c, d] of faces) this.quad(a, b, c, d, colour, inside);
  }

  /**
   * A convex outline in the xy plane extruded from z0 to z1. The bottom ring
   * is shrunk by `bottomScale`, which is what gives a hull its taper.
   */
  prism(
    outline: [number, number][],
    z0: number,
    z1: number,
    side: RGB,
    top: RGB,
    bottomScale = 1,
  ) {
    const cx = outline.reduce((s, [x]) => s + x, 0) / outline.length;
    const cy = outline.reduce((s, [, y]) => s + y, 0) / outline.length;
    const inside: Vec3 = [cx, cy, (z0 + z1) / 2];
    const upper = outline.map(([x, y]): Vec3 => [x, y, z1]);
    const lower = outline.map(([x, y]): Vec3 => [
      cx + (x - cx) * bottomScale,
      cy + (y - cy) * bottomScale,
      z0,
    ]);
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      this.quad(lower[i], lower[j], upper[j], upper[i], side, inside);
      this.triangle([cx, cy, z1], upper[i], upper[j], top, inside);
      this.triangle([cx, cy, z0], lower[i], lower[j], side, inside);
    }
  }

  /** A wheel on an axle along x, touching the ground, with a grey hub. */
  wheel(cx: number, cy: number, radius: number, width: number, segments = 12) {
    const centre: Vec3 = [cx, cy, radius];
    const point = (x: number, i: number, r: number): Vec3 => {
      const angle = (i / segments) * Math.PI * 2;
      return [x, cy + Math.cos(angle) * r, radius + Math.sin(angle) * r];
    };
    const [left, right] = [cx - width / 2, cx + width / 2];
    for (let i = 0; i < segments; i++) {
      this.quad(
        point(left, i, radius),
        point(right, i, radius),
        point(right, i + 1, radius),
        point(left, i + 1, radius),
        MESH_COLOURS.tyre,
        centre,
      );
      for (const face of [left, right]) {
        // The hub sits a few millimetres proud of the tyre wall so the two
        // never fight for the same depth.
        const hubFace = face + Math.sign(face - cx) * 0.005;
        this.triangle(
          [face, cy, radius],
          point(face, i, radius),
          point(face, i + 1, radius),
          MESH_COLOURS.tyre,
          centre,
        );
        this.triangle(
          [hubFace, cy, radius],
          point(hubFace, i, radius * 0.45),
          point(hubFace, i + 1, radius * 0.45),
          MESH_COLOURS.hub,
          centre,
        );
      }
    }
  }

  build(): VehicleMesh {
    return {
      positions: { value: new Float32Array(this.positions), size: 3 },
      normals: { value: new Float32Array(this.normals), size: 3 },
      colors: { value: new Float32Array(this.colors), size: 3 },
    };
  }
}

type RoadVehicleSpec = {
  length: number;
  width: number;
  height: number;
  body: RGB;
  windowBottom: number;
  windowTop: number;
  /** Axle positions along y, measured from the vehicle's centre. */
  axles: number[];
};

function roadVehicle(spec: RoadVehicleSpec): VehicleMesh {
  const { length: L, width: W, height: H, body } = spec;
  const m = new MeshBuilder();
  const wheelRadius = 0.5;
  const roofTop = H - 0.15;

  m.box(0, 0, 0.3, W * 0.96, L * 0.98, 0.3, MESH_COLOURS.dark);
  m.box(0, 0, 0.6, W, L, spec.windowBottom - 0.6, body);
  m.box(
    0,
    0,
    spec.windowBottom,
    W * 0.985,
    L * 0.995,
    spec.windowTop - spec.windowBottom,
    MESH_COLOURS.glass,
  );
  m.box(0, 0, spec.windowTop, W, L, roofTop - spec.windowTop, body);
  m.box(0, -L * 0.1, roofTop, W * 0.6, L * 0.25, 0.15, MESH_COLOURS.roofUnit);

  // Window pillars, so the glass reads as windows rather than one band.
  const pillarCount = Math.max(3, Math.round(L / 1.9));
  for (let i = 0; i <= pillarCount; i++) {
    const y = -L / 2 + 0.6 + (i * (L - 1.2)) / pillarCount;
    for (const side of [-1, 1]) {
      m.box(
        (side * W) / 2,
        y,
        spec.windowBottom,
        0.05,
        0.14,
        spec.windowTop - spec.windowBottom,
        body,
      );
    }
  }

  // Front: windscreen, destination sign, headlights. Rear: tail lights.
  m.box(0, L / 2, 0.9, W * 0.9, 0.04, spec.windowTop - 0.9, MESH_COLOURS.glass);
  m.box(
    0,
    L / 2 + 0.03,
    spec.windowTop + 0.05,
    W * 0.7,
    0.03,
    0.25,
    MESH_COLOURS.sign,
  );
  for (const side of [-1, 1]) {
    m.box(
      side * W * 0.35,
      L / 2 + 0.03,
      0.7,
      0.35,
      0.03,
      0.15,
      MESH_COLOURS.headlight,
    );
    m.box(
      side * W * 0.4,
      -L / 2 - 0.03,
      0.9,
      0.2,
      0.03,
      0.35,
      MESH_COLOURS.taillight,
    );
  }

  for (const y of spec.axles) {
    for (const side of [-1, 1]) {
      m.wheel(side * (W / 2 - 0.16), y, wheelRadius, 0.3);
    }
  }
  return m.build();
}

type RailVehicleSpec = {
  cars: number;
  length: number;
  width: number;
  height: number;
  body: RGB;
  floor: number;
  windowBottom: number;
  windowTop: number;
  pantographOnCar?: number;
};

/** Cars of equal length separated by dark gangways, on bogies. */
function railVehicle(spec: RailVehicleSpec): VehicleMesh {
  const { length: L, width: W, height: H, body, cars } = spec;
  const m = new MeshBuilder();
  const gap = 0.5;
  const carLength = (L - gap * (cars - 1)) / cars;
  const pantographHeight = spec.pantographOnCar === undefined ? 0 : 0.5;
  const roofTop = H - pantographHeight;

  for (let car = 0; car < cars; car++) {
    const cy = -L / 2 + carLength / 2 + car * (carLength + gap);
    m.box(
      0,
      cy,
      0.5,
      W * 0.9,
      carLength * 0.96,
      spec.floor - 0.5,
      MESH_COLOURS.dark,
    );
    m.box(
      0,
      cy,
      spec.floor,
      W,
      carLength,
      spec.windowBottom - spec.floor,
      body,
    );
    m.box(
      0,
      cy,
      spec.windowBottom,
      W * 0.985,
      carLength * 0.995,
      spec.windowTop - spec.windowBottom,
      MESH_COLOURS.glass,
    );
    m.box(0, cy, spec.windowTop, W, carLength, roofTop - spec.windowTop, body);

    const pillars = Math.max(2, Math.round(carLength / 2.5));
    for (let i = 0; i <= pillars; i++) {
      const y = cy - carLength / 2 + 0.4 + (i * (carLength - 0.8)) / pillars;
      for (const side of [-1, 1]) {
        m.box(
          (side * W) / 2,
          y,
          spec.windowBottom,
          0.05,
          0.2,
          spec.windowTop - spec.windowBottom,
          body,
        );
      }
    }

    for (const offset of [-1, 1]) {
      m.box(
        0,
        cy + offset * (carLength / 2 - 2.2),
        0,
        W * 0.75,
        2.6,
        0.5,
        MESH_COLOURS.dark,
      );
    }
    if (car < cars - 1) {
      m.box(
        0,
        cy + carLength / 2 + gap / 2,
        spec.floor,
        W * 0.8,
        gap + 0.1,
        roofTop - spec.floor - 0.2,
        MESH_COLOURS.dark,
      );
    }
    if (car === spec.pantographOnCar) {
      m.box(0, cy, roofTop, 0.12, 0.12, pantographHeight, MESH_COLOURS.dark);
      m.box(
        0,
        cy,
        roofTop + pantographHeight - 0.08,
        W * 0.55,
        0.12,
        0.08,
        MESH_COLOURS.dark,
      );
    }
  }

  // Cab ends: windscreens both ends, headlights in front, tail lights behind.
  for (const end of [-1, 1]) {
    m.box(
      0,
      end * (L / 2),
      spec.windowBottom - 0.2,
      W * 0.8,
      0.04,
      spec.windowTop - spec.windowBottom + 0.2,
      MESH_COLOURS.glass,
    );
    for (const side of [-1, 1]) {
      m.box(
        side * W * 0.33,
        end * (L / 2 + 0.03),
        spec.floor + 0.1,
        0.3,
        0.03,
        0.15,
        end === 1 ? MESH_COLOURS.headlight : MESH_COLOURS.taillight,
      );
    }
  }
  return m.build();
}

function ferry(
  length: number,
  width: number,
  height: number,
  hull: RGB,
): VehicleMesh {
  const L = length;
  const W = width;
  const m = new MeshBuilder();
  const deck = 2.2;
  m.prism(
    [
      [-W * 0.42, -L / 2],
      [W * 0.42, -L / 2],
      [W / 2, -L / 4],
      [W / 2, L / 4],
      [W * 0.3, L * 0.42],
      [0, L / 2],
      [-W * 0.3, L * 0.42],
      [-W / 2, L / 4],
      [-W / 2, -L / 4],
    ],
    0,
    deck,
    hull,
    MESH_COLOURS.deck,
    0.8,
  );
  m.box(0, -L * 0.08, deck, W * 0.8, L * 0.55, 1.6, MESH_COLOURS.white);
  m.box(0, -L * 0.08, deck + 0.55, W * 0.81, L * 0.5, 0.6, MESH_COLOURS.glass);
  m.box(0, L * 0.12, deck + 1.6, W * 0.6, L * 0.12, 1.3, MESH_COLOURS.white);
  m.box(0, L * 0.12, deck + 2.1, W * 0.61, L * 0.1, 0.5, MESH_COLOURS.glass);
  const funnelHeight = height - (deck + 1.6);
  m.box(0, -L * 0.2, deck + 1.6, 1.2, 1.6, funnelHeight, hull);
  m.box(0, -L * 0.2, height - 0.3, 1.25, 1.65, 0.3, MESH_COLOURS.dark);
  m.box(0, L / 2 - 0.4, deck, 0.2, 0.2, 0.6, MESH_COLOURS.headlight);
  return m.build();
}

function buildMeshFor(mode: VehicleModeEnumeration): VehicleMesh {
  const { length, width, height } = dimensionsFor(mode);
  const body = BODY_COLOURS[mode] ?? DEFAULT_BODY;
  switch (mode) {
    case "BUS":
      return roadVehicle({
        length,
        width,
        height,
        body,
        windowBottom: 1.4,
        windowTop: 2.7,
        axles: [length / 2 - 2.7, -length / 2 + 3.3],
      });
    case "COACH":
      return roadVehicle({
        length,
        width,
        height,
        body,
        windowBottom: 1.9,
        windowTop: 3.05,
        axles: [length / 2 - 2.8, -length / 2 + 3.6, -length / 2 + 2.3],
      });
    case "TRAM":
      return railVehicle({
        cars: 3,
        length,
        width,
        height,
        body,
        floor: 0.55,
        windowBottom: 1.1,
        windowTop: 2.6,
        pantographOnCar: 1,
      });
    case "METRO":
      return railVehicle({
        cars: 3,
        length,
        width,
        height,
        body,
        floor: 1.0,
        windowBottom: 1.8,
        windowTop: 2.85,
      });
    case "RAIL":
      return railVehicle({
        cars: 4,
        length,
        width,
        height,
        body,
        floor: 1.1,
        windowBottom: 1.95,
        windowTop: 3.0,
        pantographOnCar: 1,
      });
    case "FERRY":
      return ferry(length, width, height, body);
    default:
      return roadVehicle({
        length,
        width,
        height,
        body,
        windowBottom: 1.2,
        windowTop: 2.2,
        axles: [length / 2 - 1.6, -length / 2 + 1.6],
      });
  }
}

const meshCache = new Map<VehicleModeEnumeration, VehicleMesh>();

/** The model for a mode, built once and shared by every vehicle of that mode. */
export function meshFor(mode: VehicleModeEnumeration): VehicleMesh {
  let mesh = meshCache.get(mode);
  if (!mesh) {
    mesh = buildMeshFor(mode);
    meshCache.set(mode, mesh);
  }
  return mesh;
}

let unknownHeadingMesh: VehicleMesh | null = null;

/**
 * A white octagonal column of unit radius and height, for vehicles with no
 * bearing. Scaled per vehicle and tinted by mode, it deliberately has no front,
 * so "direction unknown" is never drawn as "heading north".
 */
export function unknownHeadingMeshUnit(): VehicleMesh {
  if (!unknownHeadingMesh) {
    const m = new MeshBuilder();
    const outline = Array.from({ length: 8 }, (_, i): [number, number] => {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      return [Math.sin(angle), Math.cos(angle)];
    });
    m.prism(outline, 0, 1, MESH_COLOURS.white, MESH_COLOURS.white);
    unknownHeadingMesh = m.build();
  }
  return unknownHeadingMesh;
}

/** A mode's body colour as 0–255 RGB, for tinting the unknown-heading column. */
export function bodyColourFor(
  mode: VehicleModeEnumeration,
): [number, number, number] {
  const [r, g, b] = BODY_COLOURS[mode] ?? DEFAULT_BODY;
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
