import { IconButton, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { ReactElement } from "react";
import {
  ColorSchemeMode,
  nextColorSchemeMode,
} from "../domain/colorSchemeMode.ts";

const ICONS: Record<ColorSchemeMode, ReactElement> = {
  system: <BrightnessAutoIcon fontSize="small" />,
  light: <LightModeIcon fontSize="small" />,
  dark: <DarkModeIcon fontSize="small" />,
};

/** Cycles system → light → dark. MUI persists the choice. */
export function ColorSchemeToggle() {
  const { mode, setMode } = useColorScheme();
  // `mode` is undefined until MUI has read storage. Show `system` rather than
  // nothing so the pill does not change width.
  const current: ColorSchemeMode = mode ?? "system";
  const label = `Theme: ${current}`;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        onClick={() => setMode(nextColorSchemeMode(current))}
        sx={{ borderRadius: "6px", color: "text.secondary" }}
      >
        {ICONS[current]}
      </IconButton>
    </Tooltip>
  );
}
