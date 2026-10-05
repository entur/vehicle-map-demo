import { Box, Typography } from "@mui/material";
import { VehicleUpdateComplete } from "../../types";

type VehicleInfoCardProps = {
  vehicleData: VehicleUpdateComplete | null;
};

export function VehicleInfo({ vehicleData }: VehicleInfoCardProps) {
  if (!vehicleData) {
    return <div>Loading...</div>;
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {vehicleData.line.publicCode && (
        <Box
          sx={{
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            bgcolor: "selection.main",
            color: "background.paper",
            fontSize: "1rem",
            fontWeight: 700,
          }}
        >
          {vehicleData.line.publicCode}
        </Box>
      )}
      <Typography variant="subtitle1" gutterBottom={false} align="center">
        {vehicleData.originName} - {vehicleData.destinationName}
      </Typography>

      <Typography variant="body2">
        <strong>ID:</strong> {vehicleData.vehicleId}
      </Typography>
      {vehicleData.operator?.operatorRef && (
        <Typography variant="body2">
          <strong>Operator:</strong> {vehicleData.operator?.operatorRef}
        </Typography>
      )}
      <Typography variant="body2">
        <strong>Codespace:</strong> {vehicleData.codespace.codespaceId}
      </Typography>
    </Box>
  );
}
