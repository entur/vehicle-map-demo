import React from 'react';
import {Map} from '../Map';
import {ControlPanel} from 'components/ControlPanel';
import useVehicleData from 'hooks/useVehicleData';
import './App.scss';

export const App = () => {
  const vehicles = useVehicleData()

  return (
    <div className="App">
      <ControlPanel />
      <div className="map-wrapper">
        <Map data={Object.values(vehicles)} />
      </div>
    </div>
  );
}
