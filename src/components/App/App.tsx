import React from 'react';
import Map from '../Map';
import useVehicleData from '../../hooks/useVehicleData';

function App() {
  const vehicles = useVehicleData()

  return (
    <div className="App">
      <Map data={Object.values(vehicles)} />
    </div>
  );
}

export default App;
