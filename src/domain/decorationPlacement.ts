import type { Season } from "./season.ts";
import type { ViewBounds } from "./vehiclesInView.ts";

/**
 * Where a season's decorations stand: a few at every stop, at random but the
 * same every time, clear of traffic and buildings. Pure, so it is tested
 * without a map; `usePumpkins` feeds it the stops, roads and buildings it
 * reads from the base map's tiles.
 *
 * The randomness is seeded from the stop's own position, so a stop gets the
 * same decorations on every load and every pan. Geometry
 * is worked in metres on a flat plane around each stop, which is exact enough
 * across the 15 m a decoration may stand from it.
 */

type LngLat = [number, number];

export type Decoration = {
  /** Stable across rebuilds: the stop's key and the decoration's number there. */
  key: string;
  position: LngLat;
  /** Metres; the mesh is one unit tall. */
  height: number;
  /** Degrees clockwise from north. */
  yaw: number;
  /** 0–255 RGB, multiplied into the white body. */
  tint: [number, number, number];
  /** 0–1, from the key's hash, not the random stream; drives the twinkle. */
  phase: number;
};

/** What a season puts at a stop, and how big. */
export type DecorationSpec = {
  /** How many at one stop, inclusive, when every one finds a clear spot. */
  perStop: [min: number, max: number];
  /** Metres, from the lowest to the tallest. */
  heightM: [number, number];
  /** Footprint diameter over height: the widest point. */
  aspect: number;
  /** Metres from the stop, nearest to farthest. */
  spreadM: [number, number];
  /**
   * Spots tried per decoration before it is left out. In a city centre most
   * spots are in a building or a road; at 8, Bergen sentrum got none at all.
   */
  candidates: number;
  /** 0–255 RGB; each decoration's tint is drawn between the two. */
  tints: [[number, number, number], [number, number, number]];
};

/** A line from the base map's `transportation` layer. */
export type TrafficLine = { class: string; coordinates: LngLat[] };

/** A building footprint's outer ring. */
export type BuildingRing = LngLat[];

type CachedStop = { signature: string; decorations: Decoration[] };

/** Each stop's decorations from the last build, by `stopKey`; see `decorationsInView`. */
export type DecorationCache = Map<string, CachedStop>;

/**
 * Half the width of the carriageway or track, from the centre line, per
 * `transportation` class: the tiles carry centre lines but no widths. A ferry
 * line counts, with room for the boat, so a quay's stop does not crowd its
 * berth; water itself is kept clear by `usePumpkins`, which passes water
 * areas in with the buildings. A class not listed — path, track, pedestrian,
 * aerialway — is not traffic: no vehicle in the feed drives there, and
 * counting footways and cycleways would leave a city centre with no decorations.
 */
export const TRAFFIC_HALF_WIDTH_M: Record<string, number> = {
  motorway: 7,
  trunk: 7,
  primary: 7,
  secondary: 5,
  tertiary: 5,
  minor: 3.5,
  service: 3.5,
  busway: 3.5,
  rail: 2.5,
  transit: 2.5,
  ferry: 10,
};

/**
 * How far beyond the estimated edge of traffic a decoration's footprint keeps,
 * measured from its widest point.
 */
export const CLEARANCE_M = 1.5;
/** The most decorations built for one view. */
export const DECORATION_CAP = 200;
/** A pumpkin's width over its height; the mesh is built to it. */
export const PUMPKIN_ASPECT = 1.3;
/** A tree's widest canopy over its height; the mesh is built to it. */
export const TREE_ASPECT = 0.55;

/** Each season's decorations. */
export const DECORATIONS: Record<Season, DecorationSpec> = {
  halloween: {
    perStop: [1, 3],
    heightM: [2, 3],
    aspect: PUMPKIN_ASPECT,
    spreadM: [3, 15],
    candidates: 24,
    tints: [
      [0xd9, 0x62, 0x0b],
      [0xf2, 0x8c, 0x28],
    ],
  },
  christmas: {
    perStop: [1, 1],
    heightM: [4, 5],
    aspect: TREE_ASPECT,
    spreadM: [3, 15],
    candidates: 24,
    tints: [
      [0x2e, 0x6b, 0x3a],
      [0x3f, 0x7d, 0x45],
    ],
  },
};

const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** The stop's identity: its position to about a metre. */
export function stopKey([lng, lat]: LngLat): string {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

/** FNV-1a, 32 bits. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast and good enough to scatter decorations. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type XY = [number, number];

function distanceToSegment([px, py]: XY, [ax, ay]: XY, [bx, by]: XY) {
  const [dx, dy] = [bx - ax, by - ay];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
        );
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function inside([px, py]: XY, ring: XY[]) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      within = !within;
  }
  return within;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * How far from a stop an obstacle can matter: the farthest a decoration
 * stands, its widest footprint, and the widest road with its clearance.
 */
const reachOf = (spec: DecorationSpec) =>
  spec.spreadM[1] +
  (spec.aspect * spec.heightM[1]) / 2 +
  Math.max(...Object.values(TRAFFIC_HALF_WIDTH_M)) +
  CLEARANCE_M;

function boxOf(points: LngLat[]) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of points) {
    w = Math.min(w, lng);
    s = Math.min(s, lat);
    e = Math.max(e, lng);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

/** Grid cells, in degrees, for finding obstacles near a stop quickly. */
const CELL_DEG = 0.001;

/**
 * Obstacles bucketed by every grid cell their bounding box covers, so the
 * ones near a stop are found without looking at all of them. Only cells
 * inside `clip` are filled: in 3D the loaded tiles reach the horizon, where a
 * low-zoom tile's ferry line or motorway can span degrees — millions of
 * cells, which overflowed the Map and took the app down.
 */
class Grid<T> {
  private readonly cells = new Map<string, T[]>();

  constructor(
    items: T[],
    pointsOf: (item: T) => LngLat[],
    [clipW, clipS, clipE, clipN]: [number, number, number, number],
  ) {
    for (const item of items) {
      const [w, s, e, n] = boxOf(pointsOf(item));
      if (e < clipW || w > clipE || n < clipS || s > clipN) continue;
      const [x0, x1] = [
        Math.floor(Math.max(w, clipW) / CELL_DEG),
        Math.floor(Math.min(e, clipE) / CELL_DEG),
      ];
      const [y0, y1] = [
        Math.floor(Math.max(s, clipS) / CELL_DEG),
        Math.floor(Math.min(n, clipN) / CELL_DEG),
      ];
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const key = `${x},${y}`;
          const cell = this.cells.get(key);
          if (cell) cell.push(item);
          else this.cells.set(key, [item]);
        }
    }
  }

  /** The obstacles in the cells within `reach` metres of the stop, each once. */
  near([lng, lat]: LngLat, reach: number): T[] {
    const dLng = reach / mPerDegLng(lat);
    const dLat = reach / M_PER_DEG_LAT;
    const found = new Set<T>();
    for (
      let x = Math.floor((lng - dLng) / CELL_DEG);
      x <= Math.floor((lng + dLng) / CELL_DEG);
      x++
    )
      for (
        let y = Math.floor((lat - dLat) / CELL_DEG);
        y <= Math.floor((lat + dLat) / CELL_DEG);
        y++
      )
        for (const item of this.cells.get(`${x},${y}`) ?? []) found.add(item);
    return [...found];
  }
}

/**
 * The decorations at one stop: `spec.perStop` of them, each tried at up to
 * `spec.candidates` spots and left out when none is clear. Every decoration
 * takes the same number of random draws whether or not a spot is found, so
 * one blocked decoration does not move the next.
 */
export function decorationsAtStop(
  spec: DecorationSpec,
  stop: LngLat,
  traffic: TrafficLine[],
  buildings: BuildingRing[],
): Decoration[] {
  const { perStop, heightM, aspect, spreadM, candidates, tints } = spec;
  const reach = reachOf(spec);
  const key = stopKey(stop);
  const random = seededRandom(hash(key));
  const count =
    perStop[0] + Math.floor(random() * (perStop[1] - perStop[0] + 1));

  const [lng0, lat0] = stop;
  const xScale = mPerDegLng(lat0);
  const toXY = ([lng, lat]: LngLat): XY => [
    (lng - lng0) * xScale,
    (lat - lat0) * M_PER_DEG_LAT,
  ];
  // Only what can reach a spot: segments and rings whose box comes within
  // reach of the stop. The grid's cells are far larger than that.
  const nearBox = (xs: number[], ys: number[]) =>
    Math.min(...xs) <= reach &&
    Math.max(...xs) >= -reach &&
    Math.min(...ys) <= reach &&
    Math.max(...ys) >= -reach;
  const segments: { halfWidth: number; a: XY; b: XY }[] = [];
  for (const line of traffic) {
    const halfWidth = TRAFFIC_HALF_WIDTH_M[line.class];
    if (halfWidth === undefined) continue;
    const points = line.coordinates.map(toXY);
    for (let k = 1; k < points.length; k++) {
      const [a, b] = [points[k - 1], points[k]];
      if (nearBox([a[0], b[0]], [a[1], b[1]]))
        segments.push({ halfWidth, a, b });
    }
  }
  const rings = buildings
    .map((ring) => ring.map(toXY))
    .filter((ring) =>
      nearBox(
        ring.map((p) => p[0]),
        ring.map((p) => p[1]),
      ),
    );

  const placed: { xy: XY; radius: number }[] = [];
  const decorations: Decoration[] = [];
  for (let i = 0; i < count; i++) {
    const height = lerp(heightM[0], heightM[1], random());
    const yaw = random() * 360;
    const t = random();
    const tint = tints[0].map((c, k) =>
      Math.round(lerp(c, tints[1][k], t)),
    ) as [number, number, number];
    const radius = (aspect * height) / 2;

    let found: XY | null = null;
    for (let c = 0; c < candidates; c++) {
      const distance = lerp(spreadM[0], spreadM[1], random());
      const angle = random() * 2 * Math.PI;
      const xy: XY = [distance * Math.sin(angle), distance * Math.cos(angle)];
      if (found) continue;
      const inTraffic = segments.some(
        ({ halfWidth, a, b }) =>
          distanceToSegment(xy, a, b) < halfWidth + CLEARANCE_M + radius,
      );
      const inBuilding = rings.some(
        (ring) =>
          inside(xy, ring) ||
          ring.some(
            (a, k) => k > 0 && distanceToSegment(xy, ring[k - 1], a) < radius,
          ),
      );
      const onAnother = placed.some(
        (other) =>
          Math.hypot(xy[0] - other.xy[0], xy[1] - other.xy[1]) <
          radius + other.radius,
      );
      if (!inTraffic && !inBuilding && !onAnother) found = xy;
    }
    if (!found) continue;
    placed.push({ xy: found, radius });
    const decorationKey = `${key}#${i}`;
    decorations.push({
      key: decorationKey,
      position: [lng0 + found[0] / xScale, lat0 + found[1] / M_PER_DEG_LAT],
      height,
      yaw,
      tint,
      // From the key, so the random stream — and every spot — is untouched.
      phase: hash(decorationKey) / 2 ** 32,
    });
  }
  return decorations;
}

/**
 * The decorations for a view: each stop once (a stop in two loaded tiles is
 * returned by both), only stops inside `view`, nearest the view's centre
 * first so the cap keeps what is in front of the camera, at most
 * `DECORATION_CAP`.
 *
 * `cache`, kept by the caller from one build to the next, saves placing a
 * stop again while the obstacles near it are the same — between two builds,
 * a pan or a chase's second, most stops are. "The same" is judged by how
 * many lines and rings are near the stop and how many points they have: the
 * tiles return new objects every time, so identity says nothing. Stops not
 * in this build are dropped from it.
 */
export function decorationsInView(
  spec: DecorationSpec,
  stops: LngLat[],
  traffic: TrafficLine[],
  buildings: BuildingRing[],
  view: ViewBounds,
  options: { cache?: DecorationCache } = {},
): Decoration[] {
  const reach = reachOf(spec);
  const [[west, south], [eastEdge, northEdge]] = view;
  const centre: LngLat = [(west + eastEdge) / 2, (south + northEdge) / 2];
  const xScale = mPerDegLng(centre[1]);
  const metresFrom = (from: LngLat, [lng, lat]: LngLat) =>
    Math.hypot((lng - from[0]) * xScale, (lat - from[1]) * M_PER_DEG_LAT);

  // A view's tiles hold thousands of roads and buildings; checking each
  // candidate spot against only those near its stop took a city-centre view
  // from about 380 ms to a few.
  // Only obstacles that can reach a stop in view matter.
  const padLng = reach / Math.min(mPerDegLng(south), mPerDegLng(northEdge));
  const padLat = reach / M_PER_DEG_LAT;
  const clip: [number, number, number, number] = [
    west - padLng,
    south - padLat,
    eastEdge + padLng,
    northEdge + padLat,
  ];
  const trafficGrid = new Grid(
    traffic.filter((line) => line.class in TRAFFIC_HALF_WIDTH_M),
    (line) => line.coordinates,
    clip,
  );
  const buildingGrid = new Grid(buildings, (ring) => ring, clip);

  const unique = new Map<string, LngLat>();
  for (const stop of stops) {
    const [lng, lat] = stop;
    if (lng < west || lng > eastEdge || lat < south || lat > northEdge)
      continue;
    unique.set(stopKey(stop), stop);
  }
  const nearestFirst = [...unique.values()]
    .map((stop) => ({ stop, distance: metresFrom(centre, stop) }))
    .sort((a, b) => a.distance - b.distance);

  const { cache } = options;
  const used = new Map<string, CachedStop>();
  const decorations: Decoration[] = [];
  for (const { stop } of nearestFirst) {
    if (decorations.length >= DECORATION_CAP) break;
    const nearTraffic = trafficGrid.near(stop, reach);
    const nearBuildings = buildingGrid.near(stop, reach);
    const signature = [
      nearTraffic.length,
      nearTraffic.reduce((n, line) => n + line.coordinates.length, 0),
      nearBuildings.length,
      nearBuildings.reduce((n, ring) => n + ring.length, 0),
    ].join(",");
    const key = stopKey(stop);
    const cached = cache?.get(key);
    const entry =
      cached?.signature === signature
        ? cached
        : {
            signature,
            decorations: decorationsAtStop(
              spec,
              stop,
              nearTraffic,
              nearBuildings,
            ),
          };
    used.set(key, entry);
    decorations.push(...entry.decorations);
  }
  if (cache) {
    cache.clear();
    for (const [key, entry] of used) cache.set(key, entry);
  }
  return decorations.slice(0, DECORATION_CAP);
}
