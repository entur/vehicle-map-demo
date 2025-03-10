import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
} from "@mui/material";
import { VehicleUpdateComplete } from "../../types";
import redlightIcon from "../../static/images/redLight.png";
import greenlightIcon from "../../static/images/greenLight.png";
import detailsIcon from "../../static/images/details.png";
import jsonIcon from "../../static/images/json.png";
import Tooltip from "@mui/material/Tooltip";

type VehicleDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  vehicleData: VehicleUpdateComplete | null;
};

type DataRowProps = {
  label: string;
  value: React.ReactNode;
  rawValue: any;
};

function DataRow({ label, value, rawValue }: DataRowProps) {
  const hasData =
    rawValue !== null &&
    rawValue !== undefined &&
    (typeof rawValue === "string" ? rawValue.trim() !== "" : true);
  return (
    <Box display="flex" alignItems="center" mb={1}>
      <img
        src={hasData ? greenlightIcon : redlightIcon}
        alt="status"
        style={{ width: 16, height: 16, marginRight: 8 }}
      />
      <Typography variant="body1">
        <strong>{label}:</strong> {value}
      </Typography>
    </Box>
  );
}

export function VehicleDetailsDialog({
  open,
  onClose,
  vehicleData,
}: VehicleDetailsDialogProps) {
  const [showJson, setShowJson] = useState(false);

  if (!vehicleData) {
    return null;
  }

  const toggleJson = () => {
    setShowJson((prev) => !prev);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>Vehicle Details</span>
          <Tooltip title={showJson ? "View details" : "View JSON"}>
            <button className="round-icon-button" onClick={toggleJson}>
              <img
                src={showJson ? detailsIcon : jsonIcon}
                alt={showJson ? "View details" : "View JSON"}
                className="icon"
              />
            </button>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!showJson && (
          <Stack spacing={0}>
            <DataRow
              label="Direction"
              value={vehicleData.direction || "N/A"}
              rawValue={vehicleData.direction}
            />
            <DataRow
              label="Service Journey ID"
              value={vehicleData.serviceJourney.id}
              rawValue={vehicleData.serviceJourney.id}
            />
            <DataRow
              label="Service Journey Date"
              value={vehicleData.serviceJourney.date}
              rawValue={vehicleData.serviceJourney.date}
            />
            <DataRow
              label="Dated Service Journey"
              value={
                vehicleData.datedServiceJourney
                  ? `ID: ${vehicleData.datedServiceJourney.id}, Date: ${vehicleData.datedServiceJourney.serviceJourney.date}`
                  : "N/A"
              }
              rawValue={vehicleData.datedServiceJourney}
            />
            <DataRow
              label="Operator"
              value={vehicleData.operator.operatorRef}
              rawValue={vehicleData.operator.operatorRef}
            />
            <DataRow
              label="Codespace"
              value={vehicleData.codespace.codespaceId}
              rawValue={vehicleData.codespace.codespaceId}
            />
            <DataRow
              label="Origin Ref"
              value={vehicleData.originRef}
              rawValue={vehicleData.originRef}
            />
            <DataRow
              label="Origin Name"
              value={vehicleData.originName}
              rawValue={vehicleData.originName}
            />
            <DataRow
              label="Destination Ref"
              value={vehicleData.destinationRef}
              rawValue={vehicleData.destinationRef}
            />
            <DataRow
              label="Destination Name"
              value={vehicleData.destinationName}
              rawValue={vehicleData.destinationName}
            />
            <DataRow
              label="Mode"
              value={vehicleData.mode}
              rawValue={vehicleData.mode}
            />
            <DataRow
              label="Vehicle ID"
              value={vehicleData.vehicleId}
              rawValue={vehicleData.vehicleId}
            />
            <DataRow
              label="Occupancy"
              value={
                vehicleData.occupancyStatus !== "noData"
                  ? vehicleData.occupancyStatus
                  : "N/A"
              }
              rawValue={
                vehicleData.occupancyStatus !== "noData"
                  ? vehicleData.occupancyStatus
                  : null
              }
            />
            <DataRow
              label="Line Ref"
              value={vehicleData.line.lineRef}
              rawValue={vehicleData.line.lineRef}
            />
            <DataRow
              label="Line Name"
              value={vehicleData.line.lineName}
              rawValue={vehicleData.line.lineName}
            />
            <DataRow
              label="Line Public Code"
              value={vehicleData.line.publicCode}
              rawValue={vehicleData.line.publicCode}
            />
            <DataRow
              label="Last Updated"
              value={vehicleData.lastUpdated}
              rawValue={vehicleData.lastUpdated}
            />
            <DataRow
              label="Expiration"
              value={vehicleData.expiration}
              rawValue={vehicleData.expiration}
            />
            <DataRow
              label="Location"
              value={
                vehicleData.location
                  ? `${vehicleData.location.latitude}, ${vehicleData.location.longitude}`
                  : "No location"
              }
              rawValue={
                vehicleData.location
                  ? `${vehicleData.location.latitude},${vehicleData.location.longitude}`
                  : null
              }
            />
            <DataRow
              label="Speed"
              value={vehicleData.speed !== null ? vehicleData.speed : "N/A"}
              rawValue={vehicleData.speed}
            />
            <DataRow
              label="Bearing"
              value={vehicleData.bearing !== null ? vehicleData.bearing : "N/A"}
              rawValue={vehicleData.bearing}
            />
            <DataRow
              label="Monitored"
              value={
                vehicleData.monitored === null ||
                vehicleData.monitored === undefined
                  ? "N/A"
                  : vehicleData.monitored
                    ? "Yes"
                    : "No"
              }
              rawValue={vehicleData.monitored}
            />
            <DataRow
              label="Delay"
              value={vehicleData.delay}
              rawValue={vehicleData.delay}
            />
            <DataRow
              label="In Congestion"
              value={
                vehicleData.inCongestion === null ||
                vehicleData.inCongestion === undefined
                  ? "N/A"
                  : vehicleData.inCongestion
                    ? "Yes"
                    : "No"
              }
              rawValue={vehicleData.inCongestion}
            />
            <DataRow
              label="Vehicle Status"
              value={vehicleData.vehicleStatus}
              rawValue={vehicleData.vehicleStatus}
            />
            <DataRow
              label="Progress Between Stops"
              value={
                vehicleData.progressBetweenStops
                  ? `Link Distance: ${vehicleData.progressBetweenStops.linkDistance}, Percentage: ${vehicleData.progressBetweenStops.percentage}%`
                  : "N/A"
              }
              rawValue={vehicleData.progressBetweenStops}
            />
            <DataRow
              label="Monitored Call"
              value={
                vehicleData.monitoredCall
                  ? `StopPoint: ${vehicleData.monitoredCall.stopPointRef}, Order: ${vehicleData.monitoredCall.order}, At Stop: ${
                      vehicleData.monitoredCall.vehicleAtStop ? "Yes" : "No"
                    }`
                  : "N/A"
              }
              rawValue={vehicleData.monitoredCall}
            />
          </Stack>
        )}

        {showJson && (
          <Stack>
            <Box
              component="pre"
              sx={{
                backgroundColor: "#f5f5f5",
                padding: 2,
                borderRadius: 1,
                overflow: "auto",
                fontSize: "0.8rem",
              }}
            >
              {JSON.stringify(vehicleData, null, 2)}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
