import { Alert, Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import { SelectedVehicle } from "../Vehicle/VehicleMarkers.tsx";
import { useVehicleUpdateCompleteSubscription } from "../../hooks/useVehicleUpdateCompleteSubscription.ts";
import { useTimetableSubscription } from "../../hooks/useTimetableSubscription.ts";
import { delayBucket, delayColour, formatDelay } from "./delayThresholds.ts";
import { Timetable } from "./Timetable.tsx";
import { SituationList } from "./SituationList.tsx";
import { DETAIL_PANEL_SX } from "../detailDrawer.ts";
import { FloatingCard } from "../FloatingCard.tsx";

type SelectedVehiclePanelProps = {
  selectedVehicle: SelectedVehicle | null;
  onClose: () => void;
  onCancellationChange?: (cancelled: boolean) => void;
};

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

  if (!open) return null;

  return (
    <FloatingCard
      role="region"
      aria-label="Selected vehicle"
      sx={DETAIL_PANEL_SX}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
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
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {tripCancelled && (
        <Alert severity="error" sx={{ marginTop: 1, paddingY: 0 }}>
          Trip cancelled
        </Alert>
      )}

      <SituationList
        key={serviceJourneyId}
        situations={timetable?.situations ?? null}
      />

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
    </FloatingCard>
  );
}
