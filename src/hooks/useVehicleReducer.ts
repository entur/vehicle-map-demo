import { useReducer } from "react";
import { Statistics } from "model/statistics";
import { Vehicle } from "model/vehicle";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { Options } from "model/options";

type State = {
  vehicles: Map<string, VehicleMapPoint>;
  statistics: Statistics;
};

export enum ActionType {
  HYDRATE,
  UPDATE,
  // SWEEP,
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

const hydrate = (state: State, payload: Vehicle[], options: Options) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let vehicles: Map<string, VehicleMapPoint> = payload.reduce(
    (acc: any, vehicle: Vehicle) => {
      numberOfUpdatesInSession++;

      if (options.removeExpired && isVehicleExpired(vehicle, options, now)) {
        numberOfExpiredVehicles++;
        return acc;
      }

      const vehicleMapPoint: VehicleMapPoint = {
        icon: vehicle.mode.toLowerCase(),
        vehicle,
        historicalPath: [
          [vehicle.location.longitude, vehicle.location.latitude, 0],
        ],
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

const update = (state: State, vehicles: Vehicle[], options: Options) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let updatedVehicles = state.vehicles || new Map();

  vehicles.forEach((vehicle) => {
    numberOfUpdatesInSession++;
    // if (options.removeExpired && isVehicleExpired(vehicle, options, now)) {
    //   numberOfExpiredVehicles++;
    // } else {
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

      vehicleMapPoint.lastUpdated = vehicle.lastUpdatedEpochSecond;

      updatedVehicles.set(vehicle.vehicleRef, vehicleMapPoint);
      // if (
      //   vehicle.lastUpdatedEpochSecond >
      //   updatedVehicles.get(vehicle.vehicleRef)?.vehicle?.lastUpdatedEpochSecond
      // ) {
      //   updatedVehicles.get(vehicle.vehicleRef) = vehicleMapPoint;
      // }
      // } else {
      //   updatedVehicles[vehicle.vehicleRef] = vehicleMapPoint;
      // }
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

// const sweep = (state: State, options: Options) => {
//   const now = getCurrentEpochSeconds();
//   let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;

//   let vehicles = Object.values(state.vehicles).reduce(
//     (acc: any, vehicleMapPoint: VehicleMapPoint) => {
//       if (
//         options.removeExpired &&
//         isVehicleExpired(vehicleMapPoint.vehicle, options, now)
//       ) {
//         numberOfExpiredVehicles++;
//         return acc;
//       }

//       if (
//         options.markInactive &&
//         isVehicleInactive(vehicleMapPoint.vehicle, options, now)
//       ) {
//         if (vehicleMapPoint.icon.indexOf("_inactive") === -1) {
//           vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
//         }
//       }

//       acc.set(vehicleMapPoint.vehicle.vehicleRef, vehicleMapPoint);

//       return acc;
//     },
//     new Map()
//   );

//   return {
//     vehicles,
//     statistics: {
//       ...state.statistics,
//       numberOfVehicles: Object.values(vehicles).length,
//       numberOfInactiveVehicles: Object.values(vehicles).filter(
//         (v: any) => v.icon.indexOf("_inactive") > -1
//       ).length,
//       numberOfExpiredVehicles,
//     },
//   };
// };

const reducerFactory = (options: Options) => (state: State, action: Action) => {
  switch (action.type) {
    case ActionType.HYDRATE:
      return hydrate(state, action?.payload! as Vehicle[], options);
    case ActionType.UPDATE:
      return update(state, action?.payload! as Vehicle[], options);
    // case ActionType.SWEEP:
    //   return sweep(state, options);
  }
};

export default function useVehicleReducer(options: Options) {
  return useReducer(reducerFactory(options), initialState);
}
