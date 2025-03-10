import { CodespaceFilter } from "../CodespaceFilter.tsx";
import { OperatorFilter } from "../OperatorFilter.tsx";
import { InfoBox } from "../InfoBox.tsx";
import { MapLayerToggles } from "../MapLayerToggles.tsx";
import { ContentType } from "./types.ts";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";

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
        <CodespaceFilter
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      )}
      {activeContent === "filtering" && currentFilter && (
        <OperatorFilter
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      )}
      {activeContent === "info" && currentFilter && (
        <InfoBox title={"Info"} data={data} />
      )}
      {activeContent === "layers" && currentFilter && (
        <MapLayerToggles
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
      )}
      {activeContent === "stoplight" && currentFilter && <DataChecker />}
    </>
  );
};
