import type { Map as MapLibreMap } from "maplibre-gl";
import {
  BuildingRing,
  Decoration,
  DecorationCache,
  DecorationSpec,
  TrafficLine,
  decorationsInView,
} from "../../domain/decorationPlacement.ts";
import { STOP_FILTER } from "../../domain/transitNetwork.ts";
import type { ViewBounds } from "../../domain/vehiclesInView.ts";
import { Throttled, throttle } from "../../utils/throttle.ts";

/** The base map's vector source, which carries stops, roads, buildings and water. */
export const DECORATION_SOURCE = "openmaptiles";

type LngLat = [number, number];

/** The parts of a MapLibre map the controller uses; a fake one in tests. */
export type DecorationMap = Pick<
  MapLibreMap,
  | "querySourceFeatures"
  | "queryTerrainElevation"
  | "isMoving"
  | "getTerrain"
  | "on"
  | "off"
>;

type Feature = ReturnType<MapLibreMap["querySourceFeatures"]>[number];

/** What is drawn: the decorations, their heights, and a key that changes with either. */
export type Placed = {
  decorations: Decoration[];
  elevations: number[];
  key: string;
};

export const NOTHING_PLACED: Placed = {
  decorations: [],
  elevations: [],
  key: "",
};

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
 * Places a season's decorations (pumpkins, trees; whatever `spec` says) for the current view and keeps them placed,
 * reporting each change to `onPlaced`. Plain TypeScript rather than a hook,
 * so the tests can drive it with a fake map.
 *
 * Placement reads stops, roads, buildings and water from the base map's
 * tiles — in a city centre in 3D about 7 ms to read and 10–20 ms to place
 * afresh, a frame or more — so it runs
 * as little as it can: at once, when a move ends, and when a base map tile
 * arrives while the camera is at rest; never for a tile streaming in
 * mid-gesture, whose move's end places anyway. A terrain tile, or terrain
 * coming or going, changes only heights, so only heights are read again.
 * Both are throttled to `intervalMs`, which during a chase — whose camera
 * fires `moveend` every frame — is a second.
 *
 * The cache is keyed by stop alone, so one controller serves one spec for
 * its whole life: a different season is a new controller with a new cache.
 *
 * A placement that throws is logged and shows nothing: a decoration must
 * never take the map down, and an error here once blanked the whole app.
 */
export class DecorationController {
  private placed: Placed = NOTHING_PLACED;
  /** Each stop's decorations from the last placement, reused while nothing near it changed. */
  private readonly cache: DecorationCache = new Map();
  private readonly place: Throttled<[]>;
  private readonly elevate: Throttled<[]>;
  private readonly onSourceData = (event: {
    sourceId?: string;
    tile?: unknown;
  }) => {
    if (!event.tile) return;
    if (event.sourceId === DECORATION_SOURCE) {
      if (!this.map.isMoving()) this.place();
    } else if (event.sourceId === this.map.getTerrain()?.source) {
      this.elevate();
    }
  };

  constructor(
    private readonly map: DecorationMap,
    private readonly options: {
      spec: DecorationSpec;
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
      console.error("Seasonal decorations could not be placed", error);
      this.report([]);
    }
  }

  private placeNow() {
    const read = (sourceLayer: string, filter?: typeof STOP_FILTER) =>
      this.map.querySourceFeatures(DECORATION_SOURCE, { sourceLayer, filter });
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
      decorationsInView(
        this.options.spec,
        stops,
        traffic,
        blocked,
        this.options.viewBounds(),
        { cache: this.cache },
      ),
    );
  }

  private elevateNow() {
    this.report(this.placed.decorations);
  }

  /**
   * Reports the decorations standing on the terrain, or at sea level in 2D,
   * unless nothing changed. MapLibre answers 0 for a terrain tile still
   * loading; its arrival reads the heights again.
   */
  private report(decorations: Decoration[]) {
    const elevations = decorations.map(
      (decoration) => this.map.queryTerrainElevation(decoration.position) ?? 0,
    );
    // The position as well as the key: a decoration that moves keeps its key.
    const key = decorations
      .map(
        (decoration, i) =>
          `${decoration.key}@${decoration.position.join(",")},${elevations[i]}`,
      )
      .join(";");
    if (key === this.placed.key && this.placed !== NOTHING_PLACED) return;
    this.placed = { decorations, elevations, key };
    this.options.onPlaced(this.placed);
  }
}
