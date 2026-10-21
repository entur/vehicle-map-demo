import { describe, expect, it } from "vitest";
import {
  BuildingRing,
  CLEARANCE_M,
  DECORATIONS,
  decorationSpecFor,
  DECORATION_CAP,
  Decoration,
  DecorationCache,
  PUMPKIN_ASPECT,
  TREE_ASPECT,
  TrafficLine,
  decorationsAtStop,
  decorationsInView,
} from "./decorationPlacement.ts";
import type { ViewBounds } from "./vehiclesInView.ts";

type LngLat = [number, number];

const OSLO: LngLat = [10.7509, 59.9114];
const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

const east = ([lng, lat]: LngLat, m: number): LngLat => [
  lng + m / mPerDegLng(lat),
  lat,
];
const north = ([lng, lat]: LngLat, m: number): LngLat => [
  lng,
  lat + m / M_PER_DEG_LAT,
];

/** Metres east and north of `origin`. */
const local = (origin: LngLat, [lng, lat]: LngLat) => [
  (lng - origin[0]) * mPerDegLng(origin[1]),
  (lat - origin[1]) * M_PER_DEG_LAT,
];
const metres = (a: LngLat, b: LngLat) => Math.hypot(...local(a, b));

const road = (cls: string, from: LngLat, to: LngLat): TrafficLine => ({
  class: cls,
  coordinates: [from, to],
});

function metresToSegment(p: LngLat, line: TrafficLine) {
  const [a, b] = line.coordinates;
  const [px, py] = local(a, p);
  const [bx, by] = local(a, b);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
  return Math.hypot(px - t * bx, py - t * by);
}

const square = (centre: LngLat, side: number): BuildingRing => {
  const h = side / 2;
  const sw = north(east(centre, -h), -h);
  const ne = north(east(centre, h), h);
  return [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]], sw];
};

/** True when a decoration's footprint lies wholly outside an axis-aligned square. */
function clearOf(p: Decoration, ring: BuildingRing, aspect = PUMPKIN_ASPECT) {
  const [x0, y0] = ring[0];
  const [x1, y1] = ring[2];
  const r = (aspect * p.height) / 2;
  const [px, py] = p.position;
  const dx = Math.max(x0 - px, 0, px - x1) * mPerDegLng(py);
  const dy = Math.max(y0 - py, 0, py - y1) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy) >= r - 1e-6;
}

const viewAround = (centre: LngLat, m = 300): ViewBounds => [
  north(east(centre, -m), -m),
  north(east(centre, m), m),
];

/** A stop that gets three pumpkins when nothing is in the way. */
const LUCKY: LngLat = (() => {
  for (let i = 0; i < 1000; i++) {
    const stop = east(OSLO, i);
    if (decorationsAtStop(DECORATIONS.halloween, stop, [], []).length === 3)
      return stop;
  }
  throw new Error("no stop with three pumpkins");
})();

describe("decorationsAtStop", () => {
  it("is deterministic per stop", () => {
    expect(decorationsAtStop(DECORATIONS.halloween, LUCKY, [], [])).toEqual(
      decorationsAtStop(DECORATIONS.halloween, LUCKY, [], []),
    );
  });

  it("gives every stop 1–3 pumpkins when nothing is in the way", () => {
    const stops = Array.from({ length: 3000 }, (_, i) => east(OSLO, i * 5));
    const counts = stops.map(
      (s) => decorationsAtStop(DECORATIONS.halloween, s, [], []).length,
    );
    expect(Math.min(...counts)).toBe(1);
    expect(Math.max(...counts)).toBe(3);
  });

  it("keeps every pumpkin between 2 and 3 m tall, under a bus, and 3–15 m from the stop", () => {
    const stops = Array.from({ length: 300 }, (_, i) => east(OSLO, i * 5));
    const all = stops.flatMap((s) =>
      decorationsAtStop(DECORATIONS.halloween, s, [], []).map((p) => ({
        stop: s,
        p,
      })),
    );
    expect(all.length).toBeGreaterThan(0);
    for (const { stop, p } of all) {
      expect(p.height).toBeGreaterThanOrEqual(2);
      expect(p.height).toBeLessThanOrEqual(3);
      expect(metres(stop, p.position)).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(metres(stop, p.position)).toBeLessThanOrEqual(15 + 1e-6);
    }
  });

  it("keeps clear of a primary road's estimated edge", () => {
    const traffic = [road("primary", north(LUCKY, -50), north(LUCKY, 50))];
    const pumpkins = decorationsAtStop(
      DECORATIONS.halloween,
      LUCKY,
      traffic,
      [],
    );
    expect(pumpkins.length).toBeGreaterThan(0);
    for (const p of pumpkins)
      expect(metresToSegment(p.position, traffic[0])).toBeGreaterThanOrEqual(
        7 + CLEARANCE_M + (PUMPKIN_ASPECT * p.height) / 2 - 1e-6,
      );
  });

  it("does not count a footway or cycleway as traffic", () => {
    const traffic = [road("path", north(LUCKY, -50), north(LUCKY, 50))];
    expect(
      decorationsAtStop(DECORATIONS.halloween, LUCKY, traffic, []),
    ).toEqual(decorationsAtStop(DECORATIONS.halloween, LUCKY, [], []));
  });

  // Ferries are in the feed; a quay's stop must not crowd its berth.
  it("keeps clear of a ferry line", () => {
    const traffic = [road("ferry", north(LUCKY, -50), north(LUCKY, 50))];
    const pumpkins = decorationsAtStop(
      DECORATIONS.halloween,
      LUCKY,
      traffic,
      [],
    );
    for (const p of pumpkins)
      expect(metresToSegment(p.position, traffic[0])).toBeGreaterThanOrEqual(
        10 + CLEARANCE_M + (PUMPKIN_ASPECT * p.height) / 2 - 1e-6,
      );
    expect(pumpkins).not.toEqual(
      decorationsAtStop(DECORATIONS.halloween, LUCKY, [], []),
    );
  });

  it("never stands a pumpkin inside a building", () => {
    const building = square(east(LUCKY, 12), 20);
    const pumpkins = decorationsAtStop(
      DECORATIONS.halloween,
      LUCKY,
      [],
      [building],
    );
    expect(pumpkins.length).toBeGreaterThan(0);
    for (const p of pumpkins) expect(clearOf(p, building)).toBe(true);
  });

  it("keeps pumpkins from overlapping each other", () => {
    const stops = Array.from({ length: 1000 }, (_, i) => east(OSLO, i * 5));
    for (const stop of stops) {
      const pumpkins = decorationsAtStop(DECORATIONS.halloween, stop, [], []);
      for (const a of pumpkins)
        for (const b of pumpkins)
          if (a !== b)
            expect(metres(a.position, b.position)).toBeGreaterThanOrEqual(
              (PUMPKIN_ASPECT * (a.height + b.height)) / 2 - 1e-6,
            );
    }
  });

  it("gives a stop with no clear spot no pumpkins", () => {
    // A primary road through the stop, buildings filling both sides from
    // just beyond its edge to past the farthest a pumpkin may stand.
    const traffic = [road("primary", north(LUCKY, -50), north(LUCKY, 50))];
    const buildings = [
      square(east(LUCKY, 20), 24),
      square(east(LUCKY, -20), 24),
    ];
    expect(
      decorationsAtStop(DECORATIONS.halloween, LUCKY, traffic, buildings),
    ).toEqual([]);
  });
});

describe("decorationsInView", () => {
  it("dedupes a stop returned by two tiles", () => {
    expect(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY, LUCKY],
        [],
        [],
        viewAround(LUCKY),
      ),
    ).toHaveLength(3);
  });

  it("is stable across views", () => {
    const a = decorationsInView(
      DECORATIONS.halloween,
      [LUCKY],
      [],
      [],
      viewAround(LUCKY),
    );
    const b = decorationsInView(
      DECORATIONS.halloween,
      [LUCKY],
      [],
      [],
      viewAround(east(LUCKY, 100)),
    );
    expect(b).toEqual(a);
  });

  it("leaves out stops outside the view", () => {
    expect(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [],
        [],
        viewAround(east(LUCKY, 2000)),
      ),
    ).toEqual([]);
  });

  it("caps at DECORATION_CAP, keeping the stops nearest the view's centre", () => {
    const stops = Array.from({ length: 2000 }, (_, i) =>
      north(east(OSLO, (i % 45) * 40), Math.floor(i / 45) * 40),
    );
    const centre = north(east(OSLO, 900), 900);
    const view = viewAround(centre, 2000);
    const pumpkins = decorationsInView(
      DECORATIONS.halloween,
      stops,
      [],
      [],
      view,
    );
    expect(pumpkins).toHaveLength(DECORATION_CAP);
    const nearest = Math.max(
      ...pumpkins.map((p) => metres(centre, p.position)),
    );
    const all = stops.flatMap((s) =>
      decorationsAtStop(DECORATIONS.halloween, s, [], []),
    );
    const farther = all.filter(
      (p) => metres(centre, p.position) > nearest + 30,
    );
    expect(farther.length).toBeGreaterThan(0);
    for (const p of farther) expect(pumpkins).not.toContainEqual(p);
  });

  // In 3D the loaded tiles reach the horizon, and a low-zoom tile there can
  // carry a ferry line or motorway several degrees long. Indexing every cell
  // it covers overflowed a Map and took the whole app down.
  it("copes with an obstacle many degrees long", () => {
    const long = road(
      "motorway",
      [OSLO[0] - 3, OSLO[1] - 3],
      [OSLO[0] + 3, OSLO[1] - 2.9],
    );
    const building = square(OSLO, 1) as BuildingRing;
    const huge: BuildingRing = [
      [OSLO[0] - 4, OSLO[1] + 1],
      [OSLO[0] + 4, OSLO[1] + 1],
      [OSLO[0] + 4, OSLO[1] + 3],
      [OSLO[0] - 4, OSLO[1] + 3],
      [OSLO[0] - 4, OSLO[1] + 1],
    ];
    expect(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [long],
        [building, huge],
        viewAround(LUCKY),
      ),
    ).toEqual(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [],
        [building],
        viewAround(LUCKY),
      ),
    );
  });
});

describe("decorationsInView's cache", () => {
  const view = () => viewAround(LUCKY);
  const along = (m: number) =>
    road("primary", north(east(LUCKY, m), -50), north(east(LUCKY, m), 50));

  // Between two builds — a pan, or once a second in a chase — most stops
  // are the same, and placing them again was most of a build's cost.
  it("reuses a stop's pumpkins while the obstacles near it are unchanged", () => {
    const cache: DecorationCache = new Map();
    const first = decorationsInView(
      DECORATIONS.halloween,
      [LUCKY],
      [along(10)],
      [],
      view(),
      { cache },
    );
    const moved = decorationsInView(
      DECORATIONS.halloween,
      [LUCKY],
      [along(-10)],
      [],
      view(),
    );
    expect(moved).not.toEqual(first);
    // The same count of roads and points near the stop: served from cache.
    expect(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [along(-10)],
        [],
        view(),
        { cache },
      ),
    ).toEqual(first);
  });

  it("places a stop again when the obstacles near it change", () => {
    const cache: DecorationCache = new Map();
    decorationsInView(DECORATIONS.halloween, [LUCKY], [], [], view(), {
      cache,
    });
    expect(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [along(10)],
        [],
        view(),
        { cache },
      ),
    ).toEqual(
      decorationsInView(
        DECORATIONS.halloween,
        [LUCKY],
        [along(10)],
        [],
        view(),
      ),
    );
  });

  it("forgets stops that have left the view", () => {
    const cache: DecorationCache = new Map();
    decorationsInView(DECORATIONS.halloween, [LUCKY], [], [], view(), {
      cache,
    });
    expect(cache.size).toBe(1);
    decorationsInView(
      DECORATIONS.halloween,
      [LUCKY],
      [],
      [],
      viewAround(east(LUCKY, 2000)),
      { cache },
    );
    expect(cache.size).toBe(0);
  });
});

// The placement must not move a single pumpkin when it is generalised: this
// is its output for a fixed scene, captured before the change.
describe("golden output", () => {
  it("places the same pumpkins over a fixed scene", () => {
    const stops = Array.from({ length: 25 }, (_, i) =>
      north(east(OSLO, ((i % 5) - 2) * 60), (Math.floor(i / 5) - 2) * 60),
    );
    const traffic = [road("primary", east(OSLO, -200), east(OSLO, 200))];
    const buildings = [square(north(east(OSLO, 15), 15), 12)];
    const pumpkins = decorationsInView(
      DECORATIONS.halloween,
      stops,
      traffic,
      buildings,
      viewAround(OSLO),
    );
    // `phase` is new and left out, so the fields captured before stay as
    // they were.
    const withoutPhase = pumpkins.map(
      ({ key, position, height, yaw, tint }) => ({
        key,
        position,
        height,
        yaw,
        tint,
      }),
    );
    expect(withoutPhase).toMatchInlineSnapshot(`
      [
        {
          "height": 2.6433829753659666,
          "key": "10.75090,59.91140#0",
          "position": [
            10.750853716707326,
            59.91127135108192,
          ],
          "tint": [
            220,
            102,
            14,
          ],
          "yaw": 141.59570552408695,
        },
        {
          "height": 2.6169660219457,
          "key": "10.74982,59.91140#0",
          "position": [
            10.749931792296774,
            59.9114951749741,
          ],
          "tint": [
            239,
            135,
            36,
          ],
          "yaw": 193.27528959140182,
        },
        {
          "height": 2.974463756894693,
          "key": "10.74982,59.91140#1",
          "position": [
            10.749689041139078,
            59.91129214721786,
          ],
          "tint": [
            234,
            126,
            31,
          ],
          "yaw": 7.713016737252474,
        },
        {
          "height": 2.917690447764471,
          "key": "10.75198,59.91140#0",
          "position": [
            10.751888798687474,
            59.911503039171436,
          ],
          "tint": [
            237,
            131,
            34,
          ],
          "yaw": 118.98164810612798,
        },
        {
          "height": 2.2597911830525845,
          "key": "10.75090,59.91086#0",
          "position": [
            10.751036955829058,
            59.9109530785934,
          ],
          "tint": [
            221,
            104,
            15,
          ],
          "yaw": 241.54615539126098,
        },
        {
          "height": 2.4717265628278255,
          "key": "10.75090,59.91086#1",
          "position": [
            10.750827279968341,
            59.910780472904634,
          ],
          "tint": [
            224,
            110,
            20,
          ],
          "yaw": 320.0387053191662,
        },
        {
          "height": 2.160830595996231,
          "key": "10.75090,59.91194#0",
          "position": [
            10.750951004624609,
            59.91188282186076,
          ],
          "tint": [
            226,
            114,
            22,
          ],
          "yaw": 78.24045916087925,
        },
        {
          "height": 2.5545169631950557,
          "key": "10.74982,59.91086#0",
          "position": [
            10.749899885670473,
            59.91098083288126,
          ],
          "tint": [
            220,
            104,
            15,
          ],
          "yaw": 221.661834474653,
        },
        {
          "height": 2.9870640838053077,
          "key": "10.74982,59.91086#1",
          "position": [
            10.74989049713011,
            59.91085700898851,
          ],
          "tint": [
            228,
            116,
            23,
          ],
          "yaw": 11.136072669178247,
        },
        {
          "height": 2.51815595687367,
          "key": "10.74982,59.91086#2",
          "position": [
            10.749949784842867,
            59.91093398320362,
          ],
          "tint": [
            224,
            110,
            20,
          ],
          "yaw": 64.89609581418335,
        },
        {
          "height": 2.38366980291903,
          "key": "10.75198,59.91086#0",
          "position": [
            10.751795379442951,
            59.91083816550035,
          ],
          "tint": [
            237,
            131,
            34,
          ],
          "yaw": 7.2312237694859505,
        },
        {
          "height": 2.5850643522571772,
          "key": "10.74982,59.91194#0",
          "position": [
            10.750000665889498,
            59.912011414962215,
          ],
          "tint": [
            223,
            108,
            18,
          ],
          "yaw": 301.8913242034614,
        },
        {
          "height": 2.1328546064905822,
          "key": "10.74982,59.91194#1",
          "position": [
            10.749878723681247,
            59.91185386314724,
          ],
          "tint": [
            237,
            131,
            34,
          ],
          "yaw": 176.19103680364788,
        },
        {
          "height": 2.1407936471514404,
          "key": "10.75198,59.91194#0",
          "position": [
            10.75206923854667,
            59.91194401949935,
          ],
          "tint": [
            238,
            134,
            36,
          ],
          "yaw": 337.11323015391827,
        },
        {
          "height": 2.9615370796527714,
          "key": "10.75198,59.91194#1",
          "position": [
            10.751806053428068,
            59.911937844266575,
          ],
          "tint": [
            217,
            98,
            11,
          ],
          "yaw": 306.8021169863641,
        },
        {
          "height": 2.1845290947239846,
          "key": "10.75198,59.91194#2",
          "position": [
            10.752231269284467,
            59.91194698493448,
          ],
          "tint": [
            225,
            111,
            20,
          ],
          "yaw": 212.10359430871904,
        },
        {
          "height": 2.9156901992391795,
          "key": "10.75090,59.91031#0",
          "position": [
            10.750962807069344,
            59.91031930714351,
          ],
          "tint": [
            229,
            119,
            25,
          ],
          "yaw": 240.01078435219824,
        },
        {
          "height": 2.103362758643925,
          "key": "10.75090,59.91031#1",
          "position": [
            10.750844404108047,
            59.91034686674902,
          ],
          "tint": [
            231,
            122,
            27,
          ],
          "yaw": 267.7392092719674,
        },
        {
          "height": 2.3552231402136385,
          "key": "10.75090,59.91031#2",
          "position": [
            10.750988182665504,
            59.91024462538529,
          ],
          "tint": [
            228,
            117,
            24,
          ],
          "yaw": 207.29497181251645,
        },
        {
          "height": 2.4433089916128665,
          "key": "10.75090,59.91249#0",
          "position": [
            10.750702451504276,
            59.91257070769543,
          ],
          "tint": [
            218,
            100,
            12,
          ],
          "yaw": 165.97071865573525,
        },
        {
          "height": 2.3328183649573475,
          "key": "10.75090,59.91249#1",
          "position": [
            10.750908229847289,
            59.9124561655459,
          ],
          "tint": [
            241,
            139,
            39,
          ],
          "yaw": 344.25771513953805,
        },
        {
          "height": 2.490402408875525,
          "key": "10.75090,59.91249#2",
          "position": [
            10.75076403855132,
            59.912493055421585,
          ],
          "tint": [
            233,
            126,
            30,
          ],
          "yaw": 100.83629708737135,
        },
        {
          "height": 2.0868572590406984,
          "key": "10.74875,59.91140#0",
          "position": [
            10.748849358106597,
            59.91130956985739,
          ],
          "tint": [
            218,
            99,
            12,
          ],
          "yaw": 232.6292704604566,
        },
        {
          "height": 2.7441177770961076,
          "key": "10.74875,59.91140#1",
          "position": [
            10.748660095039234,
            59.91130015639803,
          ],
          "tint": [
            238,
            134,
            36,
          ],
          "yaw": 122.31513326056302,
        },
        {
          "height": 2.0287395732011646,
          "key": "10.75305,59.91140#0",
          "position": [
            10.753042306863877,
            59.91149909756279,
          ],
          "tint": [
            223,
            108,
            18,
          ],
          "yaw": 321.60393906757236,
        },
        {
          "height": 2.2730465491767973,
          "key": "10.75305,59.91140#1",
          "position": [
            10.7530863248096,
            59.91128520883869,
          ],
          "tint": [
            227,
            116,
            23,
          ],
          "yaw": 2.9241790529340506,
        },
        {
          "height": 2.6317702904343605,
          "key": "10.75305,59.91140#2",
          "position": [
            10.753234200020682,
            59.91149744413608,
          ],
          "tint": [
            219,
            101,
            13,
          ],
          "yaw": 73.2240289170295,
        },
        {
          "height": 2.6753324666060507,
          "key": "10.74982,59.91031#0",
          "position": [
            10.750068898192488,
            59.91034531981615,
          ],
          "tint": [
            223,
            108,
            18,
          ],
          "yaw": 194.46177489124238,
        },
        {
          "height": 2.965792784234509,
          "key": "10.74982,59.91031#1",
          "position": [
            10.74991107507468,
            59.91031671067509,
          ],
          "tint": [
            241,
            139,
            39,
          ],
          "yaw": 207.59641430340707,
        },
        {
          "height": 2.957400903105736,
          "key": "10.74982,59.91031#2",
          "position": [
            10.749812830592136,
            59.910375093840926,
          ],
          "tint": [
            229,
            119,
            25,
          ],
          "yaw": 20.938808508217335,
        },
        {
          "height": 2.3270582240074873,
          "key": "10.75198,59.91031#0",
          "position": [
            10.752046832463728,
            59.910352856094605,
          ],
          "tint": [
            230,
            119,
            26,
          ],
          "yaw": 8.382498621940613,
        },
        {
          "height": 2.901068279054016,
          "key": "10.75198,59.91031#1",
          "position": [
            10.752040384643836,
            59.91028489408916,
          ],
          "tint": [
            223,
            109,
            18,
          ],
          "yaw": 293.27021551318467,
        },
        {
          "height": 2.418842843733728,
          "key": "10.75198,59.91031#2",
          "position": [
            10.752174719663715,
            59.910386286663645,
          ],
          "tint": [
            234,
            126,
            31,
          ],
          "yaw": 332.57108436897397,
        },
        {
          "height": 2.127690596971661,
          "key": "10.74982,59.91249#0",
          "position": [
            10.749838663793158,
            59.91256612383385,
          ],
          "tint": [
            225,
            111,
            20,
          ],
          "yaw": 143.38019091635942,
        },
        {
          "height": 2.550832192413509,
          "key": "10.74982,59.91249#1",
          "position": [
            10.749729149155584,
            59.9126020370814,
          ],
          "tint": [
            217,
            99,
            11,
          ],
          "yaw": 94.94516495615244,
        },
        {
          "height": 2.9764807666651905,
          "key": "10.74982,59.91249#2",
          "position": [
            10.749601098705432,
            59.912519940685634,
          ],
          "tint": [
            219,
            101,
            13,
          ],
          "yaw": 54.26212655380368,
        },
        {
          "height": 2.8563579118344933,
          "key": "10.75198,59.91249#0",
          "position": [
            10.751926145043614,
            59.91246487688191,
          ],
          "tint": [
            220,
            103,
            14,
          ],
          "yaw": 353.95875577814877,
        },
        {
          "height": 2.5838435881305486,
          "key": "10.74875,59.91086#0",
          "position": [
            10.74871857179902,
            59.910886951222714,
          ],
          "tint": [
            219,
            101,
            13,
          ],
          "yaw": 253.71780247427523,
        },
        {
          "height": 2.807551962090656,
          "key": "10.74875,59.91086#1",
          "position": [
            10.74879635115651,
            59.91077014612628,
          ],
          "tint": [
            233,
            124,
            29,
          ],
          "yaw": 301.9430135563016,
        },
        {
          "height": 2.3701987850945443,
          "key": "10.75305,59.91086#0",
          "position": [
            10.752934158017581,
            59.910829575234295,
          ],
          "tint": [
            232,
            123,
            28,
          ],
          "yaw": 66.5050123538822,
        },
        {
          "height": 2.5865374251734465,
          "key": "10.74875,59.91194#0",
          "position": [
            10.74883368500307,
            59.912050076950365,
          ],
          "tint": [
            224,
            110,
            19,
          ],
          "yaw": 2.9432498943060637,
        },
        {
          "height": 2.511453643674031,
          "key": "10.74875,59.91194#1",
          "position": [
            10.748669473819428,
            59.912050445086656,
          ],
          "tint": [
            235,
            128,
            32,
          ],
          "yaw": 104.30203760974109,
        },
        {
          "height": 2.7807384682819247,
          "key": "10.74875,59.91194#2",
          "position": [
            10.748590801253474,
            59.91203856691381,
          ],
          "tint": [
            228,
            117,
            24,
          ],
          "yaw": 284.70253206789494,
        },
        {
          "height": 2.3784532623831183,
          "key": "10.75305,59.91194#0",
          "position": [
            10.753225082040341,
            59.91189961072601,
          ],
          "tint": [
            237,
            132,
            34,
          ],
          "yaw": 340.98692930303514,
        },
        {
          "height": 2.4959419125225395,
          "key": "10.74875,59.91031#0",
          "position": [
            10.748845675609179,
            59.91038939079346,
          ],
          "tint": [
            232,
            124,
            29,
          ],
          "yaw": 154.08660002052784,
        },
        {
          "height": 2.799097653478384,
          "key": "10.75305,59.91031#0",
          "position": [
            10.75305781285591,
            59.91023940972001,
          ],
          "tint": [
            230,
            120,
            26,
          ],
          "yaw": 43.80254287272692,
        },
        {
          "height": 2.165343582164496,
          "key": "10.74875,59.91249#0",
          "position": [
            10.74854300076963,
            59.91246748379625,
          ],
          "tint": [
            225,
            111,
            20,
          ],
          "yaw": 278.9280013460666,
        },
        {
          "height": 2.4192863183561713,
          "key": "10.74875,59.91249#1",
          "position": [
            10.748866492299669,
            59.91256795010586,
          ],
          "tint": [
            234,
            127,
            31,
          ],
          "yaw": 224.16398847475648,
        },
        {
          "height": 2.7141369574237615,
          "key": "10.74875,59.91249#2",
          "position": [
            10.748739840741376,
            59.912432568890665,
          ],
          "tint": [
            236,
            130,
            33,
          ],
          "yaw": 244.44307029247284,
        },
        {
          "height": 2.416193151846528,
          "key": "10.75305,59.91249#0",
          "position": [
            10.753105674800603,
            59.9124855724341,
          ],
          "tint": [
            222,
            106,
            17,
          ],
          "yaw": 145.0577228050679,
        },
        {
          "height": 2.1407105398830026,
          "key": "10.75305,59.91249#1",
          "position": [
            10.75296524706104,
            59.91252386204794,
          ],
          "tint": [
            229,
            118,
            25,
          ],
          "yaw": 40.21811896003783,
        },
      ]
    `);
  });
});

describe("christmas trees", () => {
  const trees = DECORATIONS.christmas;
  const stops = Array.from({ length: 50 }, (_, i) => east(OSLO, i * 7));

  it("puts exactly one tree at a stop with room", () => {
    expect(decorationsAtStop(trees, OSLO, [], [])).toHaveLength(1);
  });

  it("keeps every tree 4–5 m tall and 3–20 m from its stop", () => {
    for (const stop of stops) {
      const placed = decorationsAtStop(trees, stop, [], []);
      expect(placed).toHaveLength(1);
      for (const tree of placed) {
        expect(tree.height).toBeGreaterThanOrEqual(4);
        expect(tree.height).toBeLessThanOrEqual(5);
        expect(metres(stop, tree.position)).toBeGreaterThanOrEqual(3 - 1e-6);
        expect(metres(stop, tree.position)).toBeLessThanOrEqual(20 + 1e-6);
      }
    }
  });

  it("keeps the canopy, not just the trunk, clear of a primary road", () => {
    let placed = 0;
    for (const stop of stops) {
      const traffic = [
        road("primary", north(east(stop, 8), -50), north(east(stop, 8), 50)),
      ];
      for (const tree of decorationsAtStop(trees, stop, traffic, [])) {
        placed++;
        expect(
          metresToSegment(tree.position, traffic[0]),
        ).toBeGreaterThanOrEqual(
          7 + CLEARANCE_M + (TREE_ASPECT * tree.height) / 2 - 1e-6,
        );
      }
    }
    expect(placed).toBeGreaterThan(0);
  });

  it("is stable across calls: the same stop gets the same tree", () => {
    for (const stop of stops.slice(0, 10))
      expect(decorationsAtStop(trees, stop, [], [])).toEqual(
        decorationsAtStop(trees, stop, [], []),
      );
  });

  it("never stands a tree inside a building", () => {
    let placed = 0;
    for (const stop of stops) {
      const building = square(east(stop, 12), 20);
      for (const tree of decorationsAtStop(trees, stop, [], [building])) {
        placed++;
        expect(clearOf(tree, building, TREE_ASPECT)).toBe(true);
      }
    }
    expect(placed).toBeGreaterThan(0);
  });

  it("gives a stop with no clear spot no tree", () => {
    // A primary road through the stop, buildings filling both sides from
    // just beyond its edge to past the farthest a tree may stand.
    for (const stop of stops.slice(0, 10)) {
      const traffic = [road("primary", north(stop, -50), north(stop, 50))];
      const buildings = [
        square(east(stop, 30), 44),
        square(east(stop, -30), 44),
      ];
      expect(decorationsAtStop(trees, stop, traffic, buildings)).toEqual([]);
    }
  });

  it("gives each tree a phase in [0, 1) that differs between neighbouring stops", () => {
    const phases = stops.map(
      (stop) => decorationsAtStop(trees, stop, [], [])[0].phase,
    );
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
    for (let i = 1; i < phases.length; i++)
      expect(phases[i]).not.toBe(phases[i - 1]);
  });
});

describe("decorationSpecFor", () => {
  it("has no spec for 17mai or for no season", () => {
    expect(decorationSpecFor("17mai")).toBeNull();
    expect(decorationSpecFor(null)).toBeNull();
  });

  it("gives a season its spec", () => {
    expect(decorationSpecFor("halloween")).toBe(DECORATIONS.halloween);
    expect(decorationSpecFor("christmas")).toBe(DECORATIONS.christmas);
  });
});
