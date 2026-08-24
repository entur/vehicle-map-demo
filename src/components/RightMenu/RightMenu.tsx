import { useState } from "react";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { RightContentType } from "./types.ts";
import { ModeSwitch } from "../ModeSwitch.tsx";
import { AppMode, isWideTool, rightRailTools } from "../../domain/appMode.ts";

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
  const [prevMode, setPrevMode] = useState(mode);

  // Switching modes can remove the tool whose drawer is open — leaving a
  // situations panel on screen in vehicles mode with no button to close it.
  // `layers` and `filtering` exist in both modes, so a tool common to both
  // should stay open across the switch. Adjusted here, during render, rather
  // than in an effect: that avoids both the one-frame flicker of the stale
  // drawer before an effect fires and a react-hooks/set-state-in-effect
  // lint error.
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (
      activeContent !== null &&
      !rightRailTools(mode).includes(activeContent)
    ) {
      setActiveContent(null);
    }
  }

  // One source for how far everything shifts, so the drawer, the rail buttons
  // and the mode switch cannot disagree about where the drawer's edge is.
  const wide = activeContent !== null && isWideTool(activeContent);

  return (
    <>
      <ModeSwitch
        mode={mode}
        setMode={setMode}
        drawerOpen={activeContent !== null}
        wide={wide}
      />
      <RightMenuButtons
        mode={mode}
        activeContent={activeContent}
        setActiveContent={setActiveContent}
        wide={wide}
      />
      <div
        className={`right-menu-container ${activeContent ? "open" : ""} ${
          wide ? "wide" : ""
        }`}
      >
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
