import { describe, expect, it } from "vitest";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";
import {
  MODEL_REACH_METRES,
  ViewBounds,
  capViewBounds,
  referenceReachMetres,
  padBounds,
  viewBoundsAt,
  vehiclesInView,
} from "./vehiclesInView.ts";

/** A 1°×1° view south-west at 10°E 63°N. */
const VIEW: ViewBounds = [
  [10, 63],
  [11, 64],
];

const at = (longitude: number, latitude: number) => ({
  location: { longitude, latitude },
});

describe("vehiclesInView", () => {
  it("keeps vehicles inside the view", () => {
    const inside = at(10.5, 63.5);
    expect(vehiclesInView([inside], VIEW)).toEqual([inside]);
  });

  // The jump that froze the page: the data still held the whole country while
  // the view showed one street.
  it("drops vehicles far outside the view", () => {
    expect(vehiclesInView([at(5.3, 60.4), at(10.5, 66)], VIEW)).toEqual([]);
  });

  it("keeps a vehicle just past the edge, whose model can still reach into view", () => {
    const justEast = at(11.05, 63.5);
    const justSouth = at(10.5, 62.95);
    expect(vehiclesInView([justEast, justSouth], VIEW)).toEqual([
      justEast,
      justSouth,
    ]);
  });

  it("keeps the vehicles' order and identity", () => {
    const a = at(10.2, 63.2);
    const b = at(10.8, 63.8);
    const result = vehiclesInView([a, b], VIEW);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });
});

/** About 75 m × 75 m at Skøyen: street zoom, where a train outgrows a tenth of the view. */
const STREET: ViewBounds = [
  [10.6786, 59.9221],
  [10.68, 59.9228],
];

describe("vehiclesInView at street zoom", () => {
  it("keeps a train whose centre is off screen but within half its length", () => {
    // 30 m west of the view: more than a tenth of it, less than half a train.
    const west = at(
      10.6786 -
        30 / (METRES_PER_DEGREE_LAT * Math.cos((59.9228 * Math.PI) / 180)),
      59.9225,
    );
    const south = at(10.679, 59.9221 - 30 / METRES_PER_DEGREE_LAT);
    expect(vehiclesInView([west, south], STREET)).toEqual([west, south]);
  });

  it("drops a vehicle beyond any model's reach", () => {
    expect(vehiclesInView([at(10.6786 - 0.002, 59.9225)], STREET)).toEqual([]);
  });
});

describe("padBounds", () => {
  it("widens every side by at least the given distance", () => {
    const [[w, s], [e, n]] = padBounds(STREET, 37.5);
    const lonMetres = (deg: number, lat: number) =>
      deg * METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
    expect((STREET[0][1] - s) * METRES_PER_DEGREE_LAT).toBeCloseTo(37.5);
    expect((n - STREET[1][1]) * METRES_PER_DEGREE_LAT).toBeCloseTo(37.5);
    // Checked at the southern edge, where a degree of longitude is the most metres.
    expect(lonMetres(STREET[0][0] - w, STREET[0][1])).toBeGreaterThanOrEqual(
      37.5,
    );
    expect(lonMetres(e - STREET[1][0], STREET[0][1])).toBeGreaterThanOrEqual(
      37.5,
    );
  });

  it("reaches half the longest vehicle", () => {
    expect(MODEL_REACH_METRES).toBe(37.5);
  });
});

describe("viewBoundsAt", () => {
  // A 512 px world at zoom 0, so 2^zoom × 512 px span the equator.
  const metresPerPixel = (latitude: number, zoom: number) =>
    (40_075_016.686 * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
  const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

  it("centres an unpadded view on the camera", () => {
    const [[west, south], [east, north]] = viewBoundsAt({
      longitude: 10,
      latitude: 63,
      zoom: 14,
      width: 1000,
      height: 600,
      padding: NO_PADDING,
    });
    expect((west + east) / 2).toBeCloseTo(10, 9);
    expect((south + north) / 2).toBeCloseTo(63, 9);
  });

  it("spans the canvas at the camera's zoom", () => {
    const [[west, south], [east, north]] = viewBoundsAt({
      longitude: 10,
      latitude: 60,
      zoom: 14,
      width: 1000,
      height: 600,
      padding: NO_PADDING,
    });
    const mpp = metresPerPixel(60, 14);
    expect((north - south) * METRES_PER_DEGREE_LAT).toBeCloseTo(600 * mpp, 3);
    expect(
      (east - west) * METRES_PER_DEGREE_LAT * Math.cos((60 * Math.PI) / 180),
    ).toBeCloseTo(1000 * mpp, 3);
  });

  // MapLibre puts the camera's centre in the middle of the unpadded part, so
  // the canvas reaches further on the padded side.
  it("reaches further on a padded side", () => {
    const [[west, south], [east, north]] = viewBoundsAt({
      longitude: 10,
      latitude: 60,
      zoom: 14,
      width: 1000,
      height: 600,
      padding: { top: 0, bottom: 200, left: 100, right: 0 },
    });
    const mpp = metresPerPixel(60, 14);
    const lonMetres = METRES_PER_DEGREE_LAT * Math.cos((60 * Math.PI) / 180);
    expect((north - 60) * METRES_PER_DEGREE_LAT).toBeCloseTo(200 * mpp, 3);
    expect((60 - south) * METRES_PER_DEGREE_LAT).toBeCloseTo(400 * mpp, 3);
    expect((10 - west) * lonMetres).toBeCloseTo(550 * mpp, 3);
    expect((east - 10) * lonMetres).toBeCloseTo(450 * mpp, 3);
  });
});

describe("capViewBounds", () => {
  const CAMERA = {
    longitude: 10,
    latitude: 60,
    zoom: 14,
    width: 1200,
    height: 800,
    fov: 36.87,
  };
  const COS_LAT = Math.cos((60 * Math.PI) / 180);
  /** The four sides' distances from the camera's centre, in metres. */
  const sides = ([[west, south], [east, north]]: ViewBounds) => ({
    west: (CAMERA.longitude - west) * METRES_PER_DEGREE_LAT * COS_LAT,
    east: (east - CAMERA.longitude) * METRES_PER_DEGREE_LAT * COS_LAT,
    south: (CAMERA.latitude - south) * METRES_PER_DEGREE_LAT,
    north: (north - CAMERA.latitude) * METRES_PER_DEGREE_LAT,
  });
  /** Bounds a view near the horizon reports: tens of kilometres every way. */
  const HORIZON: ViewBounds = [
    [9, 59.5],
    [11, 60.5],
  ];

  it("leaves a level view's bounds as they are", () => {
    const level = viewBoundsAt({ ...CAMERA, padding: {} });
    expect(capViewBounds(level, CAMERA)).toEqual(level);
  });

  // By hand for this camera: 2.39 m/px puts the camera 2866 m from the
  // centre, and at 60° the view's far corners are 1.97 times that away.
  it("cuts a view of the horizon to what a 60° tilt reaches", () => {
    const capped = sides(capViewBounds(HORIZON, CAMERA));
    for (const side of Object.values(capped)) {
      expect(side).toBeGreaterThan(5600);
      expect(side).toBeLessThan(5700);
      expect(side).toBeCloseTo(referenceReachMetres(CAMERA), 6);
    }
  });

  // Padding moves the centre off the middle of the canvas, as the chase's
  // top padding does, and the far corners move away from it.
  it("reaches further from a centre padded down the canvas", () => {
    const padded = referenceReachMetres({ ...CAMERA, padding: { top: 280 } });
    expect(padded).toBeGreaterThan(1.3 * referenceReachMetres(CAMERA));
    expect(padded).toBeLessThan(3 * referenceReachMetres(CAMERA));
  });

  it("reaches less far from a centre padded up the canvas", () => {
    expect(
      referenceReachMetres({ ...CAMERA, padding: { bottom: 280 } }),
    ).toBeLessThan(referenceReachMetres(CAMERA));
  });

  // Padded far enough, a 60° view has the horizon in it and no far corner.
  it("has no limit once the reference view would show the horizon", () => {
    expect(referenceReachMetres({ ...CAMERA, padding: { top: 1500 } })).toBe(
      Infinity,
    );
    expect(
      capViewBounds(HORIZON, { ...CAMERA, padding: { top: 1500 } }),
    ).toEqual(HORIZON);
  });

  it("cuts only the sides that reach too far", () => {
    const [[west, south], [east, north]] = capViewBounds(
      [
        [9.99, 59.99],
        [10.01, 60.5],
      ],
      CAMERA,
    );
    expect([west, south, east]).toEqual([9.99, 59.99, 10.01]);
    expect(north).toBeLessThan(60.06);
  });

  it("reaches twice as far one zoom level out", () => {
    const near = sides(capViewBounds(HORIZON, CAMERA));
    const far = sides(capViewBounds(HORIZON, { ...CAMERA, zoom: 13 }));
    expect(far.north).toBeCloseTo(2 * near.north, 6);
    expect(far.east).toBeCloseTo(2 * near.east, 6);
  });

  // A turned map's far corners can lie along any compass direction.
  it("reaches as far sideways as ahead", () => {
    const { north, east } = sides(capViewBounds(HORIZON, CAMERA));
    expect(east).toBeCloseTo(north, 6);
  });
});
