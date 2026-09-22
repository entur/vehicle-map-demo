import { useState } from "react";
import { Filter, MapViewOptions } from "../types.ts";
import { useVehiclePositionsData } from "../hooks/useVehiclePositionsData.ts";
import { MapView } from "./MapView.tsx";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { COLOR_SCHEME_STORAGE_KEY, theme } from "./theme.ts";
import { useFilterQueryParams } from "../hooks/useFilterQueryParams.ts";
import { useModeQueryParam } from "../hooks/useModeQueryParam.ts";
import { useViewDimensionQueryParam } from "../hooks/useViewDimensionQueryParam.ts";
import { ViewDimension } from "../domain/viewDimension.ts";
import { SituationsProvider } from "../situations/SituationsProvider.tsx";
import {
  AppMode,
  isSituationsFeedEnabled,
  isVehicleFeedEnabled,
} from "../domain/appMode.ts";

function App() {
  const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
  const [mode, setMode] = useState<AppMode>("vehicles");
  const [viewDimension, setViewDimension] = useState<ViewDimension>("2d");
  // Base map context shared by both modes, so not a MapViewOptions key: those
  // are single-mode switches and re-open the vehicle subscription.
  const [showTransitNetwork, setShowTransitNetwork] = useState(true);
  const [mapViewOptions, setMapViewOptions] = useState<MapViewOptions>({
    showVehicleTraces: false,
    showVehicles: true,
    showDelay: false,
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
  useViewDimensionQueryParam(viewDimension, setViewDimension);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ThemeProvider
        theme={theme}
        modeStorageKey={COLOR_SCHEME_STORAGE_KEY}
        // Client-only app: read the stored mode on the first render instead
        // of rendering once with no mode and again after mount.
        noSsr
      >
        <CssBaseline enableColorScheme />
        <SituationsProvider
          codespaceId={currentFilter?.codespaceId}
          enabled={isSituationsFeedEnabled(mode)}
        >
          <MapView
            mode={mode}
            setMode={setMode}
            viewDimension={viewDimension}
            setViewDimension={setViewDimension}
            showTransitNetwork={showTransitNetwork}
            setShowTransitNetwork={setShowTransitNetwork}
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
