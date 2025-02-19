import { Box, Card, CardContent, Typography } from "@mui/material";
import { VehicleUpdate } from "./types.ts";

// You can adjust/extend this type based on the metadata you want to display
type MetadataBoxProps = {
  title: string;
  data?: VehicleUpdate[];
};

export function MetadataBox({ title, data }: MetadataBoxProps) {
  return (
    <Box
      sx={{
        position: "absolute",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999, // Make sure it's above the map
      }}
    >
      <Card elevation={3} sx={{ minWidth: 275 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          {data && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Size of data set: " + data.length}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
