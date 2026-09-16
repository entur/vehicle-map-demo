import { useState } from "react";
import { Box } from "@mui/material";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { RightContentType } from "./types.ts";
import { TOOL_LABELS } from "./toolLabels.ts";
import { ModeSwitch } from "../ModeSwitch.tsx";
import { FloatingCard } from "../FloatingCard.tsx";
import { SURFACE_INSET } from "../theme.ts";
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

  // Switching modes can remove the tool whose panel is open — leaving a
  // situations panel on screen in vehicles mode with no button to close it.
  // `layers` and `filtering` exist in both modes, so a tool common to both
  // should stay open across the switch. Adjusted here, during render, rather
  // than in an effect: that avoids both the one-frame flicker of the stale
  // panel before an effect fires and a react-hooks/set-state-in-effect
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

  const panelWidth =
    activeContent !== null && isWideTool(activeContent) ? 460 : 300;

  // One flex cluster: the mode pill on top, then the tool panel beside the
  // toolbar. Nothing is positioned by hand, so nothing has to move in step.
  // Pointer events are off on the layout boxes and back on in each card, so
  // the map stays draggable in the gaps.
  return (
    <Box
      sx={{
        position: "absolute",
        top: SURFACE_INSET,
        right: SURFACE_INSET,
        bottom: SURFACE_INSET,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
      }}
    >
      <ModeSwitch mode={mode} setMode={setMode} />
      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          pointerEvents: "none",
        }}
      >
        {activeContent && (
          <FloatingCard
            role="region"
            aria-label={TOOL_LABELS[activeContent]}
            sx={{
              width: `min(${panelWidth}px, calc(100vw - 96px))`,
              maxHeight: "100%",
              overflowY: "auto",
              padding: 2,
              boxSizing: "border-box",
            }}
          >
            <DrawerContent
              mode={mode}
              activeContent={activeContent}
              currentFilter={currentFilter}
              setCurrentFilter={setCurrentFilter}
              mapViewOptions={mapViewOptions}
              setMapViewOptions={setMapViewOptions}
              data={data}
            />
          </FloatingCard>
        )}
        <RightMenuButtons
          mode={mode}
          activeContent={activeContent}
          setActiveContent={setActiveContent}
        />
      </Box>
    </Box>
  );
};
