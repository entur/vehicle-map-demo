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
      {vehicleData.line.publicCode && (
        <Avatar
          sx={{
            bgcolor: "primary.main",
            width: 48,
            height: 48,
            fontSize: "1rem",
          }}
        >
          {vehicleData.line.publicCode}
        </Avatar>
      )}
      <Typography variant="subtitle1" gutterBottom={false} align="center">
        {vehicleData.originName} - {vehicleData.destinationName}
      </Typography>

      <Typography variant="body2">
        <strong>ID:</strong> {vehicleData.vehicleId}
      </Typography>
      {vehicleData.operator.operatorRef && (
        <Typography variant="body2">
          <strong>Operator:</strong> {vehicleData.operator.operatorRef}
        </Typography>
      )}
      <Typography variant="body2">
        <strong>Codespace:</strong> {vehicleData.codespace.codespaceId}
      </Typography>
    </Box>
  );
}
