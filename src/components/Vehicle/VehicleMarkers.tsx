import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { GeoJSONSource } from "maplibre-gl";

type SelectedVehicleProperties = {
  id: string;
  mode: VehicleModeEnumeration;
  lineCode: string;
  codespaceId: string;
  delay: number;
  followed: boolean;
  updateInterval: number;
  serviceJourneyId: string;
  occupancyStatus: string;
};

export type SelectedVehicle = {
  coordinates: number[];
  properties: SelectedVehicleProperties;
};

const createFeature = (
  vehicle: VehicleUpdate,
  isFollowed: boolean,
): GeoJSON.Feature<
  GeoJSON.Point,
  SelectedVehicleProperties & { followed: boolean }
> => {
  const lastUpdateTimestamp = Date.parse(vehicle.lastUpdated);
  const updateInterval = Date.now() - lastUpdateTimestamp;
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
      followed: isFollowed,
      updateInterval: updateInterval,
      serviceJourneyId: vehicle.serviceJourney.id,
      occupancyStatus: vehicle.occupancyStatus,
    },
  };
};

export function VehicleMarkers({
  data,
  setSelectedVehicle,
  followedVehicleId,
}: {
  data: VehicleUpdate[];
  setSelectedVehicle: (selectedVehicle: SelectedVehicle | null) => void;
  followedVehicleId: string | null;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    const map = mapRef.getMap();
    const features = data.map((vehicle) =>
      createFeature(vehicle, vehicle.vehicleId === followedVehicleId),
    );
    const source = map.getSource("vehicles") as GeoJSONSource;
    source.setData({
      type: "FeatureCollection",
      features,
    });

    const clickSubscription = map.on("click", "vehicle-layer", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["vehicle-layer"],
      });
      if (features.length) {
        const feature = features[0];
        const point = feature.geometry as GeoJSON.Point;
        const coordinates = point.coordinates.slice();
        setSelectedVehicle({
          coordinates,
          properties: feature.properties as SelectedVehicleProperties,
        });
      }
    });

    const clearSelectionOnClick = map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["vehicle-layer"],
      });
      if (!features.length) {
        setSelectedVehicle(null);
      }
    });

    return () => {
      clickSubscription.unsubscribe();
      clearSelectionOnClick.unsubscribe();
    };
  }, [data, mapRef, setSelectedVehicle, followedVehicleId]);

  return null;
}
