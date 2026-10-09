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
