import React from 'react';
import {Map} from '../Map';
import {SideBar} from 'components/SideBar';
import useVehicleData from 'hooks/useVehicleData';
import './App.scss';

export const App = () => {
  const vehicles = useVehicleData()

  return (
    <div className="App">
      <SideBar />
      <div className="map-wrapper">
        <Map data={Object.values(vehicles)} />
      </div>
    </div>
  );
}
