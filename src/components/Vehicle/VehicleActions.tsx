import { Box } from "@mui/material";
import { VehicleUpdateComplete } from "../../types.ts";
import { FollowButton } from "./FollowButton.tsx";
import { ChaseButton } from "./ChaseButton.tsx";
import { DetailsButton } from "./DetailsButton.tsx";

export type VehicleActionHandlers = {
  isFollowing: boolean;
  onFollow: () => void;
  onChase: () => void;
};

type VehicleActionsProps = VehicleActionHandlers & {
  vehicleData: VehicleUpdateComplete;
};

/**
 * What can be done with the selected vehicle: follow it, chase it, open its
 * raw details. One row in the selected vehicle's panel, on every screen.
 */
export function VehicleActions({
  vehicleData,
  isFollowing,
  onFollow,
  onChase,
}: VehicleActionsProps) {
  return (
    <Box sx={{ display: "flex", gap: "4px" }}>
      <FollowButton isFollowing={isFollowing} onClick={onFollow} />
      <ChaseButton onClick={onChase} />
      <DetailsButton vehicleData={vehicleData} />
    </Box>
  );
}
