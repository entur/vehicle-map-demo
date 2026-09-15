import { VehicleModeEnumeration } from "../types.ts";
import { dimensionsFor } from "./vehicleFootprint.ts";

/**
 * Low-poly vehicle models built from boxes, prisms, lofted hulls and wheels,
 * in the shape deck.gl's SimpleMeshLayer takes: flat triangle lists of
 * positions (metres), normals and vertex colours.
 *
 * Built in code rather than loaded from glTF because no licence-clean model
 * pack covers the Norwegian fleet — metro, coach and ferry in particular — and
 * code makes every model true to `VEHICLE_DIMENSIONS` by construction.
 *
 * Each model is three meshes. The **body** and the destination **sign** are
 * pure white, so the renderer's per-vehicle `getColor` sets each colour exactly
 * — the line's published colour and text colour, or the mode colour and a
 * default amber. The **details** — glass, lights, wheels, underframe — carry
 * fixed vertex colours and are drawn with a white `getColor`, since deck.gl
 * multiplies the two and would tint a headlight as readily as a body panel.
 *
 * Model space: origin at the vehicle's reported position on the ground,
 * +y forward, +x to the vehicle's right, +z up.
 */
export type VehicleMesh = {
  positions: { value: Float32Array; size: 3 };
  normals: { value: Float32Array; size: 3 };
  colors: { value: Float32Array; size: 3 };
};

export type VehicleModel = {
  /** White; coloured per vehicle by the renderer. */
  body: VehicleMesh;
  /** White; coloured per vehicle by the renderer. Empty for a ferry. */
  sign: VehicleMesh;
  /** Fixed colours; drawn untinted. */
  details: VehicleMesh;
};

type Vec3 = [number, number, number];
/** A hull cross-section point: x, z, and an optional offset along y. */
type HalfPoint = [number, number, number?];
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
  deck: rgb(0xdedad2),
  white: rgb(0xf4f4f2),
  indicator: rgb(0xe89a2c),
  archLiner: rgb(0x141414),
  hatch: rgb(0x9aa0a6),
  doorFrame: rgb(0xa9aeb3),
} as const;

/**
 * Marks a primitive as body paint rather than a detail. Compared by identity,
 * so no real colour can be mistaken for it.
 */
const PAINT: RGB = Object.freeze([1, 1, 1] as const);
/** Marks a primitive as a destination sign. Compared by identity, like `PAINT`. */
const SIGN: RGB = Object.freeze([1, 1, 1] as const);
const WHITE: RGB = [1, 1, 1];

/** Default body colour per mode, applied by the renderer through `getColor`. */
const BODY_COLOURS: Partial<Record<VehicleModeEnumeration, RGB>> = {
  BUS: rgb(0xd9322b),
  COACH: rgb(0x8a2c8f),
  TRAM: rgb(0x1f7ac2),
  METRO: rgb(0xe8762d),
  RAIL: rgb(0x2e7d32),
  FERRY: rgb(0x1d3f6e),
};
const DEFAULT_BODY = rgb(0x6b6b6b);
const to255 = ([r, g, b]: RGB): [number, number, number] => [
  Math.round(r * 255),
  Math.round(g * 255),
  Math.round(b * 255),
];

/** A sign's colour, as 0–255 RGB, when the line publishes no text colour. */
export const DEFAULT_SIGN_COLOUR = to255(rgb(0xf0a830));

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

type Arrays = { positions: number[]; normals: number[]; colors: number[] };
const emptyArrays = (): Arrays => ({ positions: [], normals: [], colors: [] });

class MeshBuilder {
  private body = emptyArrays();
  private sign = emptyArrays();
  private details = emptyArrays();

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
    const target =
      colour === PAINT ? this.body : colour === SIGN ? this.sign : this.details;
    const stored = colour === PAINT || colour === SIGN ? WHITE : colour;
    for (const vertex of vertices) {
      target.positions.push(...vertex);
      target.normals.push(...n);
      target.colors.push(...stored);
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

  /**
   * A hull lofted along y through cross-sections. Each section is the right
   * half of a left–right symmetric outline, listed from the underside edge up
   * to the roof centreline, with the same number of points at every station.
   * A point may carry a third value, an offset along y from its station,
   * which is how a windscreen leans back. The sides between stations and the
   * two end caps take their colour per band from `colourAt`, so glass, trim
   * and paint are bands of one surface rather than boxes laid over another.
   */
  hull(
    stations: { y: number; half: HalfPoint[] }[],
    colourAt: (y: number, z: number) => RGB,
    underside: RGB,
  ) {
    const first = stations[0];
    const last = stations[stations.length - 1];
    const zs = first.half.map(([, z]) => z);
    const inside: Vec3 = [
      0,
      (first.y + last.y) / 2,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    ];
    const ring = (half: HalfPoint[]): HalfPoint[] => [
      ...half,
      ...half
        .slice(0, -1)
        .reverse()
        .map(([x, z, dy]): HalfPoint => [-x, z, dy]),
    ];
    const at = (y: number, [x, z, dy = 0]: HalfPoint): Vec3 => [x, y + dy, z];

    for (let s = 0; s + 1 < stations.length; s++) {
      const [a, b] = [stations[s], stations[s + 1]];
      const [ra, rb] = [ring(a.half), ring(b.half)];
      const yMid = (a.y + b.y) / 2;
      for (let j = 0; j < ra.length; j++) {
        const k = (j + 1) % ra.length;
        // The closing edge runs along the underside, from left back to right.
        const colour =
          k === 0
            ? underside
            : colourAt(yMid, (ra[j][1] + ra[k][1] + rb[j][1] + rb[k][1]) / 4);
        this.quad(
          at(a.y, ra[j]),
          at(a.y, ra[k]),
          at(b.y, rb[k]),
          at(b.y, rb[j]),
          colour,
          inside,
        );
      }
    }

    // End caps in horizontal strips; the strip reaching the centreline
    // collapses to a triangle, whose degenerate half `triangle` drops.
    for (const { y, half } of [first, last]) {
      for (let k = 0; k + 1 < half.length; k++) {
        const [a, b] = [half[k], half[k + 1]];
        this.quad(
          at(y, a),
          at(y, b),
          at(y, [-b[0], b[1], b[2]]),
          at(y, [-a[0], a[1], a[2]]),
          colourAt(y, (a[1] + b[1]) / 2),
          inside,
        );
      }
    }
  }

  /**
   * A flat rectangle on a vehicle's end, centred on x = cx and following the
   * end face `yAt(z)` — which leans when the windscreen is raked — `proud` in
   * front of it. `end` is +1 for the front and -1 for the rear.
   */
  endPanel(
    end: 1 | -1,
    cx: number,
    width: number,
    z0: number,
    z1: number,
    yAt: (z: number) => number,
    proud: number,
    colour: RGB,
  ) {
    const [x0, x1] = [cx - width / 2, cx + width / 2];
    const [y0, y1] = [yAt(z0) + end * proud, yAt(z1) + end * proud];
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], colour, [
      cx,
      y0 - end,
      (z0 + z1) / 2,
    ]);
  }

  /**
   * A flat convex outline of (y, z) points on the plane at x, facing away
   * from the centreline — for arches and other trim laid on a vehicle's side.
   */
  sidePanel(x: number, outline: [number, number][], colour: RGB) {
    const cy = outline.reduce((s, [y]) => s + y, 0) / outline.length;
    const cz = outline.reduce((s, [, z]) => s + z, 0) / outline.length;
    const inside: Vec3 = [x - Math.sign(x), cy, cz];
    for (let i = 0; i < outline.length; i++) {
      const [ya, za] = outline[i];
      const [yb, zb] = outline[(i + 1) % outline.length];
      this.triangle([x, cy, cz], [x, ya, za], [x, yb, zb], colour, inside);
    }
  }

  /** A bar of square section `size` from a to b, at any angle. */
  beam(a: Vec3, b: Vec3, size: number, colour: RGB) {
    const d = sub(b, a);
    const length = Math.hypot(...d);
    if (length < 1e-9) return;
    const dir: Vec3 = [d[0] / length, d[1] / length, d[2] / length];
    const cross = (p: Vec3, q: Vec3): Vec3 => [
      p[1] * q[2] - p[2] * q[1],
      p[2] * q[0] - p[0] * q[2],
      p[0] * q[1] - p[1] * q[0],
    ];
    const reference: Vec3 = Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const c = cross(dir, reference);
    const cl = Math.hypot(...c);
    const u: Vec3 = [c[0] / cl, c[1] / cl, c[2] / cl];
    const v = cross(dir, u);
    const h = size / 2;
    const ring = (p: Vec3): Vec3[] =>
      [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ].map(([s, t]): Vec3 => [
        p[0] + (u[0] * s + v[0] * t) * h,
        p[1] + (u[1] * s + v[1] * t) * h,
        p[2] + (u[2] * s + v[2] * t) * h,
      ]);
    const inside: Vec3 = [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
    ];
    const [ra, rb] = [ring(a), ring(b)];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(ra[i], ra[j], rb[j], rb[i], colour, inside);
    }
    this.quad(ra[0], ra[1], ra[2], ra[3], colour, inside);
    this.quad(rb[0], rb[1], rb[2], rb[3], colour, inside);
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

  build(): VehicleModel {
    const mesh = ({ positions, normals, colors }: Arrays): VehicleMesh => ({
      positions: { value: new Float32Array(positions), size: 3 },
      normals: { value: new Float32Array(normals), size: 3 },
      colors: { value: new Float32Array(colors), size: 3 },
    });
    return {
      body: mesh(this.body),
      sign: mesh(this.sign),
      details: mesh(this.details),
    };
  }
}

type RoadVehicleSpec = {
  length: number;
  width: number;
  height: number;
  windowBottom: number;
  windowTop: number;
  /** Axle positions along y, measured from the vehicle's centre. */
  axles: number[];
};

function roadVehicle(spec: RoadVehicleSpec): VehicleModel {
  const { length: L, width: W, height: H } = spec;
  const body = PAINT;
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

  // Front: windscreen, headlights. Rear: tail lights. Destination signs above
  // the windscreen, above the rear window, and at the top of the glass behind
  // the front door on each side — so one is in view from any angle.
  m.box(0, L / 2, 0.9, W * 0.9, 0.04, spec.windowTop - 0.9, MESH_COLOURS.glass);
  for (const end of [-1, 1]) {
    m.box(
      0,
      end * (L / 2 + 0.03),
      spec.windowTop + 0.05,
      W * 0.7,
      0.03,
      0.25,
      SIGN,
    );
  }
  for (const side of [-1, 1]) {
    // Flush with the body panels; the glass it sits on is inset behind them.
    m.box(
      side * (W / 2 - 0.01),
      L / 2 - 1.8,
      spec.windowTop - 0.35,
      0.02,
      Math.min(1.6, L * 0.2),
      0.3,
      SIGN,
    );
  }
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

type BusSpec = {
  length: number;
  width: number;
  height: number;
  /** Underside of the hull; the underframe and wheels reach below it. */
  bottom: number;
  skirtTop: number;
  windscreenBottom: number;
  windowBottom: number;
  rearWindowBottom: number;
  windowTop: number;
  roofTop: number;
  roofRadius: number;
  /** Radius of the rounded corners in plan. */
  corner: number;
  /** How far the roof drops towards each end. */
  roofDrop: number;
  /** How far the top of the windscreen leans back from its foot. */
  rake: number;
  /** Axle positions along y; axles closer than 2 m share one arch. */
  axles: number[];
  /** Door centres along y, all on the kerb (+x) side. */
  doors: number[];
  doorWidth: number;
  /** The spacing the window pillars aim for. */
  windowPitch: number;
  sideSignY: number;
};

/**
 * What a city bus and a coach have in common: a lofted hull with rounded
 * plan corners and roof edges, a windscreen wrapping round the front corners,
 * glazed doors on the kerb side, arches with the wheels showing in them,
 * window pillars, destination signs, bumpers, plates, wipers and rabbit-ear
 * mirrors. Lamps, grilles, roof equipment and anything else that tells the
 * two apart are left to the caller, which gets the builder back along with
 * the front face's y at a given height.
 *
 * Everything outside the hull stays within a few centimetres of the nominal
 * width and length, so the model remains true to scale.
 */
function busBody(spec: BusSpec): {
  m: MeshBuilder;
  frontY: (z: number) => number;
} {
  const m = new MeshBuilder();
  const { dark, glass } = MESH_COLOURS;
  const { length: L, width: W, bottom, skirtTop, windowTop, corner } = spec;
  const half = W / 2;
  const wheelRadius = 0.5;
  const archRadius = 0.62;

  const frontY = (z: number) =>
    L / 2 -
    spec.rake *
      Math.min(
        1,
        Math.max(
          0,
          (z - spec.windscreenBottom) / (windowTop - spec.windscreenBottom),
        ),
      );

  // One cross-section per station. Towards each end the plan corner turns
  // inward and the roof drops, both along a quarter circle in `theta`; at the
  // front every point also leans back by the rake at its height.
  const heights = [
    ...new Set([
      bottom,
      skirtTop,
      spec.windscreenBottom,
      spec.windowBottom,
      spec.rearWindowBottom,
      windowTop,
    ]),
  ].sort((a, b) => a - b);
  const section = (theta: number, front: boolean): HalfPoint[] => {
    const inset = corner * (1 - Math.cos(theta));
    const drop = spec.roofDrop * (1 - Math.cos(theta));
    const lower = (z: number) =>
      z <= windowTop
        ? z
        : windowTop +
          ((z - windowTop) * (spec.roofTop - drop - windowTop)) /
            (spec.roofTop - windowTop);
    const r = spec.roofRadius;
    const points: [number, number][] = heights.map((z) => [half, z]);
    for (let i = 0; i <= 4; i++) {
      const phi = (i / 4) * (Math.PI / 2);
      points.push([
        half - r + r * Math.cos(phi),
        spec.roofTop - r + r * Math.sin(phi),
      ]);
    }
    points.push([0, spec.roofTop]);
    return points.map(([x, z]) => [
      x === 0 ? 0 : x - inset,
      lower(z),
      front ? frontY(z) - L / 2 : 0,
    ]);
  };
  const angles = [0, 1, 2, 3, 4].map((i) => (i / 4) * (Math.PI / 2));
  const stations = [
    ...[...angles].reverse().map((theta) => ({
      y: -L / 2 + corner - corner * Math.sin(theta),
      half: section(theta, false),
    })),
    ...angles.map((theta) => ({
      y: L / 2 - corner + corner * Math.sin(theta),
      half: section(theta, true),
    })),
  ];
  m.hull(
    stations,
    (y, z) => {
      if (z < skirtTop) return dark;
      const glassFrom =
        y > L / 2 - corner
          ? spec.windscreenBottom
          : y < -L / 2 + corner
            ? spec.rearWindowBottom
            : spec.windowBottom;
      return z > glassFrom && z < windowTop ? glass : PAINT;
    },
    dark,
  );
  m.box(0, 0, bottom - 0.1, W * 0.9, L * 0.9, 0.1, dark);

  // Arches, with each wheel's outer face just proud of its arch so it shows.
  const arches: number[][] = [];
  for (const y of [...spec.axles].sort((a, b) => a - b)) {
    const previous = arches[arches.length - 1];
    if (previous && y - previous[previous.length - 1] < 2) previous.push(y);
    else arches.push([y]);
  }
  for (const axles of arches) {
    const [lo, hi] = [axles[0], axles[axles.length - 1]];
    const arch: [number, number][] = [];
    for (let i = 0; i <= 5; i++) {
      const a = (i / 5) * (Math.PI / 2);
      arch.push([
        hi + Math.cos(a) * archRadius,
        wheelRadius + Math.sin(a) * archRadius,
      ]);
    }
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI / 2 + (i / 5) * (Math.PI / 2);
      arch.push([
        lo + Math.cos(a) * archRadius,
        wheelRadius + Math.sin(a) * archRadius,
      ]);
    }
    arch.push([lo - archRadius, bottom], [hi + archRadius, bottom]);
    for (const side of [-1, 1]) {
      m.sidePanel(side * (half + 0.002), arch, MESH_COLOURS.archLiner);
      for (const y of axles) {
        m.wheel(side * (half + 0.004 - 0.15), y, wheelRadius, 0.3, 20);
      }
    }
  }

  // Doors on the kerb side: two glazed leaves with a rail across each, in a
  // light frame — a dark one vanishes against the glass beside it.
  const { doors, doorWidth } = spec;
  for (const y of doors) {
    m.box(
      half + 0.008,
      y,
      bottom + 0.05,
      0.016,
      doorWidth + 0.05,
      windowTop + 0.02 - bottom - 0.05,
      MESH_COLOURS.doorFrame,
    );
    for (const leaf of [-1, 1]) {
      m.box(
        half + 0.018,
        y + leaf * (doorWidth / 4),
        bottom + 0.1,
        0.004,
        doorWidth / 2 - 0.06,
        windowTop - 0.08 - (bottom + 0.1),
        glass,
      );
      m.box(
        half + 0.021,
        y + leaf * (doorWidth / 4),
        spec.windowBottom - 0.05,
        0.004,
        doorWidth / 2 - 0.06,
        0.06,
        MESH_COLOURS.doorFrame,
      );
    }
  }

  // Window pillars along the straight sides, skipping the doors.
  const span = L - 2 * corner;
  const pillars = Math.round(span / spec.windowPitch);
  for (let i = 0; i <= pillars; i++) {
    const y = -L / 2 + corner + (i * span) / pillars;
    const inDoor = doors.some(
      (door) => Math.abs(y - door) < doorWidth / 2 + 0.1,
    );
    for (const side of [-1, 1]) {
      if (side === 1 && inDoor) continue;
      m.box(
        side * (half + 0.006),
        y,
        spec.windowBottom,
        0.012,
        0.12,
        windowTop - spec.windowBottom,
        PAINT,
      );
    }
  }

  // Destination signs: behind the top of the windscreen and of the rear
  // window, and on the side glass behind the front axle.
  const rearY = () => -L / 2;
  m.endPanel(1, 0, 1.4, windowTop - 0.3, windowTop - 0.04, frontY, 0.02, SIGN);
  m.endPanel(-1, 0, 1.1, windowTop - 0.32, windowTop - 0.06, rearY, 0.02, SIGN);
  for (const side of [-1, 1]) {
    m.box(
      side * (half + 0.01),
      spec.sideSignY,
      windowTop - 0.35,
      0.02,
      1.4,
      0.3,
      SIGN,
    );
  }

  // Bumpers and number plates at both ends; wipers and mirrors at the front.
  m.box(0, L / 2 + 0.02, bottom, 1.7, 0.04, 0.2, dark);
  m.box(0, L / 2 + 0.045, bottom + 0.03, 0.52, 0.01, 0.12, MESH_COLOURS.white);
  m.box(0, -L / 2 - 0.025, bottom, 1.7, 0.05, 0.2, dark);
  m.box(0, -L / 2 - 0.055, bottom + 0.03, 0.52, 0.01, 0.12, MESH_COLOURS.white);
  const wiper = spec.windscreenBottom + 0.05;
  for (const side of [-1, 1]) {
    m.endPanel(1, side * 0.35, 0.6, wiper, wiper + 0.03, frontY, 0.012, dark);

    const armStart = L / 2 - corner - spec.rake;
    const armEnd = L / 2 + 0.12;
    m.box(
      side * (half + 0.01),
      (armStart + armEnd) / 2,
      windowTop - 0.12,
      0.04,
      armEnd - armStart,
      0.04,
      dark,
    );
    m.box(
      side * (half + 0.01),
      L / 2 + 0.1,
      windowTop - 0.6,
      0.04,
      0.04,
      0.52,
      dark,
    );
    m.box(
      side * (half - 0.03),
      L / 2 + 0.1,
      windowTop - 1.0,
      0.12,
      0.05,
      0.42,
      dark,
    );
  }

  return { m, frontY };
}

/**
 * A low-floor city bus: three doors, a flat front with lamps low in the
 * corners, a tall rear lamp cluster either side of the engine grille, and an
 * air-conditioning unit and battery housing on the roof.
 */
function cityBus(L: number, W: number, H: number): VehicleModel {
  const { headlight, taillight, indicator, roofUnit, dark } = MESH_COLOURS;
  const roofTop = H - 0.2;
  const axles = [L / 2 - 2.7, -L / 2 + 3.3];
  const { m } = busBody({
    length: L,
    width: W,
    height: H,
    bottom: 0.35,
    skirtTop: 0.55,
    windscreenBottom: 0.95,
    windowBottom: 1.4,
    rearWindowBottom: 1.9,
    windowTop: 2.7,
    roofTop,
    roofRadius: 0.25,
    corner: 0.45,
    roofDrop: 0.2,
    rake: 0,
    axles,
    doors: [L / 2 - 1.15, 0.4, -L / 2 + 1.7],
    doorWidth: 1.2,
    windowPitch: 1.45,
    sideSignY: axles[0] - 0.1,
  });

  for (const side of [-1, 1]) {
    m.box(side * 0.62, L / 2 + 0.015, 0.62, 0.3, 0.03, 0.16, headlight);
    m.box(side * 0.62, L / 2 + 0.015, 0.82, 0.3, 0.03, 0.06, indicator);
    m.box(side * 0.66, -L / 2 - 0.015, 0.7, 0.22, 0.03, 0.55, taillight);
    m.box(side * 0.66, -L / 2 - 0.015, 1.28, 0.22, 0.03, 0.1, indicator);
  }
  for (let i = 0; i < 5; i++) {
    m.box(0, -L / 2 - 0.01, 0.85 + i * 0.16, 0.9, 0.02, 0.05, dark);
  }

  m.prism(
    [
      [-0.8, 0.8 - 1.4],
      [0.8, 0.8 - 1.4],
      [0.8, 0.8 + 1.4],
      [-0.8, 0.8 + 1.4],
    ],
    roofTop,
    H,
    roofUnit,
    roofUnit,
    1.08,
  );
  m.box(0, -L / 2 + 2.2, roofTop, 1.5, 2.4, 0.14, roofUnit);
  m.box(0, -1.8, roofTop, 0.7, 0.7, 0.03, MESH_COLOURS.hatch);

  return m.build();
}

/**
 * A high-floor coach: one door ahead of the front axle, a raked windscreen
 * over a grille and slim lamp clusters, a tag axle sharing the rear arch,
 * luggage bays between the axles, a small rear window above the engine, and
 * a low air-conditioning hump on the roof.
 */
function coach(L: number, W: number, H: number): VehicleModel {
  const { headlight, taillight, indicator, roofUnit, dark, hub } = MESH_COLOURS;
  const half = W / 2;
  const roofTop = H - 0.14;
  const bottom = 0.4;
  const skirtTop = 0.62;
  const windowBottom = 1.75;
  const axles = [L / 2 - 2.8, -L / 2 + 3.6, -L / 2 + 2.3];
  const { m, frontY } = busBody({
    length: L,
    width: W,
    height: H,
    bottom,
    skirtTop,
    windscreenBottom: 1.1,
    windowBottom,
    rearWindowBottom: 2.4,
    windowTop: 3.05,
    roofTop,
    roofRadius: 0.3,
    corner: 0.4,
    roofDrop: 0.15,
    rake: 0.35,
    axles,
    doors: [L / 2 - 1.25],
    doorWidth: 1.0,
    windowPitch: 2.1,
    sideSignY: axles[0] - 0.5,
  });

  // Front: a grille with a badge between slim lamp clusters, all below the
  // foot of the windscreen, where the front is still upright.
  const front = frontY(0) + 0.015;
  m.box(0, front, 0.68, 0.62, 0.03, 0.28, dark);
  m.box(0, front + 0.01, 0.78, 0.12, 0.03, 0.08, hub);
  for (const side of [-1, 1]) {
    m.box(side * 0.58, front, 0.74, 0.34, 0.03, 0.13, headlight);
    m.box(side * 0.81, front, 0.74, 0.1, 0.03, 0.13, indicator);
  }

  // Rear: tall lamp clusters either side of a wide engine grille.
  for (const side of [-1, 1]) {
    m.box(side * 0.7, -L / 2 - 0.015, 0.8, 0.2, 0.03, 0.62, taillight);
    m.box(side * 0.7, -L / 2 - 0.015, 1.46, 0.2, 0.03, 0.1, indicator);
  }
  for (let i = 0; i < 7; i++) {
    m.box(0, -L / 2 - 0.01, 0.85 + i * 0.17, 1.1, 0.02, 0.05, dark);
  }

  // Luggage bays between the front arch and the rear pair: seams and a
  // handle per bay, on both sides.
  const archRadius = 0.62;
  const baysFrom = axles[1] + archRadius + 0.3;
  const baysTo = axles[0] - archRadius - 0.3;
  const bays = 3;
  const seamTop = windowBottom - 0.15;
  for (const side of [-1, 1]) {
    const x = side * (half + 0.004);
    for (let i = 0; i <= bays; i++) {
      const y = baysFrom + (i * (baysTo - baysFrom)) / bays;
      m.box(x, y, skirtTop, 0.008, 0.025, seamTop - skirtTop, dark);
    }
    m.box(
      x,
      (baysFrom + baysTo) / 2,
      seamTop,
      0.008,
      baysTo - baysFrom,
      0.025,
      dark,
    );
    for (let i = 0; i < bays; i++) {
      const y = baysFrom + ((i + 0.5) * (baysTo - baysFrom)) / bays;
      m.box(side * (half + 0.006), y, 0.85, 0.012, 0.2, 0.04, hub);
    }
  }

  m.prism(
    [
      [-0.8, 0.5 - 2],
      [0.8, 0.5 - 2],
      [0.8, 0.5 + 2],
      [-0.8, 0.5 + 2],
    ],
    roofTop,
    H,
    roofUnit,
    roofUnit,
    1.12,
  );
  for (const y of [L / 2 - 2.6, -L / 2 + 3]) {
    m.box(0, y, roofTop, 0.7, 0.7, 0.03, MESH_COLOURS.hatch);
  }

  return m.build();
}

type RailVehicleSpec = {
  cars: number;
  length: number;
  width: number;
  height: number;
  floor: number;
  windowBottom: number;
  windowTop: number;
  pantographOnCar?: number;
};

/**
 * An articulated electric multiple unit of the kind most Norwegian regional
 * and local trains are: cars on shared (Jacobs) bogies at each joint, a cab at
 * both ends whose nose narrows and whose roof slopes down into a wrapped
 * windscreen, sliding doors on both sides, underfloor equipment, roof units
 * and a diamond pantograph. The front cab shows headlights and the rear cab
 * tail lights, so heading reads from either end.
 */
function train(L: number, W: number, H: number): VehicleModel {
  const m = new MeshBuilder();
  const { dark, glass, hub, headlight, taillight, roofUnit, doorFrame } =
    MESH_COLOURS;
  const half = W / 2;
  const cars = 4;
  const gap = 0.5;
  const carLength = (L - gap * (cars - 1)) / cars;
  const bottom = 0.9;
  const skirtTop = 1.15;
  const windscreenBottom = 1.9;
  const windowBottom = 1.95;
  const windowTop = 3.0;
  const roofTop = H - 0.75;
  const roofRadius = 0.4;
  const noseLength = 3;
  const noseInset = 0.55;
  /** Height kept above the windscreen's foot at the very tip, as a fraction. */
  const tipScale = 0.4;
  const tipTop = windscreenBottom + (roofTop - windscreenBottom) * tipScale;
  const cab = noseLength + 1.4;

  // A cross-section `theta` of the way along a nose (0 where it starts): the
  // plan narrows and everything above the windscreen's foot is lowered, both
  // along a quarter circle.
  const section = (theta: number): HalfPoint[] => {
    const inset = noseInset * (1 - Math.cos(theta));
    const scale = 1 - (1 - tipScale) * (1 - Math.cos(theta));
    const lower = (z: number) =>
      z <= windscreenBottom
        ? z
        : windscreenBottom + (z - windscreenBottom) * scale;
    const points: [number, number][] = [
      bottom,
      skirtTop,
      windscreenBottom,
      windowBottom,
      windowTop,
    ].map((z) => [half, z]);
    for (let i = 0; i <= 4; i++) {
      const phi = (i / 4) * (Math.PI / 2);
      points.push([
        half - roofRadius + roofRadius * Math.cos(phi),
        roofTop - roofRadius + roofRadius * Math.sin(phi),
      ]);
    }
    points.push([0, roofTop]);
    return points.map(([x, z]) => [x === 0 ? 0 : x - inset, lower(z)]);
  };
  const angles = [0, 1, 2, 3, 4, 5].map((i) => (i / 5) * (Math.PI / 2));
  const rect = (
    y: number,
    length: number,
    z0: number,
    z1: number,
  ): [number, number][] => [
    [y - length / 2, z0],
    [y + length / 2, z0],
    [y + length / 2, z1],
    [y - length / 2, z1],
  ];

  const doors: { y: number; width: number }[] = [];
  for (let car = 0; car < cars; car++) {
    const y0 = -L / 2 + car * (carLength + gap);
    const y1 = y0 + carLength;
    const cy = (y0 + y1) / 2;
    const rearCab = car === 0;
    const frontCab = car === cars - 1;

    const stations = [
      ...(rearCab
        ? [...angles].reverse().map((theta) => ({
            y: y0 + noseLength - noseLength * Math.sin(theta),
            half: section(theta),
          }))
        : [{ y: y0, half: section(0) }]),
      ...(frontCab
        ? angles.map((theta) => ({
            y: y1 - noseLength + noseLength * Math.sin(theta),
            half: section(theta),
          }))
        : [{ y: y1, half: section(0) }]),
    ];
    m.hull(
      stations,
      (y, z) => {
        if (z < skirtTop) return dark;
        const fromEnd = L / 2 - Math.abs(y);
        if (fromEnd < noseLength) {
          // The windscreen: all of the nose's upper half, and the upper
          // nose's shoulders below the roof crown further back.
          const along = 1 - fromEnd / noseLength;
          if (z > windscreenBottom && (along > 0.5 || z < roofTop - 0.35)) {
            return glass;
          }
          if (along > 0.5) return PAINT;
        } else if (Math.abs(Math.abs(y - cy) - carLength / 2) < 1e-6) {
          // The inner end faces, mostly hidden by the gangway.
          return PAINT;
        }
        return z > windowBottom && z < windowTop ? glass : PAINT;
      },
      dark,
    );

    // Passenger doors, measured from the tip in a cab car.
    if (rearCab || frontCab) {
      const end = frontCab ? 1 : -1;
      for (const fromTip of [9.5, 15]) {
        doors.push({ y: end * (L / 2 - fromTip), width: 1.3 });
      }
      doors.push({ y: end * (L / 2 - (noseLength + 0.9)), width: 0.7 });
    } else {
      for (const offset of [-1, 1]) {
        doors.push({ y: cy + offset * carLength * 0.25, width: 1.3 });
      }
    }

    // Underfloor equipment and a roof unit; the pantograph car's unit moves
    // aside for it.
    m.box(
      0,
      rearCab ? cy + 1 : frontCab ? cy - 1 : cy,
      bottom - 0.45,
      W * 0.72,
      carLength * (rearCab || frontCab ? 0.4 : 0.5),
      0.45,
      dark,
    );
    m.box(0, car === 1 ? cy + 4.5 : cy, roofTop, 1.5, 3.2, 0.28, roofUnit);

    // Gangway bellows to the next car, over the shared bogie.
    if (car < cars - 1) {
      m.box(
        0,
        y1 + gap / 2,
        bottom + 0.1,
        W * 0.85,
        gap + 0.1,
        roofTop - 0.15 - (bottom + 0.1),
        dark,
      );
    }

    // Window pillars, clear of the cabs and the doors.
    const pillars = Math.round((carLength - 0.8) / 2.3);
    for (let i = 0; i <= pillars; i++) {
      const y = y0 + 0.4 + (i * (carLength - 0.8)) / pillars;
      if (L / 2 - Math.abs(y) < cab) continue;
      if (doors.some((door) => Math.abs(y - door.y) < door.width / 2 + 0.15)) {
        continue;
      }
      for (const side of [-1, 1]) {
        m.sidePanel(
          side * (half + 0.004),
          rect(y, 0.14, windowBottom, windowTop),
          PAINT,
        );
      }
    }
  }

  // Doors: a light panel, glazed above, split down the middle when double.
  for (const { y, width } of doors) {
    for (const side of [-1, 1]) {
      const x = side * half;
      m.sidePanel(
        x + side * 0.006,
        rect(y, width, bottom + 0.05, windowTop + 0.05),
        doorFrame,
      );
      if (width > 1) {
        for (const leaf of [-1, 1]) {
          m.sidePanel(
            x + side * 0.01,
            rect(
              y + (leaf * width) / 4,
              width / 2 - 0.16,
              1.55,
              windowTop - 0.12,
            ),
            glass,
          );
        }
        m.sidePanel(
          x + side * 0.012,
          rect(y, 0.03, bottom + 0.05, windowTop + 0.05),
          dark,
        );
      } else {
        m.sidePanel(
          x + side * 0.01,
          rect(y, width - 0.2, windowBottom, windowTop - 0.12),
          glass,
        );
      }
    }
  }

  // Bogies: one under each cab, and one shared at every joint.
  const bogies = [-L / 2 + 3.4, L / 2 - 3.4];
  for (let car = 0; car < cars - 1; car++) {
    bogies.push(-L / 2 + car * (carLength + gap) + carLength + gap / 2);
  }
  for (const y of bogies) {
    m.box(0, y, 0.62, 1.8, 0.5, 0.2, dark);
    for (const side of [-1, 1]) {
      m.box(side * 0.98, y, 0.32, 0.14, 3.4, 0.4, dark);
      for (const axle of [-1.35, 1.35]) {
        m.wheel(side * 0.75, y + axle, 0.43, 0.14, 12);
        m.box(side * 1.08, y + axle, 0.3, 0.1, 0.35, 0.26, hub);
      }
    }
  }

  // Each end: lamps in an A (head at the front, tail at the rear), a
  // coupler, an obstacle deflector, and destination signs on the end and
  // on both sides of the cab car.
  for (const end of [-1, 1]) {
    const lamp = end === 1 ? headlight : taillight;
    const face = end * (L / 2 + 0.015);
    for (const side of [-1, 1]) {
      m.box(side * 0.68, face, 1.28, 0.42, 0.03, 0.2, lamp);
      m.box(
        side * (half + 0.01),
        end * (L / 2 - 6.2),
        windowTop - 0.35,
        0.02,
        2,
        0.3,
        SIGN,
      );
    }
    m.box(0, face, 1.62, 0.3, 0.03, 0.14, lamp);
    m.box(0, end * (L / 2 + 0.175), 0.85, 0.35, 0.35, 0.3, dark);
    m.box(0, end * (L / 2 - 0.55), 0.4, 1.9, 0.5, 0.5, dark);
    m.box(0, face, tipTop - 0.32, 1.2, 0.03, 0.25, SIGN);
  }

  // A diamond pantograph on the second car, standing on two insulators.
  const py = -L / 2 + (carLength + gap) + carLength / 2 - 2;
  for (const dy of [-0.5, 0.5]) {
    m.box(0, py + dy, roofTop, 0.22, 0.22, 0.2, MESH_COLOURS.hatch);
  }
  m.box(0, py, roofTop + 0.2, 0.9, 1.3, 0.06, dark);
  const base = roofTop + 0.26;
  const head = H - 0.07;
  const knee: [number, number] = [py + 0.7, (base + head) / 2];
  for (const x of [-0.28, 0.28]) {
    m.beam([x, py - 0.6, base], [x, knee[0], knee[1]], 0.08, dark);
    m.beam([x, knee[0], knee[1]], [x, py - 0.3, head - 0.03], 0.06, dark);
  }
  m.box(0, py - 0.3, head, 1.8, 0.14, 0.07, hub);

  return m.build();
}

/** Cars of equal length separated by dark gangways, on bogies. */
function railVehicle(spec: RailVehicleSpec): VehicleModel {
  const { length: L, width: W, height: H, cars } = spec;
  const body = PAINT;
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

  // Cab ends: windscreens and destination signs both ends, a side sign on the
  // cab car each side, headlights in front, tail lights behind.
  for (const end of [-1, 1]) {
    m.box(
      0,
      end * (L / 2 + 0.03),
      spec.windowTop + 0.05,
      W * 0.6,
      0.03,
      0.25,
      SIGN,
    );
    for (const side of [-1, 1]) {
      m.box(
        side * (W / 2 - 0.01),
        end * (L / 2 - 3),
        spec.windowTop - 0.35,
        0.02,
        2,
        0.3,
        SIGN,
      );
    }
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

function ferry(length: number, width: number, height: number): VehicleModel {
  const hull = PAINT;
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

function buildModelFor(mode: VehicleModeEnumeration): VehicleModel {
  const { length, width, height } = dimensionsFor(mode);
  switch (mode) {
    case "BUS":
      return cityBus(length, width, height);
    case "COACH":
      return coach(length, width, height);
    case "TRAM":
      return railVehicle({
        cars: 3,
        length,
        width,
        height,
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
        floor: 1.0,
        windowBottom: 1.8,
        windowTop: 2.85,
      });
    case "RAIL":
      return train(length, width, height);
    case "FERRY":
      return ferry(length, width, height);
    default:
      return roadVehicle({
        length,
        width,
        height,
        windowBottom: 1.2,
        windowTop: 2.2,
        axles: [length / 2 - 1.6, -length / 2 + 1.6],
      });
  }
}

const modelCache = new Map<VehicleModeEnumeration, VehicleModel>();

/** The model for a mode, built once and shared by every vehicle of that mode. */
export function modelFor(mode: VehicleModeEnumeration): VehicleModel {
  let model = modelCache.get(mode);
  if (!model) {
    model = buildModelFor(mode);
    modelCache.set(mode, model);
  }
  return model;
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
    m.prism(outline, 0, 1, PAINT, PAINT);
    unknownHeadingMesh = m.build().body;
  }
  return unknownHeadingMesh;
}

/** A mode's default body colour as 0–255 RGB, for the renderer's `getColor`. */
export function bodyColourFor(
  mode: VehicleModeEnumeration,
): [number, number, number] {
  return to255(BODY_COLOURS[mode] ?? DEFAULT_BODY);
}
