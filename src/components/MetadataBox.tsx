import { Card, CardContent, Typography } from "@mui/material";
import { VehicleUpdate } from "../types.ts";

// You can adjust/extend this type based on the metadata you want to display
type MetadataBoxProps = {
  title: string;
  data?: VehicleUpdate[];
};

export function MetadataBox({ title, data }: MetadataBoxProps) {
  return (
    <Card>
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
  );
}
