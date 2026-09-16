import Tooltip from "@mui/material/Tooltip";
// `?url`: vite-svg-loader would otherwise turn the import into a component.
import chaseIcon from "../../static/images/chase.svg?url";

type ChaseButtonProps = {
  onClick: () => void;
};

/** Starts the chase camera; it is stopped from the chase camera's own bar. */
export function ChaseButton({ onClick }: ChaseButtonProps) {
  return (
    <Tooltip title="Chase camera">
      <button
        className="round-icon-button"
        onClick={onClick}
        aria-label="Chase camera"
      >
        <img src={chaseIcon} alt="" className="icon" />
      </button>
    </Tooltip>
  );
}
