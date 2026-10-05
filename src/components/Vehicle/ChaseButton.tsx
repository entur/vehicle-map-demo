import { IconButton, Tooltip } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import { POPUP_ACTION_SX } from "./popupAction.ts";

type ChaseButtonProps = {
  onClick: () => void;
};

/** Starts the chase camera; it is stopped from the chase camera's own bar. */
export function ChaseButton({ onClick }: ChaseButtonProps) {
  return (
    <Tooltip title="Chase camera">
      <IconButton
        aria-label="Chase camera"
        onClick={onClick}
        sx={POPUP_ACTION_SX}
      >
        <VideocamIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
