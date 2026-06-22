import { Box, Typography } from "@mui/material";
import { Call } from "../../types.ts";
import { delayBucket, delayColour } from "./delayThresholds.ts";

type StopRowProps = {
  call: Call;
  isCurrent: boolean;
};

const OCCUPANCY_DISPLAY: Record<string, { label: string; colour: string }> = {
  empty: { label: "Empty", colour: "#1f8a3a" },
  manySeatsAvailable: { label: "Many seats available", colour: "#1f8a3a" },
  seatsAvailable: { label: "Seats available", colour: "#1f8a3a" },
  fewSeatsAvailable: { label: "Few seats available", colour: "#e6a700" },
  standingAvailable: { label: "Standing room available", colour: "#e07a1f" },
  standingRoomOnly: { label: "Standing room only", colour: "#e07a1f" },
  crushedStandingRoomOnly: { label: "Crowded", colour: "#c0392b" },
  full: { label: "Full", colour: "#c0392b" },
  notAcceptingPassengers: { label: "Not boarding", colour: "#7a1f1f" },
};

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function delaySeconds(aimed: string | null, expected: string | null): number {
  if (!aimed || !expected) return 0;
  const a = Date.parse(aimed);
  const e = Date.parse(expected);
  if (Number.isNaN(a) || Number.isNaN(e)) return 0;
  return Math.round((e - a) / 1000);
}

export function StopRow({ call, isCurrent }: StopRowProps) {
  const isPast = call.callType === "RECORDED";
  const isCancelled = call.cancellation;

  // Use departure time for non-terminal stops; the last stop's row falls back
  // to arrival because there is no departure.
  const aimed = call.aimedDepartureTime ?? call.aimedArrivalTime;
  const expected = call.expectedDepartureTime ?? call.expectedArrivalTime;
  const aimedLabel = formatTime(aimed);
  const expectedLabel = formatTime(expected);

  const deltaSeconds = delaySeconds(aimed, expected);
  const bucket = delayBucket(deltaSeconds);
  const expectedColour = delayColour(bucket);
  const showAimed =
    aimedLabel !== null &&
    expectedLabel !== null &&
    aimedLabel !== expectedLabel;

  const occupancy = call.occupancyStatus
    ? OCCUPANCY_DISPLAY[call.occupancyStatus]
    : undefined;

  const dotStyle: React.CSSProperties = {
    width: isCurrent ? 14 : 10,
    height: isCurrent ? 14 : 10,
    borderRadius: "50%",
    background: isCurrent ? "#1fcac2" : isPast ? "#bababa" : "#4a4a4a",
    border: isCurrent ? "2px solid #000" : "none",
    zIndex: 1,
    position: "relative",
    boxSizing: "border-box",
  };

  if (isCancelled) {
    dotStyle.background = "transparent";
    dotStyle.border = `2px solid ${isPast ? "#bababa" : "#4a4a4a"}`;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px dotted #eee",
        opacity: isPast && !isCurrent ? 0.55 : 1,
      }}
    >
      <Box
        sx={{
          width: 24,
          display: "flex",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 2,
            background: "#d0d0d0",
          }}
        />
        <Box sx={dotStyle} />
      </Box>

      <Box
        sx={{
          minWidth: 56,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.15,
        }}
      >
        {showAimed && (
          <Typography component="div" sx={{ fontSize: 10, color: "#999" }}>
            {aimedLabel}
          </Typography>
        )}
        <Typography
          component="div"
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: isCancelled ? "#c0392b" : expectedColour,
          }}
        >
          {isCancelled ? "—" : (expectedLabel ?? aimedLabel ?? "—")}
        </Typography>
      </Box>

      <Typography
        component="div"
        sx={{
          flex: 1,
          marginLeft: "10px",
          fontSize: 12,
          fontWeight: isCurrent ? 700 : 400,
          textDecoration: isCancelled ? "line-through" : "none",
          color: isCancelled ? "#c0392b" : "inherit",
        }}
      >
        {call.stopPoint.name}
        {isCancelled && (
          <Typography
            component="span"
            sx={{ marginLeft: 1, fontSize: 10, color: "#c0392b" }}
          >
            cancelled
          </Typography>
        )}
      </Typography>

      {occupancy && (
        <Box
          component="span"
          title={occupancy.label}
          aria-label={occupancy.label}
          sx={{
            display: "inline-flex",
            marginLeft: 1,
            flexShrink: 0,
            color: occupancy.colour,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.51 2.6-.9 4.24-.9ZM4 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm1.13 1.1A6.5 6.5 0 0 0 4 14c-.99 0-1.93.21-2.78.58A1.99 1.99 0 0 0 0 16.43V18h4.5v-1.62c0-.83.23-1.61.63-2.28ZM20 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.67.63 1.45.63 2.28V18H24v-1.57ZM12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
          </svg>
        </Box>
      )}
    </Box>
  );
}
