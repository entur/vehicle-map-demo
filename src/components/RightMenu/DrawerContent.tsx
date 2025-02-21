import { CodespaceFilter } from "../CodespaceFilter.tsx";
import { OperatorFilter } from "../OperatorFilter.tsx";
import { MetadataBox } from "../MetadataBox.tsx";
import { MapLayerToggles } from "../MapLayerToggles.tsx";
import { ContentType } from "./types.ts";
import { Filter, VehicleUpdate } from "../../types.ts";

type DrawerContentProps = {
  activeContent: ContentType;
  currentFilter: Filter | null | undefined;
  setCurrentFilter: (filter: Filter) => void;
  data: VehicleUpdate[];
};

export const DrawerContent = ({
  activeContent,
  currentFilter,
  setCurrentFilter,
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
      {activeContent === "metadata" && currentFilter && (
        <MetadataBox title={"Metadata"} data={data} />
      )}
      {activeContent === "layers" && currentFilter && <MapLayerToggles />}
    </>
  );
};
