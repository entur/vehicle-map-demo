import {useState} from "react";
import {Filter} from "./types.ts";
import {useVehiclePositionsData} from "./useVehiclePositionsData.ts";
import {MapView} from "./MapView.tsx";

function App() {
    const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
    const data = useVehiclePositionsData(currentFilter);
  return (
      <div style={{width:'100vw', height:'100vh'}}>
        <MapView data={data} setCurrentFilter={setCurrentFilter} />
      </div>
  );
}

export default App;
