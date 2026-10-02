import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { RoutePolyline } from "../types.ts";

type RouteLayerProps = {
  /** The selected journey's route, fetched in `MapView` for the schedule ghost too. */
  route: RoutePolyline | null;
  cancelled: boolean;
};

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function RouteLayer({ route, cancelled }: RouteLayerProps) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const source = map.getSource("serviceJourneyRoute") as
      GeoJSONSource | undefined;
    if (!source) return;

    if (!route || route.coordinates.length === 0) {
      source.setData(EMPTY_FEATURE_COLLECTION);
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: route.coordinates },
          properties: {},
        },
      ],
    });

    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [route, mapRef]);

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    if (!map.getLayer("service-journey-route-layer")) return;
    map.setPaintProperty(
      "service-journey-route-layer",
      "line-dasharray",
      cancelled ? [2, 2] : undefined,
    );
  }, [cancelled, mapRef]);

  return null;
}
