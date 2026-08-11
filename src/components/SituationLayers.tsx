import type { FeatureCollection } from "geojson";
import { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useSituations } from "../situations/SituationsContext.ts";
import { VehicleUpdate } from "../types.ts";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Cap on how far a selection can zoom in, so a single point doesn't fly to max zoom. */
const MAX_SELECTION_ZOOM = 15;

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
  const { feed, features, selected } = useSituations();
  const { current: mapRef } = useMap();

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

    // Resolved against the unfiltered set, matching SituationsPanel's lookup
    // of the selected situation: narrowing the filter after selecting must
    // not make the halo vanish while the detail view stays open.
    const situation = feed.situations.find(
      (s) => s.situationNumber === selected,
    );
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
  }, [selected, feed, vehicles]);

  useSetSourceData("situationPoints", points);
  useSetSourceData("situationLines", lines);
  useSetSourceData("situationVehicles", affectedVehicles);

  // Focus the map on the selected situation's own features when the
  // selection changes. Deliberately depends only on `selected` (and the map
  // instance) rather than on `features`: `features` gets a new array
  // identity on every subscription frame regardless of content (it's
  // rebuilt from a freshly-sorted `feed.situations` array each time), and
  // depending on it here would re-fly the map on every frame while a
  // selection is held, fighting anything the user does with the view.
  // Each time this *does* run, it reads `features` from the same render's
  // closure, which is already current — `features` does not itself depend
  // on `selected`, so there is no staleness to worry about.
  useEffect(() => {
    if (!mapRef || !selected) return;

    const bounds = new LngLatBounds();
    let hasCoordinates = false;

    for (const feature of features.pointFeatures) {
      if (feature.properties.situationNumber !== selected) continue;
      bounds.extend(feature.geometry.coordinates as [number, number]);
      hasCoordinates = true;
    }
    for (const feature of features.lineFeatures) {
      if (feature.properties.situationNumber !== selected) continue;
      for (const coordinate of feature.geometry.coordinates) {
        bounds.extend(coordinate as [number, number]);
        hasCoordinates = true;
      }
    }

    // No features for this situation (the common case on dev): leave the
    // view exactly where it is rather than jumping to a default or to null
    // island.
    if (!hasCoordinates) return;

    mapRef.getMap().fitBounds(bounds, {
      padding: 60,
      maxZoom: MAX_SELECTION_ZOOM,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mapRef]);

  return null;
}
