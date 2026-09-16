import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { GeoJSONSource } from "maplibre-gl";
import type { Feature, Point, Polygon } from "geojson";
import {
  dimensionsFor,
  vehicleFootprint,
} from "../../domain/vehicleFootprint.ts";
import { labelColoursFor } from "../../domain/vehiclePaint.ts";

/** Layers a click can select a vehicle from: its icon and, zoomed in, its model. */
const CLICKABLE_VEHICLE_LAYERS = ["vehicle-layer", "vehicle-model-layer"];

type SelectedVehicleProperties = {
  id: string;
  mode: VehicleModeEnumeration;
  lineCode: string;
  codespaceId: string;
  delay: number;
  followed: boolean;
  updateInterval: number;
  serviceJourneyId: string;
  date: string;
  occupancyStatus: string;
  /** The line's published label colours as CSS, or null for the default. */
  lineTextColour: string | null;
  lineHaloColour: string | null;
};

export type SelectedVehicle = {
  coordinates: number[];
  properties: SelectedVehicleProperties;
};

const createFeature = (
  vehicle: VehicleUpdate,
  isFollowed: boolean,
): Feature<Point, SelectedVehicleProperties & { followed: boolean }> => {
  const lastUpdateTimestamp = Date.parse(vehicle.lastUpdated);
  const updateInterval = Date.now() - lastUpdateTimestamp;
  const labelColours = labelColoursFor(vehicle.line);
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
      date: vehicle.serviceJourney.date,
      occupancyStatus: vehicle.occupancyStatus,
      lineTextColour: labelColours?.text ?? null,
      lineHaloColour: labelColours?.halo ?? null,
    },
  };
};

/**
 * The model carries the icon's properties plus the reported position, because
 * a click on a polygon has no point geometry to anchor the popup to.
 */
const createModelFeature = (
  point: Feature<Point, SelectedVehicleProperties>,
  vehicle: VehicleUpdate,
): Feature<
  Polygon,
  SelectedVehicleProperties & { height: number; lon: number; lat: number }
> => {
  const [lon, lat] = point.geometry.coordinates;
  return {
    type: "Feature",
    geometry: vehicleFootprint([lon, lat], vehicle.bearing, vehicle.mode),
    properties: {
      ...point.properties,
      height: dimensionsFor(vehicle.mode).height,
      lon,
      lat,
    },
  };
};

export function VehicleMarkers({
  data,
  setSelectedVehicle,
  followedVehicleId,
  hiddenVehicleKey,
}: {
  data: VehicleUpdate[];
  setSelectedVehicle: (selectedVehicle: SelectedVehicle | null) => void;
  followedVehicleId: string | null;
  /**
   * Cache key of a vehicle to leave out: the chased one, whose model the chase
   * camera draws at its interpolated position. Its label and delay light would
   * otherwise sit at the newest report, seconds ahead of the model.
   */
  hiddenVehicleKey: string | null;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    const map = mapRef.getMap();
    const shown =
      hiddenVehicleKey === null
        ? data
        : data.filter(
            (vehicle) =>
              vehicle.vehicleId + "_" + vehicle.serviceJourney.id !==
              hiddenVehicleKey,
          );
    const features = shown.map((vehicle) =>
      createFeature(vehicle, vehicle.vehicleId === followedVehicleId),
    );
    // The source is declared in mapStyle, but getSource() returns undefined
    // until the style has finished loading — and this effect runs on the first
    // vehicle frame, which can arrive first. Guard the write rather than
    // returning early: the click subscriptions below must still be registered,
    // and a later frame re-runs this effect once the source exists.
    const source = map.getSource("vehicles") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features,
    });
    const modelSource = map.getSource("vehicleModels") as
      GeoJSONSource | undefined;
    modelSource?.setData({
      type: "FeatureCollection",
      features: features.map((feature, i) =>
        createModelFeature(feature, shown[i]),
      ),
    });

    const clickSubscription = map.on("click", CLICKABLE_VEHICLE_LAYERS, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: CLICKABLE_VEHICLE_LAYERS,
      });
      if (features.length) {
        const feature = features[0];
        const coordinates =
          feature.geometry.type === "Point"
            ? feature.geometry.coordinates.slice()
            : [feature.properties.lon, feature.properties.lat];
        setSelectedVehicle({
          coordinates,
          properties: feature.properties as SelectedVehicleProperties,
        });
      }
    });

    const clearSelectionOnClick = map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: CLICKABLE_VEHICLE_LAYERS,
      });
      if (!features.length) {
        setSelectedVehicle(null);
      }
    });

    return () => {
      clickSubscription.unsubscribe();
      clearSelectionOnClick.unsubscribe();
    };
  }, [data, mapRef, setSelectedVehicle, followedVehicleId, hiddenVehicleKey]);

  return null;
}
