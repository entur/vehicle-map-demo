import React, { useEffect, useReducer } from 'react';
import './App.css';
import Map from './Map';
import { gql, useQuery, useSubscription } from '@apollo/client';

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

type State = any;
type Action = any;

const reducer = (state: State, action: Action) => {
  const payload = action.payload;
  payload.forEach((vehicle: any) => {
    state[vehicle.vehicleId] = vehicle;
  })

  return state;
}

function App() {
  const [vehicles, dispatch] = useReducer(reducer, {});

  const {
    data: hydrationData
  } = useQuery(VEHICLES_QUERY);

  const {
    data,
  } = useSubscription(VEHICLE_UPDATES_SUBSCRIPTION);

  useEffect(() => {
    if (hydrationData && hydrationData.vehicles) {
      dispatch({ payload: hydrationData.vehicles });
    }
  }, [hydrationData]);

  useEffect(() => {
    if (data && data.vehicleUpdates) {
      dispatch({ payload: [data.vehicleUpdates] });
    }
  }, [data]);

  return (
    <div className="App">
      <Map data={Object.values(vehicles)} />
    </div>
  );
}

export default App;
