import type { ViewBounds } from "./vehiclesInView.ts";

/**
 * Where the seasonal pumpkins stand: one to three at every stop, at random but
 * the same every time, clear of traffic and buildings. Pure, so it is tested
 * without a map; `usePumpkins` feeds it the stops, roads and buildings it
 * reads from the base map's tiles.
 *
 * The randomness is seeded from the stop's own position, so a stop gets the
 * same pumpkins on every load and every pan. Geometry
 * is worked in metres on a flat plane around each stop, which is exact enough
 * across the 15 m a pumpkin may stand from it.
 */

type LngLat = [number, number];

export type Pumpkin = {
  /** Stable across rebuilds: the stop's key and the pumpkin's number there. */
  key: string;
  position: LngLat;
  /** Metres; the mesh is one unit tall. */
  height: number;
  /** Degrees clockwise from north. */
  yaw: number;
  /** 0–255 RGB, multiplied into the white body. */
  tint: [number, number, number];
};

/** A line from the base map's `transportation` layer. */
export type TrafficLine = { class: string; coordinates: LngLat[] };

/** A building footprint's outer ring. */
export type BuildingRing = LngLat[];

type CachedStop = { signature: string; pumpkins: Pumpkin[] };

/** Each stop's pumpkins from the last build, by `stopKey`; see `pumpkinsInView`. */
export type PumpkinCache = Map<string, CachedStop>;

/**
 * Half the width of the carriageway or track, from the centre line, per
 * `transportation` class: the tiles carry centre lines but no widths. A ferry
 * line counts, with room for the boat, so a quay's stop does not crowd its
 * berth; water itself is kept clear by `usePumpkins`, which passes water
 * areas in with the buildings. A class not listed — path, track, pedestrian,
 * aerialway — is not traffic: no vehicle in the feed drives there, and
 * counting footways and cycleways would leave a city centre with no pumpkins.
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

/** How far beyond the estimated edge of traffic a pumpkin's footprint keeps. */
export const CLEARANCE_M = 1.5;
/** The most pumpkins built for one view. */
export const PUMPKIN_CAP = 200;
/** A pumpkin's width over its height; the mesh is built to it. */
export const PUMPKIN_ASPECT = 1.3;
/** How far from the chased vehicle no pumpkin is drawn, so none hides it. */
export const CHASE_CLEARANCE_M = 40;

const MAX_PER_STOP = 3;
const HEIGHT_M = [2, 3] as const;
const SPREAD_M = [3, 15] as const;
/**
 * Spots tried per pumpkin before it is left out. In a city centre most spots
 * are in a building or a road; at 8, Bergen sentrum got none at all.
 */
const CANDIDATES = 24;
const TINTS: [number, number, number][] = [
  [0xd9, 0x62, 0x0b],
  [0xf2, 0x8c, 0x28],
];

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

/** mulberry32: small, fast and good enough to scatter pumpkins. */
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
 * How far from a stop an obstacle can matter: the farthest a pumpkin stands,
 * its widest footprint, and the widest road with its clearance.
 */
const REACH_M =
  SPREAD_M[1] +
  (PUMPKIN_ASPECT * HEIGHT_M[1]) / 2 +
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

  /** The obstacles in the cells within `REACH_M` of the stop, each once. */
  near([lng, lat]: LngLat): T[] {
    const dLng = REACH_M / mPerDegLng(lat);
    const dLat = REACH_M / M_PER_DEG_LAT;
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
 * The pumpkins at one stop: one to three, each tried at up to `CANDIDATES`
 * spots and left out when none is clear. Every pumpkin takes the same number of random draws whether or not
 * a spot is found, so one blocked pumpkin does not move the next.
 */
export function pumpkinsAtStop(
  stop: LngLat,
  traffic: TrafficLine[],
  buildings: BuildingRing[],
): Pumpkin[] {
  const key = stopKey(stop);
  const random = seededRandom(hash(key));
  const count = 1 + Math.floor(random() * MAX_PER_STOP);

  const [lng0, lat0] = stop;
  const xScale = mPerDegLng(lat0);
  const toXY = ([lng, lat]: LngLat): XY => [
    (lng - lng0) * xScale,
    (lat - lat0) * M_PER_DEG_LAT,
  ];
  // Only what can reach a spot: segments and rings whose box comes within
  // REACH_M of the stop. The grid's cells are far larger than that.
  const nearBox = (xs: number[], ys: number[]) =>
    Math.min(...xs) <= REACH_M &&
    Math.max(...xs) >= -REACH_M &&
    Math.min(...ys) <= REACH_M &&
    Math.max(...ys) >= -REACH_M;
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
  const pumpkins: Pumpkin[] = [];
  for (let i = 0; i < count; i++) {
    const height = lerp(HEIGHT_M[0], HEIGHT_M[1], random());
    const yaw = random() * 360;
    const t = random();
    const tint = TINTS[0].map((c, k) =>
      Math.round(lerp(c, TINTS[1][k], t)),
    ) as [number, number, number];
    const radius = (PUMPKIN_ASPECT * height) / 2;

    let found: XY | null = null;
    for (let c = 0; c < CANDIDATES; c++) {
      const distance = lerp(SPREAD_M[0], SPREAD_M[1], random());
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
    pumpkins.push({
      key: `${key}#${i}`,
      position: [lng0 + found[0] / xScale, lat0 + found[1] / M_PER_DEG_LAT],
      height,
      yaw,
      tint,
    });
  }
  return pumpkins;
}

/**
 * The pumpkins for a view: each stop once (a stop in two loaded tiles is
 * returned by both), only stops inside `view`, nearest the view's centre
 * first so the cap keeps what is in front of the camera, at most
 * `PUMPKIN_CAP`. `avoid` leaves out any within its radius of a point — the
 * chased vehicle.
 *
 * `cache`, kept by the caller from one build to the next, saves placing a
 * stop again while the obstacles near it are the same — between two builds,
 * a pan or a chase's second, most stops are. "The same" is judged by how
 * many lines and rings are near the stop and how many points they have: the
 * tiles return new objects every time, so identity says nothing. Stops not
 * in this build are dropped from it.
 */
export function pumpkinsInView(
  stops: LngLat[],
  traffic: TrafficLine[],
  buildings: BuildingRing[],
  view: ViewBounds,
  options: {
    avoid?: { position: LngLat; radiusM: number };
    cache?: PumpkinCache;
  } = {},
): Pumpkin[] {
  const [[west, south], [eastEdge, northEdge]] = view;
  const centre: LngLat = [(west + eastEdge) / 2, (south + northEdge) / 2];
  const xScale = mPerDegLng(centre[1]);
  const metresFrom = (from: LngLat, [lng, lat]: LngLat) =>
    Math.hypot((lng - from[0]) * xScale, (lat - from[1]) * M_PER_DEG_LAT);

  // A view's tiles hold thousands of roads and buildings; checking each
  // candidate spot against only those near its stop took a city-centre view
  // from about 380 ms to a few.
  // Only obstacles that can reach a stop in view matter.
  const padLng = REACH_M / Math.min(mPerDegLng(south), mPerDegLng(northEdge));
  const padLat = REACH_M / M_PER_DEG_LAT;
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

  const { avoid, cache } = options;
  const used = new Map<string, CachedStop>();
  const pumpkins: Pumpkin[] = [];
  for (const { stop } of nearestFirst) {
    if (pumpkins.length >= PUMPKIN_CAP) break;
    const nearTraffic = trafficGrid.near(stop);
    const nearBuildings = buildingGrid.near(stop);
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
            pumpkins: pumpkinsAtStop(stop, nearTraffic, nearBuildings),
          };
    used.set(key, entry);
    pumpkins.push(...entry.pumpkins);
  }
  if (cache) {
    cache.clear();
    for (const [key, entry] of used) cache.set(key, entry);
  }
  const capped = pumpkins.slice(0, PUMPKIN_CAP);
  return avoid
    ? capped.filter(
        (p) => metresFrom(avoid.position, p.position) >= avoid.radiusM,
      )
    : capped;
}
