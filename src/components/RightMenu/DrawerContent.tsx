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
        />
      )}
      {activeContent === "stoplight" && currentFilter && <DataChecker />}
      {activeContent === "situations" && <SituationsPanel />}
    </>
  );
};
