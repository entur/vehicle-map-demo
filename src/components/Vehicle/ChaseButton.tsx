import Tooltip from "@mui/material/Tooltip";

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
        {/* A camera looking along a road that narrows toward the horizon. */}
        <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
          <path
            d="M14 36 19 14M26 36 21 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M20 30v-3M20 22v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="11" y="4" width="14" height="9" rx="2" fill="currentColor" />
          <path d="M25 7l5-3v9l-5-3z" fill="currentColor" />
        </svg>
      </button>
    </Tooltip>
  );
}
