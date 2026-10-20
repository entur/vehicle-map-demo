import type { Map as MapLibreMap } from "maplibre-gl";
import {
  BuildingRing,
  Pumpkin,
  PumpkinCache,
  TrafficLine,
  pumpkinsInView,
} from "../../domain/pumpkinPlacement.ts";
import { STOP_FILTER } from "../../domain/transitNetwork.ts";
import type { ViewBounds } from "../../domain/vehiclesInView.ts";
import { Throttled, throttle } from "../../utils/throttle.ts";

/** The base map's vector source, which carries stops, roads, buildings and water. */
export const PUMPKIN_SOURCE = "openmaptiles";

type LngLat = [number, number];

/** The parts of a MapLibre map the controller uses; a fake one in tests. */
export type PumpkinMap = Pick<
  MapLibreMap,
  | "querySourceFeatures"
  | "queryTerrainElevation"
  | "isMoving"
  | "getTerrain"
  | "on"
  | "off"
>;

type Feature = ReturnType<MapLibreMap["querySourceFeatures"]>[number];

/** What is drawn: the pumpkins, their heights, and a key that changes with either. */
export type Placed = {
  pumpkins: Pumpkin[];
  elevations: number[];
  key: string;
};

export const NOTHING_PLACED: Placed = { pumpkins: [], elevations: [], key: "" };

const lines = (feature: Feature): LngLat[][] =>
  feature.geometry.type === "LineString"
    ? [feature.geometry.coordinates as LngLat[]]
    : feature.geometry.type === "MultiLineString"
      ? (feature.geometry.coordinates as LngLat[][])
      : [];

const outerRings = (feature: Feature): BuildingRing[] =>
  feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates[0] as LngLat[]]
    : feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates.map((polygon) => polygon[0] as LngLat[])
      : [];

/**
 * Places the seasonal pumpkins for the current view and keeps them placed,
 * reporting each change to `onPlaced`. Plain TypeScript rather than a hook,
 * so the tests can drive it with a fake map.
 *
 * Placement reads stops, roads, buildings and water from the base map's
 * tiles — about 13 ms in a city centre in 3D, most of a frame — so it runs
 * as little as it can: at once, when a move ends, and when a base map tile
 * arrives while the camera is at rest; never for a tile streaming in
 * mid-gesture, whose move's end places anyway. A terrain tile, or terrain
 * coming or going, changes only heights, so only heights are read again.
 * Both are throttled to `intervalMs`, which during a chase — whose camera
 * fires `moveend` every frame — is a second.
 *
 * A placement that throws is logged and shows nothing: a decoration must
 * never take the map down, and an error here once blanked the whole app.
 */
export class PumpkinController {
  private placed: Placed = NOTHING_PLACED;
  /** Each stop's pumpkins from the last placement, reused while nothing near it changed. */
  private readonly cache: PumpkinCache = new Map();
  private readonly place: Throttled<[]>;
  private readonly elevate: Throttled<[]>;
  private readonly onSourceData = (event: {
    sourceId?: string;
    tile?: unknown;
  }) => {
    if (!event.tile) return;
    if (event.sourceId === PUMPKIN_SOURCE) {
      if (!this.map.isMoving()) this.place();
    } else if (event.sourceId === this.map.getTerrain()?.source) {
      this.elevate();
    }
  };

  constructor(
    private readonly map: PumpkinMap,
    private readonly options: {
      viewBounds: () => ViewBounds;
      intervalMs: number;
      onPlaced: (placed: Placed) => void;
    },
  ) {
    this.place = throttle(
      () => this.guarded(() => this.placeNow()),
      options.intervalMs,
    );
    this.elevate = throttle(
      () => this.guarded(() => this.elevateNow()),
      options.intervalMs,
    );
    this.place();
    map.on("moveend", this.place);
    map.on("terrain", this.elevate);
    map.on("sourcedata", this.onSourceData);
  }

  dispose() {
    this.place.cancel();
    this.elevate.cancel();
    this.map.off("moveend", this.place);
    this.map.off("terrain", this.elevate);
    this.map.off("sourcedata", this.onSourceData);
  }

  private guarded(work: () => void) {
    try {
      work();
    } catch (error) {
      console.error("Seasonal pumpkins could not be placed", error);
      this.report([]);
    }
  }

  private placeNow() {
    const read = (sourceLayer: string, filter?: typeof STOP_FILTER) =>
      this.map.querySourceFeatures(PUMPKIN_SOURCE, { sourceLayer, filter });
    const stops = read("poi", STOP_FILTER).flatMap((feature) =>
      feature.geometry.type === "Point"
        ? [feature.geometry.coordinates as LngLat]
        : [],
    );
    const traffic: TrafficLine[] = read("transportation").flatMap((feature) =>
      lines(feature).map((coordinates) => ({
        class: String(feature.properties.class),
        coordinates,
      })),
    );
    // Water is kept clear exactly as buildings are.
    const blocked = [
      ...read("building").flatMap(outerRings),
      ...read("water").flatMap(outerRings),
    ];
    this.report(
      pumpkinsInView(stops, traffic, blocked, this.options.viewBounds(), {
        cache: this.cache,
      }),
    );
  }

  private elevateNow() {
    this.report(this.placed.pumpkins);
  }

  /**
   * Reports the pumpkins standing on the terrain, or at sea level in 2D,
   * unless nothing changed. MapLibre answers 0 for a terrain tile still
   * loading; its arrival reads the heights again.
   */
  private report(pumpkins: Pumpkin[]) {
    const elevations = pumpkins.map(
      (pumpkin) => this.map.queryTerrainElevation(pumpkin.position) ?? 0,
    );
    // The position as well as the key: a pumpkin that moves keeps its key.
    const key = pumpkins
      .map(
        (pumpkin, i) =>
          `${pumpkin.key}@${pumpkin.position.join(",")},${elevations[i]}`,
      )
      .join(";");
    if (key === this.placed.key && this.placed !== NOTHING_PLACED) return;
    this.placed = { pumpkins, elevations, key };
    this.options.onPlaced(this.placed);
  }
}
