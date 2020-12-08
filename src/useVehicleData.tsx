import { gql, useQuery, useSubscription } from '@apollo/client';
import { addMinutes, addSeconds, isBefore, parseISO } from 'date-fns';
import { useEffect, useReducer } from "react";

const VEHICLE_FRAGMET = gql`
  fragment VehicleFragment on VehicleUpdate {
    codespaceId
    vehicleId
    direction
    lineName
    lineRef
    serviceJourneyId
    operator
    mode
    lastUpdated
    expiration
    speed
    heading
    monitored
    delay
    location {
      latitude
      longitude
    }
  }
`;

const VEHICLES_QUERY = gql`
  query VehiclesQuery {
    vehicles {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMET}
`;

const VEHICLE_UPDATES_SUBSCRIPTION = gql`
  subscription VehicleUpdates {
    vehicleUpdates {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMET}
`;

export type Vehicle = {
  codespaceId: string;
  vehicleId: string;
  direction: string | number;
  lineName: string;
  lineRef: string;
  serviceJourneyId: string;
  operator: string;
  mode: string;
  lastUpdated: string;
  expiration: string;
  speed: number;
  heading: number;
  monitored: boolean;
  delay: number;
  location: {
    latitude: number;
    longitude: number;
  }
};

export type VehicleMapPoint = {
  icon: string;
  vehicle: Vehicle;
};

type State = {
  vehicles: Record<string, VehicleMapPoint>;
}

enum ActionType {
  HYDRATE,
  UPDATE,
  EXPIRE,
};

type Action = {
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

export default function useVehicleData() {
  const [{vehicles}, dispatch] = useReducer(reducer, initialState);

  const {
    data: hydrationData,
  } = useQuery(VEHICLES_QUERY);

  const {
    data: subscriptionData,
  } = useSubscription(VEHICLE_UPDATES_SUBSCRIPTION);

  useEffect(() => {
    if (hydrationData && hydrationData.vehicles) {
      dispatch({ type: ActionType.HYDRATE, payload: hydrationData.vehicles });
    }
  }, [hydrationData]);

  useEffect(() => {
    if (subscriptionData && subscriptionData.vehicleUpdates) {
      dispatch({ type: ActionType.UPDATE, payload: [subscriptionData.vehicleUpdates] });
    }
  }, [subscriptionData]);

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: ActionType.EXPIRE });
    }, 5000);

    return () => {
      clearInterval(timer);
    }
  })

  return vehicles;
}
