import { Box, Typography } from "@mui/material";
import { useState } from "react";
import {
  OCCUPANCY_FEW,
  OCCUPANCY_FULL,
  OCCUPANCY_NOT_BOARDING,
  OCCUPANCY_OK,
  OCCUPANCY_STANDING,
  SEVERITY_SEVERE,
} from "../../domain/dataColours.ts";
import { Call } from "../../types.ts";
import { resolveCallTimes } from "./callTimes.ts";
import { delayBucket, delayColour } from "./delayThresholds.ts";
import { SituationList } from "./SituationList.tsx";
import { severityColour, worstSeverity } from "./situationSeverity.ts";

type StopRowProps = {
  call: Call;
  isCurrent: boolean;
};

const OCCUPANCY_DISPLAY: Record<string, { label: string; colour: string }> = {
  empty: { label: "Empty", colour: OCCUPANCY_OK },
  manySeatsAvailable: { label: "Many seats available", colour: OCCUPANCY_OK },
  seatsAvailable: { label: "Seats available", colour: OCCUPANCY_OK },
  fewSeatsAvailable: { label: "Few seats available", colour: OCCUPANCY_FEW },
  standingAvailable: {
    label: "Standing room available",
    colour: OCCUPANCY_STANDING,
  },
  standingRoomOnly: {
    label: "Standing room only",
    colour: OCCUPANCY_STANDING,
  },
  crushedStandingRoomOnly: { label: "Crowded", colour: OCCUPANCY_FULL },
  full: { label: "Full", colour: OCCUPANCY_FULL },
  notAcceptingPassengers: {
    label: "Not boarding",
    colour: OCCUPANCY_NOT_BOARDING,
  },
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

export function StopRow({ call, isCurrent }: StopRowProps) {
  const isPast = call.callType === "RECORDED";
  const isCancelled = call.cancellation;

  const { aimed, realtime, delaySeconds } = resolveCallTimes(call);
  const aimedLabel = formatTime(aimed);
  const realtimeLabel = formatTime(realtime);

  const bucket = delayBucket(delaySeconds);
  const realtimeColour = delayColour(bucket);
  const showAimed =
    aimedLabel !== null &&
    realtimeLabel !== null &&
    aimedLabel !== realtimeLabel;

  const occupancy = call.occupancyStatus
    ? OCCUPANCY_DISPLAY[call.occupancyStatus]
    : undefined;

  const [showSituations, setShowSituations] = useState(false);
  const situations = call.situations ?? [];
  const hasSituations = situations.length > 0;
  const situationColour = severityColour(worstSeverity(situations));

  const dotStyle: React.CSSProperties = {
    width: isCurrent ? 14 : 10,
    height: isCurrent ? 14 : 10,
    borderRadius: "50%",
    background: isCurrent
      ? "var(--mui-palette-selection-main)"
      : isPast
        ? "var(--mui-palette-text-disabled)"
        : "var(--mui-palette-text-secondary)",
    border: isCurrent ? "2px solid var(--mui-palette-text-primary)" : "none",
    zIndex: 1,
    position: "relative",
    boxSizing: "border-box",
  };

  if (isCancelled) {
    dotStyle.background = "transparent";
    dotStyle.border = `2px solid ${
      isPast
        ? "var(--mui-palette-text-disabled)"
        : "var(--mui-palette-text-secondary)"
    }`;
  }

  return (
    <Box
      sx={{
        borderBottom: "1px dotted var(--mui-palette-divider)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: "5px 0",
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
              background: "var(--mui-palette-divider)",
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
            <Typography
              component="div"
              sx={{ fontSize: 10, color: "text.disabled" }}
            >
              {aimedLabel}
            </Typography>
          )}
          <Typography
            component="div"
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: isCancelled ? SEVERITY_SEVERE : realtimeColour,
            }}
          >
            {isCancelled ? "—" : (realtimeLabel ?? aimedLabel ?? "—")}
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
            color: isCancelled ? SEVERITY_SEVERE : "inherit",
          }}
        >
          {call.stopPoint.name}
          {isCancelled && (
            <Typography
              component="span"
              sx={{ marginLeft: 1, fontSize: 10, color: SEVERITY_SEVERE }}
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

        {hasSituations && (
          <Box
            component="button"
            type="button"
            onClick={() => setShowSituations((open) => !open)}
            aria-expanded={showSituations}
            aria-label={`${situations.length} deviation ${
              situations.length === 1 ? "message" : "messages"
            } for ${call.stopPoint.name}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              marginLeft: 0.5,
              padding: 0,
              flexShrink: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              color: situationColour,
            }}
          >
            ⚠
          </Box>
        )}
      </Box>

      {hasSituations && showSituations && (
        <Box sx={{ paddingLeft: "34px", paddingBottom: 0.5 }}>
          <SituationList situations={situations} dense />
        </Box>
      )}
    </Box>
  );
}
