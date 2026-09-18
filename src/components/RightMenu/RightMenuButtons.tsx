import { IconButton, Tooltip } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import BarChartIcon from "@mui/icons-material/BarChart";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { ReactElement } from "react";
import { AppMode, rightRailTools } from "../../domain/appMode.ts";
import { FloatingCard } from "../FloatingCard.tsx";
import { RightContentType } from "./types.ts";
import { TOOL_LABELS } from "./toolLabels.ts";

const ICONS: Record<RightContentType, ReactElement> = {
  layers: <LayersIcon fontSize="small" />,
  filtering: <FilterListIcon fontSize="small" />,
  info: <InfoOutlinedIcon fontSize="small" />,
  stoplight: <FactCheckIcon fontSize="small" />,
  statistics: <BarChartIcon fontSize="small" />,
  situations: <WarningAmberIcon fontSize="small" />,
  situationStats: <AssessmentIcon fontSize="small" />,
};

type RightMenuButtonsProps = {
  mode: AppMode;
  activeContent: RightContentType | null;
  setActiveContent: (contentType: RightContentType | null) => void;
};

export const RightMenuButtons = ({
  mode,
  activeContent,
  setActiveContent,
}: RightMenuButtonsProps) => (
  <FloatingCard
    role="group"
    aria-label="Tools"
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 0.25,
      padding: 0.5,
      flexShrink: 0,
    }}
  >
    {rightRailTools(mode).map((content) => {
      const label = TOOL_LABELS[content];
      const active = activeContent === content;
      return (
        <Tooltip key={content} title={label} placement="left">
          <IconButton
            aria-label={label}
            aria-pressed={active}
            onClick={() => setActiveContent(active ? null : content)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "6px",
              color: active ? "selection.main" : "text.secondary",
              bgcolor: active ? "selection.bg" : "transparent",
              "&:hover": { bgcolor: active ? "selection.bg" : "action.hover" },
            }}
          >
            {ICONS[content]}
          </IconButton>
        </Tooltip>
      );
    })}
  </FloatingCard>
);
