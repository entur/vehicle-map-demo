import React from 'react';
import Map from './Map';
import useVehicleData from './useVehicleData';

function App() {
  const vehicles = useVehicleData()

  return (
    <div className="App">
      <Map data={Object.values(vehicles)} />
    </div>
  );
}

export default App;
