import { CodespaceFilter } from "../CodespaceFilter.tsx";
import { OperatorFilter } from "../OperatorFilter.tsx";
import { MetadataBox } from "../MetadataBox.tsx";
import { MapLayerToggles } from "../MapLayerToggles.tsx";
import { ContentType } from "./types.ts";
import { Filter, VehicleUpdate } from "../../types.ts";
import { DataChecker } from "../DataChecker/DataChecker.tsx";
import { MapViewOptions } from "../MapView.tsx";
import { ShowVehicleTracesCheckbox } from "./ShowVehicleTracesCheckbox.tsx";

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
      {activeContent === "filtering" && (
        <ShowVehicleTracesCheckbox
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
      )}
      {activeContent === "metadata" && currentFilter && (
        <MetadataBox title={"Metadata"} data={data} />
      )}
      {activeContent === "layers" && currentFilter && <MapLayerToggles />}
      {activeContent === "stoplight" && currentFilter && <DataChecker />}
    </>
  );
};
