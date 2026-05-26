import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import { useServiceJourneyRoute } from "../hooks/useServiceJourneyRoute.ts";

type RouteLayerProps = {
  serviceJourneyId: string | null;
  cancelled: boolean;
};

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function RouteLayer({ serviceJourneyId, cancelled }: RouteLayerProps) {
  const route = useServiceJourneyRoute(serviceJourneyId);
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const source = map.getSource("serviceJourneyRoute") as
      | GeoJSONSource
      | undefined;
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
      cancelled ? [2, 2] : null,
    );
  }, [cancelled, mapRef]);

  return null;
}
