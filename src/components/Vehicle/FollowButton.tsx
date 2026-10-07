import { IconButton, Tooltip } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationDisabledIcon from "@mui/icons-material/LocationDisabled";
import { VEHICLE_ACTION_SX } from "./vehicleAction.ts";

type FollowButtonProps = {
  isFollowing: boolean;
  onClick: () => void;
};

export function FollowButton({ isFollowing, onClick }: FollowButtonProps) {
  const label = isFollowing ? "Stop Following" : "Follow";
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick} sx={VEHICLE_ACTION_SX}>
        {isFollowing ? (
          <LocationDisabledIcon fontSize="small" />
        ) : (
          <MyLocationIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
