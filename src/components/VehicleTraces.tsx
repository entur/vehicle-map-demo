import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";

const createFeature = (
  vehicle: VehicleData,
): GeoJSON.Feature<GeoJSON.LineString> => {
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
    const source = map?.getSource("vehicleTraces") as GeoJSONSource;
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
