import { MapLayers } from "../MapLayers.tsx";
import { RightContentType } from "./types.ts";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";
import { FilterBox } from "../FilterBox.tsx";
import { Legend } from "../Legend.tsx";
import { SituationsPanel } from "../SituationsPanel";
import { AppMode } from "../../domain/appMode.ts";

type DrawerContentProps = {
  mode: AppMode;
  activeContent: RightContentType;
  currentFilter: Filter | null | undefined;
  setCurrentFilter: (filter: Filter) => void;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
};

export const DrawerContent = ({
  mode,
  activeContent,
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
}: DrawerContentProps) => {
  // Not yet used in the render body — Task 7 changes what the filter drawer
  // holds per mode. Threaded now so the prop wiring lands in this task.
  void mode;
  return (
    <>
      {activeContent === "filtering" && currentFilter && (
        <FilterBox
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      )}

      {activeContent === "info" && currentFilter && <Legend />}
      {activeContent === "layers" && currentFilter && (
        <MapLayers
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
      )}
      {activeContent === "stoplight" && currentFilter && <DataChecker />}
      {activeContent === "situations" && <SituationsPanel />}
    </>
  );
};
