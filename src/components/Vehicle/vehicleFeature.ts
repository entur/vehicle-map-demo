import type { Feature, Point } from "geojson";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { normaliseBearing } from "../../domain/vehicleFootprint.ts";
import { labelColoursFor } from "../../domain/vehiclePaint.ts";

export type SelectedVehicleProperties = {
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
  /** Degrees clockwise from north in [0, 360), or null when unusable. */
  bearing: number | null;
};

export type SelectedVehicle = {
  coordinates: number[];
  properties: SelectedVehicleProperties;
};

/** A vehicle as a map feature: the properties a click selects it by. */
export const createVehicleFeature = (
  vehicle: VehicleUpdate,
  isFollowed: boolean,
): Feature<Point, SelectedVehicleProperties> => {
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
      bearing: normaliseBearing(vehicle.bearing),
    },
  };
};

/**
 * The selection a click on `vehicle` makes, for selecting a vehicle found in
 * the data rather than on the map — the kiosk's next chase.
 */
export function selectedVehicleFrom(vehicle: VehicleUpdate): SelectedVehicle {
  const feature = createVehicleFeature(vehicle, false);
  return {
    coordinates: feature.geometry.coordinates,
    properties: feature.properties,
  };
}
