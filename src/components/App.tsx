import { useState } from "react";
import { Filter, MapViewOptions } from "../types.ts";
import { useVehiclePositionsData } from "../hooks/useVehiclePositionsData.ts";
import { MapView } from "./MapView.tsx";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme.ts";
import { useFilterQueryParams } from "../hooks/useFilterQueryParams.ts";

function App() {
  const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
  const [mapViewOptions, setMapViewOptions] = useState<MapViewOptions>({
    showVehicleTraces: false,
    showVehicles: true,
    showDelay: true,
    showUpdateFrequency: false,
    showDeadUpdateFrequency: false,
    showVehicleHeatmap: false,
  });
  const data = useVehiclePositionsData(currentFilter, mapViewOptions);
  useFilterQueryParams(currentFilter, setCurrentFilter);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ThemeProvider theme={theme}>
        <MapView
          data={data}
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
      </ThemeProvider>
    </div>
  );
}

export default App;
