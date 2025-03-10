import { InfoBox } from "../InfoBox.tsx";
import { MapLayers } from "../MapLayers.tsx";
import { ContentType } from "./types.ts";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";
import { FilterBox } from "../FilterBox.tsx";

type DrawerContentProps = {
  activeContent: ContentType;
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
  data,
}: DrawerContentProps) => {
  return (
    <>
      {activeContent === "filtering" && currentFilter && (
        <FilterBox
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      )}

      {activeContent === "info" && currentFilter && (
        <InfoBox title={"Info"} data={data} />
      )}
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
