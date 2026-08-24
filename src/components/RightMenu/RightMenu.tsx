import { useEffect, useState } from "react";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { RightContentType } from "./types.ts";
import { ModeSwitch } from "../ModeSwitch.tsx";
import { AppMode } from "../../domain/appMode.ts";

interface RightMenuProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
}

export const RightMenu = ({
  mode,
  setMode,
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
  data,
}: RightMenuProps) => {
  const [activeContent, setActiveContent] = useState<RightContentType | null>(
    null,
  );

  // Switching modes can remove the tool whose drawer is open — leaving a
  // situations panel on screen in vehicles mode with no button to close it.
  useEffect(() => {
    setActiveContent(null);
  }, [mode]);

  return (
    <>
      <ModeSwitch
        mode={mode}
        setMode={setMode}
        drawerOpen={activeContent !== null}
      />
      <RightMenuButtons
        mode={mode}
        activeContent={activeContent}
        setActiveContent={setActiveContent}
      />
      <div className={`right-menu-container ${activeContent ? "open" : ""}`}>
        {activeContent && (
          <DrawerContent
            mode={mode}
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
