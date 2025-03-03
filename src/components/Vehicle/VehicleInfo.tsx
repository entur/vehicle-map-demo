import { Avatar, Box, Typography } from "@mui/material";
import { VehicleUpdateComplete } from "../../types";

type VehicleInfoCardProps = {
  vehicleData: VehicleUpdateComplete | null;
};

export function VehicleInfo({ vehicleData }: VehicleInfoCardProps) {
  if (!vehicleData) {
    return <div>Loading...</div>;
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Avatar
        sx={{
          bgcolor: "primary.main",
          width: 56,
          height: 56,
          fontSize: "1.25rem",
          marginBottom: 1,
        }}
      >
        {vehicleData.line.publicCode}
      </Avatar>

      <Typography variant="subtitle1" gutterBottom={false} align="center">
        {vehicleData.originName} - {vehicleData.destinationName}
      </Typography>

      <Typography variant="body2">
        <strong>ID:</strong> {vehicleData.vehicleId}
      </Typography>
      <Typography variant="body2">
        <strong>Mode:</strong> {vehicleData.mode}
      </Typography>
      <Typography variant="body2">
        <strong>Delay:</strong> {vehicleData.delay}
      </Typography>
      <Typography variant="body2">
        <strong>Codespace:</strong> {vehicleData.codespace.codespaceId}
      </Typography>
    </Box>
  );
}
