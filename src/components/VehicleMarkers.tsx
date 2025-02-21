import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { VehicleModeEnumeration, VehicleUpdate } from "../types.ts";
import { GeoJSONSource } from "maplibre-gl";

type SelectedVehicleProperties = {
  id: string;
  mode: VehicleModeEnumeration;
  lineCode: string;
  codespaceId: string;
  delay: number;
};

export type SelectedVehicle = {
  coordinates: number[];
  properties: SelectedVehicleProperties;
};

const createFeature = (
  vehicle: VehicleUpdate,
): GeoJSON.Feature<GeoJSON.Point, SelectedVehicleProperties> => {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [vehicle.location.longitude, vehicle.location.latitude],
    },
    properties: {
      id: vehicle.vehicleId,
      mode: vehicle.mode,
      lineCode: vehicle.line.publicCode,
      codespaceId: vehicle.codespace.codespaceId,
      delay: vehicle.delay,
    },
  };
};

export function VehicleMarkers({
  data,
  setSelectedVehicle,
}: {
  data: VehicleUpdate[];
  setSelectedVehicle: (selectedVehicle: SelectedVehicle | null) => void;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    const map = mapRef.getMap();
    const features = data.map(createFeature);
    const source = map?.getSource("vehicles") as GeoJSONSource;
    source.setData({
      type: "FeatureCollection",
      features: features,
    });

    // Change cursor on hover over the bus icons
    const mouseenterSubscription = map.on(
      "mouseenter",
      "vehicle-layer",
      (e) => {
        map.getCanvas().style.cursor = "pointer";

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["vehicle-layer"],
        });
        if (features.length) {
          const feature = features[0];
          const point = features[0].geometry as GeoJSON.Point;
          const coordinates = point.coordinates.slice();
          setSelectedVehicle({
            coordinates,
            properties: feature.properties as SelectedVehicleProperties,
          });
        }
      },
    );

    const mouseleaveSubscription = map.on("mouseleave", "vehicle-layer", () => {
      map.getCanvas().style.cursor = "";
      setSelectedVehicle(null);
    });

    return () => {
      mouseenterSubscription.unsubscribe();
      mouseleaveSubscription.unsubscribe();
    };
  }, [data, mapRef, setSelectedVehicle]);

  return null;
}
