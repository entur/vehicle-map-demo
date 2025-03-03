import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Divider,
} from "@mui/material";
import { VehicleUpdateComplete } from "../types";

type VehicleDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  vehicleData: VehicleUpdateComplete | null;
};

export function VehicleDetailsDialog({
  open,
  onClose,
  vehicleData,
}: VehicleDetailsDialogProps) {
  if (!vehicleData) {
    return null;
  }

  const {
    vehicleId,
    mode,
    line,
    delay,
    codespace,
    operator,
    occupancyStatus,
    location,
    lastUpdated,
    expiration,
    originName,
    destinationName,
    // ... any other fields to display
  } = vehicleData;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Vehicle Details</DialogTitle>

      <DialogContent dividers>
        <Stack>
          <Typography variant="body1">
            <strong>Vehicle ID:</strong> {vehicleId}
          </Typography>

          <Typography variant="body1">
            <strong>Mode:</strong> {mode}
          </Typography>

          <Typography variant="body1">
            <strong>Line Code:</strong> {line?.publicCode}
          </Typography>

          <Typography variant="body1">
            <strong>Delay:</strong> {delay}
          </Typography>

          <Typography variant="body1">
            <strong>Codespace:</strong> {codespace?.codespaceId}
          </Typography>

          <Typography variant="body1">
            <strong>Operator:</strong> {operator?.operatorRef}
          </Typography>

          <Typography variant="body1">
            <strong>Occupancy:</strong> {occupancyStatus}
          </Typography>

          <Typography variant="body1">
            <strong>Location:</strong>{" "}
            {location
              ? `${location.latitude}, ${location.longitude}`
              : "No location"}
          </Typography>

          <Typography variant="body1">
            <strong>Last Updated:</strong> {lastUpdated}
          </Typography>

          <Typography variant="body1">
            <strong>Expiration:</strong> {expiration}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body1">
            <strong>Origin:</strong> {originName}
          </Typography>

          <Typography variant="body1">
            <strong>Destination:</strong> {destinationName}
          </Typography>

          {/* TODO: Add more fields */}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
