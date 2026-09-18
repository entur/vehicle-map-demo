import { IconButton, Tooltip } from "@mui/material";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useState } from "react";
import { VehicleDetailsDialog } from "./VehicleDetailsDialog.tsx";
import { VehicleUpdateComplete } from "../../types.ts";
import { POPUP_ACTION_SX } from "./popupAction.ts";

type DetailsButtonProps = {
  vehicleData: VehicleUpdateComplete | null;
};

export function DetailsButton({ vehicleData }: DetailsButtonProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!vehicleData) {
    return null;
  }
  return (
    <>
      <Tooltip title="Show details">
        <IconButton
          aria-label="Show details"
          onClick={() => setDetailsOpen(true)}
          sx={POPUP_ACTION_SX}
        >
          <ListAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <VehicleDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        vehicleData={vehicleData}
      />
    </>
  );
}
