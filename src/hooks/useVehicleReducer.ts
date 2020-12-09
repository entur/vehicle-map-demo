import { addMinutes, addSeconds, isBefore, parseISO } from "date-fns";
import { Vehicle } from "model/vehicle";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { useReducer } from "react";

type State = {
  vehicles: Record<string, VehicleMapPoint>;
}

export enum ActionType {
  HYDRATE,
  UPDATE,
  EXPIRE,
};

export type Action = {
  type: ActionType,
  payload?: Vehicle[]
};

const initialState: State = {
  vehicles: {}
};

const reduceVehicles = ((acc: any, vehicle: Vehicle) => {
  const now = new Date();
  if (parseISO(vehicle.expiration) < now) {
    console.debug('rejecting expired vehicle during hydration/update', vehicle);
    return acc;
  }

  const vehicleMapPoint: VehicleMapPoint = { icon: vehicle.mode.toLowerCase(), vehicle };

  if (isBefore(addMinutes(parseISO(acc[vehicle.vehicleId]), 1), now)) {
    vehicleMapPoint.icon = vehicleMapPoint.icon + '_inactive';
  }

  if (acc[vehicle.vehicleId]) {
    if (parseISO(vehicle.lastUpdated) > parseISO(acc[vehicle.vehicleId].lastUpdated)) {
      console.debug('found new update for vehicle during hydration/update', vehicle);
      acc[vehicle.vehicleId] = vehicleMapPoint;
    }
  } else {
    acc[vehicle.vehicleId] = vehicleMapPoint;
  }

  return acc;
});

const expireVehicles = ((acc: any, vehicleMapPoint: VehicleMapPoint) => {
  const now = new Date();
  if (isBefore(parseISO(vehicleMapPoint.vehicle.expiration), now)) {
    console.debug('expire vehicle', vehicleMapPoint.vehicle);
    return acc;
  }

  if (isBefore(addSeconds(parseISO(vehicleMapPoint.vehicle.lastUpdated), 60), now)) {
    if (vehicleMapPoint.icon.indexOf('_inactive') === -1)
    vehicleMapPoint.icon = vehicleMapPoint.icon + '_inactive';
  }

  acc[vehicleMapPoint.vehicle.vehicleId] = vehicleMapPoint;
  return acc;
})


const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case ActionType.HYDRATE:
      return {
        vehicles: action?.payload?.reduce(reduceVehicles, {})
      }
    case ActionType.UPDATE:
      return {
        vehicles: {
          ...state.vehicles,
          ...action?.payload?.reduce(reduceVehicles, {})
        }
      }
    case ActionType.EXPIRE:
      return {
        vehicles: {
          ...Object.values(state.vehicles).reduce(expireVehicles, {})
        }
      }
  }
}

export default function useVehicleReducer() {
  const [{vehicles}, dispatch] = useReducer(reducer, initialState);
  return [vehicles, dispatch];
}
