import { Alert, Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import { SelectedVehicle } from "../Vehicle/VehicleMarkers.tsx";
import { useVehicleUpdateCompleteSubscription } from "../../hooks/useVehicleUpdateCompleteSubscription.ts";
import { timetableJourneyKey } from "../../hooks/useTimetableSubscription.ts";
import { EstimatedTimetableUpdate } from "../../types.ts";
import { delayBucket, delayColour, formatDelay } from "./delayThresholds.ts";
import { Timetable } from "./Timetable.tsx";
import { SituationList } from "./SituationList.tsx";
import { DetailSheet } from "../DetailSheet.tsx";
import { DetailLayout } from "../../domain/bottomSheet.ts";
import {
  VehicleActionHandlers,
  VehicleActions,
} from "../Vehicle/VehicleActions.tsx";

type SelectedVehiclePanelProps = {
  selectedVehicle: SelectedVehicle | null;
  /**
   * The selected journey's timetable. Subscribed in `MapView`, which the
   * schedule ghost needs it in too.
   */
  timetable: EstimatedTimetableUpdate | null;
  onClose: () => void;
  layout: DetailLayout;
  /**
   * Follow, chase, details. Here rather than in a popup at the vehicle: the
   * popup covered the map around the vehicle — the schedule ghost, the route
   * ahead — and repeated the panel's header.
   */
  actions: VehicleActionHandlers;
};

const NO_TIMETABLE_TIMEOUT_MS = 3000;

export function SelectedVehiclePanel({
  selectedVehicle,
  timetable,
  onClose,
  layout,
  actions,
}: SelectedVehiclePanelProps) {
  const serviceJourneyId = selectedVehicle?.properties.serviceJourneyId ?? null;
  const date = selectedVehicle?.properties.date ?? null;
  const vehicleId = selectedVehicle?.properties.id ?? "";

  const vehicleData = useVehicleUpdateCompleteSubscription(
    vehicleId,
    serviceJourneyId ?? "",
  );

  // After (NO_TIMETABLE_TIMEOUT_MS) without a timetable frame, surface the
  // "not available" message. The timeout remembers which journey it fired
  // for, so a new selection starts un-timed-out on its first render; the
  // cleanup clears it too, since reselecting the same journey gives the same
  // key and would otherwise skip "Loading timetable…".
  const journeyKey = timetableJourneyKey(serviceJourneyId, date);
  const [timedOutFor, setTimedOutFor] = useState<string | null>(null);
  const timedOut = timedOutFor === journeyKey;
  useEffect(() => {
    if (!serviceJourneyId) return;
    const key = timetableJourneyKey(serviceJourneyId, date);
    const id = window.setTimeout(
      () => setTimedOutFor(key),
      NO_TIMETABLE_TIMEOUT_MS,
    );
    return () => {
      window.clearTimeout(id);
      setTimedOutFor(null);
    };
  }, [serviceJourneyId, date]);

  const open = selectedVehicle !== null;
  const currentOrder = vehicleData?.monitoredCall?.order ?? null;
  const tripCancelled = timetable?.cancellation === true;

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
    <DetailSheet layout={layout} aria-label="Selected vehicle">
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

      {/* The actions share the delay's row, which has width to spare, so the
          phone's collapsed sheet shows them without growing. */}
      {vehicleData && (
        <Box
          sx={{
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: delayColour(delayBucket(vehicleData.delay)),
              fontWeight: 600,
            }}
          >
            {formatDelay(vehicleData.delay)}
          </Typography>
          <VehicleActions vehicleData={vehicleData} {...actions} />
        </Box>
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
    </DetailSheet>
  );
}
