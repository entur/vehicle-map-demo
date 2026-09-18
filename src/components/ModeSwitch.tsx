import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { AppMode } from "../domain/appMode.ts";
import { FloatingCard } from "./FloatingCard.tsx";
import { ColorSchemeToggle } from "./ColorSchemeToggle.tsx";

type Props = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

/**
 * Always visible, because mode governs which subscription is open. Putting it
 * inside a drawer — which is closed by default — would leave the app with no
 * on-screen indication of which feed is running.
 */
export function ModeSwitch({ mode, setMode }: Props) {
  return (
    <FloatingCard
      sx={{ display: "flex", alignItems: "center", gap: 0.5, padding: 0.5 }}
    >
      <ToggleButtonGroup
        value={mode}
        exclusive
        size="small"
        onChange={(_event, next: AppMode | null) => {
          // MUI reports null when the active button is clicked again. Mode is
          // never absent, so that is a no-op rather than a deselection.
          if (next) setMode(next);
        }}
      >
        <ToggleButton value="vehicles">Vehicles</ToggleButton>
        <ToggleButton value="situations">Situations</ToggleButton>
      </ToggleButtonGroup>
      <ColorSchemeToggle />
    </FloatingCard>
  );
}
