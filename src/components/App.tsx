import { useState } from "react";
import { Filter, MapViewOptions } from "../types.ts";
import { useVehiclePositionsData } from "../hooks/useVehiclePositionsData.ts";
import { MapView } from "./MapView.tsx";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme.ts";
import { useFilterQueryParams } from "../hooks/useFilterQueryParams.ts";
import { useModeQueryParam } from "../hooks/useModeQueryParam.ts";
import { SituationsProvider } from "../situations/SituationsProvider.tsx";
import {
  AppMode,
  isSituationsFeedEnabled,
  isVehicleFeedEnabled,
} from "../domain/appMode.ts";

function App() {
  const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
  const [mode, setMode] = useState<AppMode>("vehicles");
  const [mapViewOptions, setMapViewOptions] = useState<MapViewOptions>({
    showVehicleTraces: false,
    showVehicles: true,
    showDelay: true,
    showUpdateFrequency: false,
    showDeadUpdateFrequency: false,
    showVehicleHeatmap: false,
    showOccupancy: false,
    showAffectedStops: true,
    showAffectedLines: true,
  });
  const data = useVehiclePositionsData(
    currentFilter,
    mapViewOptions,
    isVehicleFeedEnabled(mode),
  );
  useFilterQueryParams(currentFilter, setCurrentFilter);
  useModeQueryParam(mode, setMode);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ThemeProvider theme={theme}>
        <SituationsProvider
          codespaceId={currentFilter?.codespaceId}
          enabled={isSituationsFeedEnabled(mode)}
        >
          <MapView
            mode={mode}
            setMode={setMode}
            data={data}
            setCurrentFilter={setCurrentFilter}
            currentFilter={currentFilter}
            mapViewOptions={mapViewOptions}
            setMapViewOptions={setMapViewOptions}
          />
        </SituationsProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
