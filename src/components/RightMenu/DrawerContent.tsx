import { MapLayers } from "../MapLayers.tsx";
import { RightContentType } from "./types.ts";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";
import { FilterBox } from "../FilterBox.tsx";
import { Legend } from "../Legend.tsx";

type DrawerContentProps = {
  activeContent: RightContentType;
  currentFilter: Filter | null | undefined;
  setCurrentFilter: (filter: Filter) => void;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
};

export const DrawerContent = ({
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
    </>
  );
};
