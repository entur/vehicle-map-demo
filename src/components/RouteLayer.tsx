import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { RoutePolyline } from "../types.ts";
import { JourneyStopProperties } from "../domain/journeyStops.ts";

type RouteLayerProps = {
  /** The selected journey's route, fetched in `MapView` for the schedule ghost too. */
  route: RoutePolyline | null;
  /** The selected journey's stops, from its timetable (`journeyStopFeatures`). */
  stops: FeatureCollection<Point, JourneyStopProperties>;
  cancelled: boolean;
};

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function RouteLayer({ route, stops, cancelled }: RouteLayerProps) {
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

    source.setData(stops);
    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [stops, mapRef]);

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
