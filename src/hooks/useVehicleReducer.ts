import { useReducer } from "react";
import { Statistics } from "model/statistics";
import { Vehicle } from "model/vehicle";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { Options } from "model/options";
import { LineLayerOptions } from "model/lineLayerOptions";

type State = {
  vehicles: Map<string, VehicleMapPoint>;
  statistics: Statistics;
};

export enum ActionType {
  HYDRATE,
  UPDATE,
}

export type Action = {
  type: ActionType;
  payload?: Vehicle[] | Vehicle;
};

const initialState: State = {
  vehicles: new Map(),
  statistics: {
    numberOfVehicles: 0,
    numberOfInactiveVehicles: 0,
    numberOfExpiredVehicles: 0,
    numberOfUpdatesInSession: 0,
  },
};

const DEFAULT_INACTIVE_VEHICLE_IN_SECONDS = 60;
const DEFAULT_EXPIRE_VEHICLE_IN_SECONDS = 3600;

const getCurrentEpochSeconds = () => Math.floor(Date.now() / 1000);

const isVehicleInactive = (vehicle: Vehicle, options: Options, now: number) => {
  return (
    vehicle.lastUpdatedEpochSecond +
      (options?.markInactiveAfterSeconds ||
        DEFAULT_INACTIVE_VEHICLE_IN_SECONDS) <
    now
  );
};

const isVehicleExpired = (vehicle: Vehicle, options: Options, now: number) => {
  return (
    vehicle.lastUpdatedEpochSecond +
      (options?.removeExpiredAfterSeconds ||
        DEFAULT_EXPIRE_VEHICLE_IN_SECONDS) <
      now || vehicle.expirationEpochSecond < now
  );
};

const hasValidServiceJourneyId = (vehicle: Vehicle) => {
  return /[A-Z][A-Z][A-Z]:ServiceJourney:.+/.test(
    vehicle.serviceJourney.serviceJourneyId
  );
};

const hydrate = (
  state: State,
  payload: Vehicle[],
  options: Options,
  lineLayerOptions: LineLayerOptions
) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let vehicles: Map<string, VehicleMapPoint> = payload.reduce(
    (acc: any, vehicle: Vehicle) => {
      numberOfUpdatesInSession++;

      if (
        options.hideServiceJourneysWithInvalidIds &&
        !hasValidServiceJourneyId(vehicle)
      ) {
        return acc;
      }

      if (options.removeExpired && isVehicleExpired(vehicle, options, now)) {
        numberOfExpiredVehicles++;
        return acc;
      }

      const vehicleMapPoint: VehicleMapPoint = {
        icon: vehicle.mode.toLowerCase(),
        vehicle,
        historicalPath:
          (lineLayerOptions.showHistoricalPath && [
            [vehicle.location.longitude, vehicle.location.latitude, 0],
          ]) ||
          [],
        lastUpdated: vehicle.lastUpdatedEpochSecond,
      };

      if (options.markInactive && isVehicleInactive(vehicle, options, now)) {
        vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
      }

      acc.set(vehicle.vehicleRef, vehicleMapPoint);

      return acc;
    },
    new Map()
  );

  const asArray = Array.from(vehicles.values());

  return {
    statistics: {
      numberOfVehicles: asArray.length,
      numberOfInactiveVehicles: asArray.filter(
        (v: any) => v.icon.indexOf("_inactive") > -1
      ).length,
      numberOfExpiredVehicles,
      numberOfUpdatesInSession,
    },
    vehicles,
  };
};

const update = (
  state: State,
  vehicles: Vehicle[],
  options: Options,
  lineLayerOptions: LineLayerOptions
) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let updatedVehicles = state.vehicles || new Map();

  vehicles.forEach((vehicle) => {
    numberOfUpdatesInSession++;

    if (
      options.hideServiceJourneysWithInvalidIds &&
      !hasValidServiceJourneyId(vehicle)
    ) {
      updatedVehicles.delete(vehicle.vehicleRef);

      // If we are removing a vehicle,
      // we need to update the reference to the map
      updatedVehicles = new Map(updatedVehicles);
    } else if (
      options.removeExpired &&
      isVehicleExpired(vehicle, options, now)
    ) {
      numberOfExpiredVehicles++;
      updatedVehicles.delete(vehicle.vehicleRef);

      // If we are removing a vehicle,
      // we need to update the reference to the map
      updatedVehicles = new Map(updatedVehicles);
    } else {
      const vehicleMapPoint = updatedVehicles.get(vehicle.vehicleRef) || {
        icon: vehicle.mode.toLowerCase(),
        vehicle,
        historicalPath: [],
        lastUpdated: vehicle.lastUpdatedEpochSecond,
      };

      vehicleMapPoint.vehicle = vehicle;

      if (options.markInactive && isVehicleInactive(vehicle, options, now)) {
        vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
      }

      if (updatedVehicles.get(vehicle.vehicleRef)) {
        if (lineLayerOptions.showHistoricalPath) {
          const historicalPath = updatedVehicles.get(
            vehicle.vehicleRef
          )?.historicalPath;
          historicalPath?.push([
            vehicle.location.longitude,
            vehicle.location.latitude,
            0,
          ]);
          vehicleMapPoint.historicalPath =
            historicalPath || vehicleMapPoint.historicalPath;
        } else {
          vehicleMapPoint.historicalPath = [];
        }

        vehicleMapPoint.lastUpdated = vehicle.lastUpdatedEpochSecond;
      } else {
        updatedVehicles.set(vehicle.vehicleRef, vehicleMapPoint);

        // If we are adding a new vehicle,
        // we need to update the reference to the map
        updatedVehicles = new Map(updatedVehicles);
      }
    }
  });

  const asArray = Array.from(updatedVehicles.values());

  return {
    statistics: {
      numberOfVehicles: asArray.length,
      numberOfInactiveVehicles: asArray.filter(
        (v: any) => v.icon.indexOf("_inactive") > -1
      ).length,
      numberOfExpiredVehicles,
      numberOfUpdatesInSession,
    },
    vehicles: updatedVehicles,
  };
};

const reducerFactory =
  (options: Options, lineLayerOptions: LineLayerOptions) =>
  (state: State, action: Action) => {
    switch (action.type) {
      case ActionType.HYDRATE:
        return hydrate(
          state,
          action?.payload! as Vehicle[],
          options,
          lineLayerOptions
        );
      case ActionType.UPDATE:
        return update(
          state,
          action?.payload! as Vehicle[],
          options,
          lineLayerOptions
        );
    }
  };

export default function useVehicleReducer(
  options: Options,
  lineLayerOptions: LineLayerOptions
) {
  return useReducer(reducerFactory(options, lineLayerOptions), initialState);
}
