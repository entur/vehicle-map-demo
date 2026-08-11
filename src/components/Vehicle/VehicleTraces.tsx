import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import { VehicleData } from "../../hooks/useVehiclePositionsData.ts";

const createFeature = (vehicle: VehicleData): Feature<LineString> => {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: vehicle.trace,
    },
    properties: {},
  };
};

export function VehicleTraces({ data }: { data: VehicleData[] }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    const map = mapRef.getMap();
    const features = data.map(createFeature);
    // Same hazard as VehicleMarkers: getSource() is undefined until the style
    // has loaded. Rarer here because traces are off by default, but identical.
    const source = map?.getSource("vehicleTraces") as GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: features,
    });

    return () => {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    };
  }, [data, mapRef]);

  return null;
}
