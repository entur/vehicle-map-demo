import Tooltip from "@mui/material/Tooltip";
import detailsIcon from "../../static/images/details.png";
import { useState } from "react";
import { VehicleDetailsDialog } from "./VehicleDetailsDialog.tsx";
import { VehicleUpdateComplete } from "../../types.ts";

type DetailsButtonProps = {
  vehicleData: VehicleUpdateComplete | null;
};

export function DetailsButton({ vehicleData }: DetailsButtonProps) {
  if (!vehicleData) {
    return null;
  }
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <Tooltip title={"Show details"}>
        <button
          className="round-icon-button"
          onClick={() => setDetailsOpen(true)}
        >
          <img src={detailsIcon} alt="Follow" className="icon" />
        </button>
      </Tooltip>

      <VehicleDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        vehicleData={vehicleData}
      />
    </>
  );
}
