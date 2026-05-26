import { Box, Drawer, IconButton, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { SelectedVehicle } from "../Vehicle/VehicleMarkers.tsx";
import { useVehicleUpdateCompleteSubscription } from "../../hooks/useVehicleUpdateCompleteSubscription.ts";
import { useTimetableSubscription } from "../../hooks/useTimetableSubscription.ts";
import { delayBucket, delayColour, formatDelay } from "./delayThresholds.ts";
import { Timetable } from "./Timetable.tsx";

type SelectedVehiclePanelProps = {
  selectedVehicle: SelectedVehicle | null;
  onClose: () => void;
  onCancellationChange?: (cancelled: boolean) => void;
};

const DRAWER_WIDTH = "min(320px, 90vw)";
const DRAWER_TOP_OFFSET = 220;
const NO_TIMETABLE_TIMEOUT_MS = 3000;

export function SelectedVehiclePanel({
  selectedVehicle,
  onClose,
  onCancellationChange,
}: SelectedVehiclePanelProps) {
  const serviceJourneyId = selectedVehicle?.properties.serviceJourneyId ?? null;
  const date = selectedVehicle?.properties.date ?? null;
  const vehicleId = selectedVehicle?.properties.id ?? "";

  const vehicleData = useVehicleUpdateCompleteSubscription(
    vehicleId,
    serviceJourneyId ?? "",
  );
  const timetable = useTimetableSubscription(serviceJourneyId, date);

  // After (NO_TIMETABLE_TIMEOUT_MS) without a timetable frame, surface the
  // "not available" message. Reset whenever the selection changes.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (!serviceJourneyId) return;
    const id = window.setTimeout(
      () => setTimedOut(true),
      NO_TIMETABLE_TIMEOUT_MS,
    );
    return () => window.clearTimeout(id);
  }, [serviceJourneyId, date]);

  const open = selectedVehicle !== null;
  const currentOrder = vehicleData?.monitoredCall?.order ?? null;
  const tripCancelled = timetable?.cancellation === true;

  useEffect(() => {
    onCancellationChange?.(tripCancelled);
  }, [tripCancelled, onCancellationChange]);

  const showNotAvailable = !serviceJourneyId || (timedOut && !timetable);

  const headerTitle = vehicleData
    ? [
        vehicleData.line.publicCode,
        [vehicleData.originName, vehicleData.destinationName]
          .filter((name) => name && name !== "null")
          .join(" → "),
      ]
        .filter(Boolean)
        .join(" ")
    : "Loading…";

  return (
    <Drawer
      anchor="left"
      variant="persistent"
      open={open}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          top: DRAWER_TOP_OFFSET,
          height: `calc(100% - ${DRAWER_TOP_OFFSET}px)`,
          padding: 2,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {headerTitle}
          </Typography>
          {vehicleData && (
            <Typography variant="caption" color="text.secondary">
              {vehicleData.mode} · {vehicleData.operator?.name ?? ""} ·{" "}
              {vehicleData.codespace.codespaceId}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <Box component="span" sx={{ fontSize: 20, lineHeight: 1 }}>
            ×
          </Box>
        </IconButton>
      </Box>

      {tripCancelled && (
        <Box
          sx={{
            marginTop: 1,
            padding: 1,
            background: "#fde8e6",
            color: "#c0392b",
            borderRadius: 1,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Trip cancelled
        </Box>
      )}

      {vehicleData && (
        <Typography
          variant="body2"
          sx={{
            marginTop: 1,
            color: delayColour(delayBucket(vehicleData.delay)),
            fontWeight: 600,
          }}
        >
          {formatDelay(vehicleData.delay)}
        </Typography>
      )}

      <Box
        sx={{
          marginTop: 2,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {timetable && (
          <Timetable calls={timetable.calls} currentOrder={currentOrder} />
        )}
        {!timetable && !showNotAvailable && (
          <Typography variant="body2" color="text.secondary">
            Loading timetable…
          </Typography>
        )}
        {showNotAvailable && (
          <Typography variant="body2" color="text.secondary">
            Timetable not available for this trip.
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
