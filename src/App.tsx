import React, { useEffect, useReducer } from 'react';
import './App.css';
import Map from './Map';
import { gql, useSubscription } from '@apollo/client';

const VEHICLE_UPDATES_SUBSCRIPTION = gql`
  subscription VehicleUpdates {
    vehicleUpdates {
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
  }
`;

type State = any;
type Action = any;

const reducer = (state: State, action: Action) => {
  const payload = action.payload;
  state[payload.vehicleUpdates.vehicleId] = payload.vehicleUpdates;
  return state;
}

function App() {
  const [vehicles, dispatch] = useReducer(reducer, {});
  const {
    data,
  } = useSubscription(VEHICLE_UPDATES_SUBSCRIPTION);

  useEffect(() => {
    if (data && data.vehicleUpdates) {
      dispatch({ payload: data });
    }
  }, [data]);

  return (
    <div className="App">
      <Map data={Object.values(vehicles)} />
    </div>
  );
}

export default App;
