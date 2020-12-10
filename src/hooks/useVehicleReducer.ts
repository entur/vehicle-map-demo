import { addMinutes, addSeconds, isBefore, parseISO } from "date-fns";
import { Statistics } from "model/statistics";
import { Vehicle } from "model/vehicle";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { useReducer } from "react";

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

const hydrate = (now: Date, state: State, payload: Vehicle[]) => {
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let vehicles = payload.reduce((acc: any, vehicle: Vehicle) => {
    numberOfUpdatesInSession++;
    if (parseISO(vehicle.expiration) < now) {
      console.debug("rejecting expired vehicle during hydration", vehicle);
      numberOfExpiredVehicles++;
      return acc;
    }
    const vehicleMapPoint: VehicleMapPoint = {
      icon: vehicle.mode.toLowerCase(),
      vehicle,
    };

    if (isBefore(addMinutes(parseISO(vehicle.lastUpdated), 1), now)) {
      vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
    }

    acc[vehicle.vehicleId] = vehicleMapPoint;

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

const update = (now: Date, state: State, vehicles: Vehicle[]) => {
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;
  let numberOfUpdatesInSession = state.statistics.numberOfUpdatesInSession;

  let updatedVehicles = {
    ...state.vehicles,
  };

  vehicles.forEach((vehicle) => {
    numberOfUpdatesInSession++;
    if (parseISO(vehicle.expiration) < now) {
      console.debug("rejecting expired vehicle during update", vehicle);
      numberOfExpiredVehicles++;
    } else {
      const vehicleMapPoint: VehicleMapPoint = {
        icon: vehicle.mode.toLowerCase(),
        vehicle,
      };

      if (isBefore(addSeconds(parseISO(vehicle.lastUpdated), 10), now)) {
        vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
      }

      if (updatedVehicles[vehicle.vehicleId]) {
        if (
          parseISO(vehicle.lastUpdated) >
          parseISO(updatedVehicles[vehicle.vehicleId].vehicle.lastUpdated)
        ) {
          console.debug(
            "found new update for vehicle during hydration/update",
            vehicle
          );
          updatedVehicles[vehicle.vehicleId] = vehicleMapPoint;
        }
      } else {
        updatedVehicles[vehicle.vehicleId] = vehicleMapPoint;
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

const expire = (now: Date, state: State) => {
  let numberOfExpiredVehicles = state.statistics.numberOfExpiredVehicles;

  let vehicles = Object.values(state.vehicles).reduce(
    (acc: any, vehicleMapPoint: VehicleMapPoint) => {
      if (isBefore(parseISO(vehicleMapPoint.vehicle.expiration), now)) {
        console.debug("expire vehicle", vehicleMapPoint.vehicle);
        numberOfExpiredVehicles++;
        return acc;
      }

      if (
        isBefore(
          addSeconds(parseISO(vehicleMapPoint.vehicle.lastUpdated), 10),
          now
        )
      ) {
        if (vehicleMapPoint.icon.indexOf("_inactive") === -1) {
          vehicleMapPoint.icon = vehicleMapPoint.icon + "_inactive";
        }
      }
      acc[vehicleMapPoint.vehicle.vehicleId] = vehicleMapPoint;
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
  const now = new Date();
  switch (action.type) {
    case ActionType.HYDRATE:
      return hydrate(now, state, action?.payload! as Vehicle[]);
    case ActionType.UPDATE:
      return update(now, state, action?.payload! as Vehicle[]);
    case ActionType.EXPIRE:
      return expire(now, state);
  }
};

export default function useVehicleReducer() {
  return useReducer(reducer, initialState);
}
