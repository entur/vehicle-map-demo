import { Box, Typography } from "@mui/material";
import { Call } from "../../types.ts";
import { delayBucket, delayColour } from "./delayThresholds.ts";

type StopRowProps = {
  call: Call;
  isCurrent: boolean;
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
      display="flex"
      alignItems="center"
      sx={{
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
    </Box>
  );
}
