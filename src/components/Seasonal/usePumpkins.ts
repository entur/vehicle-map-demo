import { useEffect } from "react";
import type { Layer } from "@deck.gl/core";
import type {
  GeoJSONFeature,
  Map as MapLibreMap,
  MapSourceDataEvent,
} from "maplibre-gl";
import type { Season } from "../../domain/season.ts";
import {
  BuildingRing,
  CHASE_CLEARANCE_M,
  Pumpkin,
  TrafficLine,
  pumpkinsInView,
} from "../../domain/pumpkinPlacement.ts";
import { STOP_FILTER } from "../../domain/transitNetwork.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import type { VehicleStore } from "../Vehicle/chasedVehicleStore.ts";
import { cappedViewBounds } from "../../utils/cappedViewBounds.ts";
import { throttle } from "../../utils/throttle.ts";
import { pumpkinLayers } from "./pumpkinLayers.ts";

/** The base map's vector source, which carries stops, roads and buildings. */
const SOURCE = "openmaptiles";

/**
 * How often pumpkins are placed again during a chase. Its camera fires
 * `moveend` every frame, and placement is far too much work for that.
 */
export const PUMPKIN_CHASE_INTERVAL_MS = 1000;
/** Outside a chase: often enough to follow tiles as they load. */
const PUMPKIN_INTERVAL_MS = 250;

type LngLat = [number, number];

type PumpkinWindow = { __pumpkins?: { count: number } };

const lines = (feature: GeoJSONFeature): LngLat[][] =>
  feature.geometry.type === "LineString"
    ? [feature.geometry.coordinates as LngLat[]]
    : feature.geometry.type === "MultiLineString"
      ? (feature.geometry.coordinates as LngLat[][])
      : [];

const outerRings = (feature: GeoJSONFeature): BuildingRing[] =>
  feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates[0] as LngLat[]]
    : feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates.map((polygon) => polygon[0] as LngLat[])
      : [];

/**
 * The seasonal pumpkins, placed near the stops in view and handed to
 * `onLayers` as deck.gl layers: `VehicleModels` owns the map's only
 * interleaved overlay and draws them with everything else 3D.
 *
 * Stops, roads and buildings are read from the base map's own tiles with
 * `querySourceFeatures`, so the pumpkins do not depend on the Transit network
 * switch. Off-season (`season` null) nothing is listened to or read. Below
 * the models' zoom (`opacity` 0) the layers are empty and no tiles are read.
 * During a chase the pumpkins are placed around the chased vehicle once a
 * second, leaving out any near enough to hide it.
 */
export function usePumpkins({
  map,
  season,
  opacity,
  scheme,
  chasing,
  chasedVehicleStore,
  onLayers,
}: {
  map: MapLibreMap | undefined;
  season: Season | null;
  opacity: number;
  scheme: MapScheme;
  chasing: boolean;
  chasedVehicleStore: VehicleStore;
  onLayers: (layers: Layer[]) => void;
}) {
  useEffect(() => {
    if (!map || season === null) return;
    let shown: string | null = null;

    const show = (pumpkins: Pumpkin[], elevations: number[]) => {
      const key = pumpkins
        .map((pumpkin, i) => `${pumpkin.key}@${elevations[i]}`)
        .join(",");
      if (key === shown) return;
      shown = key;
      const elevationOf = new Map(
        pumpkins.map((pumpkin, i) => [pumpkin, elevations[i]]),
      );
      onLayers(
        pumpkinLayers(pumpkins, {
          visible: opacity > 0,
          opacity,
          scheme,
          getElevation: (pumpkin) => elevationOf.get(pumpkin) ?? 0,
          positionTrigger: key,
        }),
      );
      // Lets the Playwright tests see the pumpkins. Development builds only.
      if (import.meta.env.DEV)
        (window as PumpkinWindow).__pumpkins = { count: pumpkins.length };
    };

    const place = () => {
      if (opacity === 0) return show([], []);
      const stops = map
        .querySourceFeatures(SOURCE, {
          sourceLayer: "poi",
          filter: STOP_FILTER,
        })
        .flatMap((feature) =>
          feature.geometry.type === "Point"
            ? [feature.geometry.coordinates as LngLat]
            : [],
        );
      const traffic: TrafficLine[] = map
        .querySourceFeatures(SOURCE, { sourceLayer: "transportation" })
        .flatMap((feature) =>
          lines(feature).map((coordinates) => ({
            class: String(feature.properties.class),
            coordinates,
          })),
        );
      const buildings = map
        .querySourceFeatures(SOURCE, { sourceLayer: "building" })
        .flatMap(outerRings);
      const chased = chasing ? chasedVehicleStore.get() : null;
      const pumpkins = pumpkinsInView(
        stops,
        traffic,
        buildings,
        cappedViewBounds(map),
        chased
          ? {
              avoid: {
                position: [chased.location.longitude, chased.location.latitude],
                radiusM: CHASE_CLEARANCE_M,
              },
            }
          : {},
      );
      // Standing on the terrain, or at sea level in 2D. MapLibre answers 0
      // for a terrain tile still loading; its `sourcedata` builds again.
      show(
        pumpkins,
        pumpkins.map(
          (pumpkin) => map.queryTerrainElevation(pumpkin.position) ?? 0,
        ),
      );
    };

    // A decoration must never take the map down: an error here once blanked
    // the whole app. Logged, and no pumpkins until the next build succeeds.
    const build = () => {
      try {
        place();
      } catch (error) {
        console.error("Seasonal pumpkins could not be placed", error);
        show([], []);
      }
    };

    const throttled = throttle(
      build,
      chasing ? PUMPKIN_CHASE_INTERVAL_MS : PUMPKIN_INTERVAL_MS,
    );
    build();
    if (opacity === 0) return;

    const onSourceData = (event: MapSourceDataEvent) => {
      if (
        event.tile &&
        (event.sourceId === SOURCE ||
          event.sourceId === map.getTerrain()?.source)
      )
        throttled();
    };
    map.on("moveend", throttled);
    map.on("terrain", throttled);
    map.on("sourcedata", onSourceData);
    return () => {
      throttled.cancel();
      map.off("moveend", throttled);
      map.off("terrain", throttled);
      map.off("sourcedata", onSourceData);
      onLayers([]);
      if (import.meta.env.DEV) (window as PumpkinWindow).__pumpkins = undefined;
    };
  }, [map, season, opacity, scheme, chasing, chasedVehicleStore, onLayers]);
}
