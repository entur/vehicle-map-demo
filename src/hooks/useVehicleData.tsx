import { gql, useQuery, useSubscription } from '@apollo/client';
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

type Vehicle = any;

type State = {
  vehicles: Record<string, Vehicle>;
}

enum ActionType {
  HYDRATE,
  UPDATE,
  EXPIRE,
};

type Action = {
  type: ActionType,
  payload?: any
};

const initialState: State = {
  vehicles: {}
};

const reduceVehicles = ((acc: any, vehicle: Vehicle) => {
  if (new Date(vehicle.expiration) < new Date()) {
    console.debug('rejecting expired vehicle during hydration/update', vehicle);
    return acc;
  }

  if (acc[vehicle.vehicleId]) {
    if (new Date(vehicle.lastUpdated) > new Date(acc[vehicle.vehicleId].lastUpdated)) {
      console.debug('found new update for vehicle during hydration/update', vehicle);
      acc[vehicle.vehicleId] = vehicle;
    }
  } else {
    acc[vehicle.vehicleId] = vehicle;
  }
  return acc;
});

const expireVehicles = ((acc: any, vehicle: Vehicle) => {
  if (new Date(vehicle.expiration) < new Date()) {
    console.debug('expire vehicle', vehicle);
    return acc;
  }
  acc[vehicle.vehicleId] = vehicle;
  return acc;
})


const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case ActionType.HYDRATE:
      return {
        vehicles: action.payload.reduce(reduceVehicles, {})
      }
    case ActionType.UPDATE:
      return {
        vehicles: {
          ...state.vehicles,
          ...action.payload.reduce(reduceVehicles, {})
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
    }, 1000);

    return () => {
      clearInterval(timer);
    }
  })

  return vehicles;
}
