import { useState } from "react";
import { Filter, VehicleUpdate } from "../../types.ts";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { ContentType } from "./types.ts";
import { MapViewOptions } from "../MapView.tsx";

interface RightMenuProps {
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
}

export const RightMenu = ({
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
  data,
}: RightMenuProps) => {
  const [activeContent, setActiveContent] = useState<ContentType | null>(null);

  return (
    <>
      <RightMenuButtons
        activeContent={activeContent}
        setActiveContent={setActiveContent}
      />
      <div className={`right-menu-container ${activeContent ? "open" : ""}`}>
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
