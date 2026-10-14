import { memo } from "react";
import { MapLayers } from "../MapLayers.tsx";
import { KioskTool, RightContentType } from "./types.ts";
import { KioskPanel } from "../KioskPanel.tsx";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";
import { FilterBox } from "../FilterBox.tsx";
import { Legend } from "../Legend.tsx";
import { InfoBox } from "../InfoBox.tsx";
import { SituationsPanel } from "../SituationsPanel";
import { SituationStatsTables } from "../SituationsPanel/SituationStatsTables.tsx";
import { AppMode } from "../../domain/appMode.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";

type DrawerContentProps = {
  mode: AppMode;
  activeContent: RightContentType;
  currentFilter: Filter | null | undefined;
  setCurrentFilter: (filter: Filter) => void;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  showTransitNetwork: boolean;
  setShowTransitNetwork: (show: boolean) => void;
  showAerial: boolean;
  setShowAerial: (show: boolean) => void;
  showScheduleGhost: boolean;
  setShowScheduleGhost: (show: boolean) => void;
  showWeather: boolean;
  setShowWeather: (show: boolean) => void;
  viewDimension: ViewDimension;
  data: VehicleUpdate[];
  kiosk: KioskTool;
};

export const DrawerContent = memo(function DrawerContent({
  mode,
  activeContent,
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
  showTransitNetwork,
  setShowTransitNetwork,
  showAerial,
  setShowAerial,
  showScheduleGhost,
  setShowScheduleGhost,
  showWeather,
  setShowWeather,
  viewDimension,
  data,
  kiosk,
}: DrawerContentProps) {
  return (
    <>
      {activeContent === "filtering" && currentFilter && (
        <FilterBox
          mode={mode}
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      )}

      {activeContent === "info" && currentFilter && <Legend />}
      {activeContent === "layers" && currentFilter && (
        <MapLayers
          mode={mode}
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
          showTransitNetwork={showTransitNetwork}
          setShowTransitNetwork={setShowTransitNetwork}
          showAerial={showAerial}
          setShowAerial={setShowAerial}
          showScheduleGhost={showScheduleGhost}
          setShowScheduleGhost={setShowScheduleGhost}
          showWeather={showWeather}
          setShowWeather={setShowWeather}
          viewDimension={viewDimension}
        />
      )}
      {activeContent === "stoplight" && currentFilter && <DataChecker />}
      {activeContent === "statistics" && currentFilter && (
        <InfoBox data={data} />
      )}
      {activeContent === "situations" && <SituationsPanel />}
      {activeContent === "situationStats" && <SituationStatsTables />}
      {activeContent === "kiosk" && <KioskPanel {...kiosk} />}
    </>
  );
});
