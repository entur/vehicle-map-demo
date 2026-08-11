import type { FeatureCollection } from "geojson";
import { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useSituations } from "../situations/SituationsContext.ts";
import { VehicleUpdate } from "../types.ts";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function useSetSourceData(sourceId: string, data: FeatureCollection) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const source = mapRef.getMap().getSource(sourceId) as
      GeoJSONSource | undefined;
    if (!source) return;

    source.setData(data);

    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [sourceId, data, mapRef]);
}

/**
 * Draws whatever of the filtered situations can be placed, plus a halo around
 * the live vehicles a selected situation affects.
 *
 * Vehicles are matched on lineRef only. VehicleUpdate does not carry a dated
 * service journey, and adding one to the streamed vehicle subscription would
 * cost bandwidth on every frame to match ten more situations — see the plan's
 * spec amendment.
 */
export function SituationLayers({ vehicles }: { vehicles: VehicleUpdate[] }) {
  const { features, filtered, selected } = useSituations();

  const points: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.pointFeatures }),
    [features],
  );

  const lines: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.lineFeatures }),
    [features],
  );

  const affectedVehicles: FeatureCollection = useMemo(() => {
    if (!selected) return EMPTY_FEATURE_COLLECTION;

    const situation = filtered.find((s) => s.situationNumber === selected);
    const lineRefs = new Set(
      (situation?.affects?.lines ?? [])
        .map((line) => line.lineRef)
        .filter((ref): ref is string => Boolean(ref)),
    );
    if (lineRefs.size === 0) return EMPTY_FEATURE_COLLECTION;

    return {
      type: "FeatureCollection",
      features: vehicles
        .filter((vehicle) => lineRefs.has(vehicle.line?.lineRef))
        .map((vehicle) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              vehicle.location.longitude,
              vehicle.location.latitude,
            ],
          },
          properties: { vehicleId: vehicle.vehicleId },
        })),
    };
  }, [selected, filtered, vehicles]);

  useSetSourceData("situationPoints", points);
  useSetSourceData("situationLines", lines);
  useSetSourceData("situationVehicles", affectedVehicles);

  return null;
}
