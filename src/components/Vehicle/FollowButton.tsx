import Tooltip from "@mui/material/Tooltip";
import followIcon from "../../static/images/follow.png";
import stopFollowIcon from "../../static/images/stopFollow.png";

type FollowButtonProps = {
  isFollowing: boolean;
  onClick: () => void;
};

export function FollowButton({ isFollowing, onClick }: FollowButtonProps) {
  return (
    <Tooltip title={isFollowing ? "Stop Following" : "Follow"}>
      <button className="round-icon-button" onClick={onClick}>
        <img
          src={isFollowing ? stopFollowIcon : followIcon}
          alt={isFollowing ? "Stop Following" : "Follow"}
          className="icon"
        />
      </button>
    </Tooltip>
  );
}
