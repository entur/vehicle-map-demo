import { useReducer } from "react";
import { Statistics } from "model/statistics";
import { Vehicle } from "model/vehicle";
import { VehicleMapPoint } from "model/vehicleMapPoint";

type State = {
  vehicles: Record<string, VehicleMapPoint>;
  statistics: Statistics;
};

export enum ActionType {
  HYDRATE,
  UPDATE,
  EXPIRE,
}

export type Action = {
  type: ActionType;
  payload?: Vehicle[] | Vehicle;
};

const initialState: State = {
  vehicles: {},
  statistics: {
    numberOfVehicles: 0,
    numberOfInactiveVehicles: 0,
    numberOfExpiredVehicles: 0,
    numberOfUpdatesInSession: 0,
  },
};

const DEFAULT_INACTIVE_VEHICLE_IN_SECONDS = 60;

const getCurrentEpochSeconds = () => Math.floor(Date.now() / 1000);

const hydrate = (state: State, payload: Vehicle[]) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let vehicles = payload.reduce((acc: any, vehicle: Vehicle) => {
    numberOfUpdatesInSession++;
    if (vehicle.expirationEpochSecond < now) {
      console.debug("rejecting expired vehicle during hydration", vehicle);
      numberOfExpiredVehicles++;
      return acc;
    }
    const vehicleMapPoint: VehicleMapPoint = {
      icon: vehicle.mode.toLowerCase(),
      vehicle,
    };

    if (
      vehicle.lastUpdatedEpochSecond + DEFAULT_INACTIVE_VEHICLE_IN_SECONDS <
      now
    ) {
      vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
    }

    acc[vehicle.vehicleRef] = vehicleMapPoint;

    return acc;
  }, {});

  return {
    statistics: {
      numberOfVehicles: Object.values(vehicles).length,
      numberOfInactiveVehicles: Object.values(vehicles).filter(
        (v: any) => v.icon.indexOf("_inactive") > -1
      ).length,
      numberOfExpiredVehicles,
      numberOfUpdatesInSession,
    },
    vehicles,
  };
};

const update = (state: State, vehicles: Vehicle[]) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let updatedVehicles = {
    ...state.vehicles,
  };

  vehicles.forEach((vehicle) => {
    numberOfUpdatesInSession++;
    if (vehicle.expirationEpochSecond < now) {
      console.debug("rejecting expired vehicle during update", vehicle);
      numberOfExpiredVehicles++;
    } else {
      const vehicleMapPoint: VehicleMapPoint = {
        icon: vehicle.mode.toLowerCase(),
        vehicle,
      };

      if (
        vehicle.lastUpdatedEpochSecond + DEFAULT_INACTIVE_VEHICLE_IN_SECONDS <
        now
      ) {
        vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
      }

      if (updatedVehicles[vehicle.vehicleRef]) {
        if (
          vehicle.lastUpdatedEpochSecond >
          updatedVehicles[vehicle.vehicleRef].vehicle.lastUpdatedEpochSecond
        ) {
          console.debug(
            "found new update for vehicle during hydration/update",
            vehicle
          );
          updatedVehicles[vehicle.vehicleRef] = vehicleMapPoint;
        }
      } else {
        updatedVehicles[vehicle.vehicleRef] = vehicleMapPoint;
      }
    }
  });

  return {
    statistics: {
      numberOfVehicles: Object.values(updatedVehicles).length,
      numberOfInactiveVehicles: Object.values(updatedVehicles).filter(
        (v: any) => v.icon.indexOf("_inactive") > -1
      ).length,
      numberOfExpiredVehicles,
      numberOfUpdatesInSession,
    },
    vehicles: updatedVehicles,
  };
};

const expire = (state: State) => {
  const now = getCurrentEpochSeconds();
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;

  let vehicles = Object.values(state.vehicles).reduce(
    (acc: any, vehicleMapPoint: VehicleMapPoint) => {
      if (vehicleMapPoint.vehicle.expirationEpochSecond < now) {
        console.debug("expire vehicle", vehicleMapPoint.vehicle);
        numberOfExpiredVehicles++;
        return acc;
      }

      if (
        vehicleMapPoint.vehicle.lastUpdatedEpochSecond +
          DEFAULT_INACTIVE_VEHICLE_IN_SECONDS <
        now
      ) {
        if (vehicleMapPoint.icon.indexOf("_inactive") === -1) {
          vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
        }
      }
      acc[vehicleMapPoint.vehicle.vehicleRef] = vehicleMapPoint;
      return acc;
    },
    {}
  );

  return {
    vehicles,
    statistics: {
      ...state.statistics,
      numberOfVehicles: Object.values(vehicles).length,
      numberOfInactiveVehicles: Object.values(vehicles).filter(
        (v: any) => v.icon.indexOf("_inactive") > -1
      ).length,
      numberOfExpiredVehicles,
    },
  };
};

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case ActionType.HYDRATE:
      return hydrate(state, action?.payload! as Vehicle[]);
    case ActionType.UPDATE:
      return update(state, action?.payload! as Vehicle[]);
    case ActionType.EXPIRE:
      return expire(state);
  }
};

export default function useVehicleReducer() {
  return useReducer(reducer, initialState);
}
