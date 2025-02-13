import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { VehicleUpdate } from "./types.ts";
import { MapGeoJSONFeature } from "maplibre-gl";

export function VehicleMarkers({
  data,
  setSelectedVehicle,
}: {
  data: VehicleUpdate[];
  setSelectedVehicle: (
    selectedVehicle: { coordinates: number[]; properties: any } | null,
  ) => void;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const features = data.map((v) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [v.location.longitude, v.location.latitude],
      },
      properties: {
        id: v.vehicleId,
      },
    }));
    // @ts-ignore
    map?.getSource("vehicles").setData({
      type: "FeatureCollection",
      features: features,
    });

    // Change cursor on hover over the bus icons
    map.on("mouseenter", "vehicle-layer", (e) => {
      map.getCanvas().style.cursor = "pointer";

      const features = map.queryRenderedFeatures(e.point, {
        layers: ["vehicle-layer"],
      });
      if (features.length) {
        const feature: MapGeoJSONFeature = features[0];
        // @ts-ignore
        const coordinates = feature.geometry.coordinates.slice();
        setSelectedVehicle({
          coordinates,
          properties: feature.properties,
        });
      }
    });
    map.on("mouseleave", "vehicle-layer", () => {
      map.getCanvas().style.cursor = "";
      setSelectedVehicle(null);
    });
  }, [data]);

  return null;
}
