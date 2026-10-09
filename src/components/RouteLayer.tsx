import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { Call, RoutePolyline } from "../types.ts";
import { journeyStopFeatures } from "../domain/journeyStops.ts";

type RouteLayerProps = {
  /** The selected journey's route, fetched in `MapView` for the schedule ghost too. */
  route: RoutePolyline | null;
  /** The selected journey's calls, from its timetable; their stops are marked on the route. */
  calls: Call[] | null;
  cancelled: boolean;
};

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function RouteLayer({ route, calls, cancelled }: RouteLayerProps) {
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

  // Separate from the route: the timetable arrives in frames of its own, and
  // each frame (a call recorded, one cancelled) restyles the stops alone.
  useEffect(() => {
    if (!mapRef) return;
    const source = mapRef.getMap().getSource("serviceJourneyStops") as
      GeoJSONSource | undefined;
    if (!source) return;

    source.setData(journeyStopFeatures(calls));
    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [calls, mapRef]);

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
