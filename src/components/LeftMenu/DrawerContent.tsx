import { LeftContentType } from "./types.ts";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { InfoBox } from "../InfoBox.tsx";

type DrawerContentProps = {
  activeContent: LeftContentType;
  currentFilter: Filter | null | undefined;
  setCurrentFilter: (filter: Filter) => void;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
};

export const DrawerContent = ({
  activeContent,
  currentFilter,
  data,
}: DrawerContentProps) => {
  return (
    <>
      {activeContent === "statistics" && currentFilter && (
        <InfoBox data={data} />
      )}
    </>
  );
};
