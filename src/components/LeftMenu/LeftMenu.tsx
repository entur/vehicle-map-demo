import { useState } from "react";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { LeftMenuButtons } from "./LeftMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { LeftContentType } from "./types.ts";
import { AppMode } from "../../domain/appMode.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";

interface LeftMenuProps {
  mode: AppMode;
  viewDimension: ViewDimension;
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
}

export const LeftMenu = ({
  mode,
  viewDimension,
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
  data,
}: LeftMenuProps) => {
  const [activeContent, setActiveContent] = useState<LeftContentType | null>(
    null,
  );

  // The left rail holds vehicle statistics only.
  if (mode !== "vehicles") return null;

  return (
    <>
      <LeftMenuButtons
        activeContent={activeContent}
        setActiveContent={setActiveContent}
        viewDimension={viewDimension}
      />
      <div className={`left-menu-container ${activeContent ? "open" : ""}`}>
        {activeContent && (
          <DrawerContent
            activeContent={activeContent}
            currentFilter={currentFilter}
            setCurrentFilter={setCurrentFilter}
            mapViewOptions={mapViewOptions}
            setMapViewOptions={setMapViewOptions}
            data={data}
          />
        )}
      </div>
    </>
  );
};
