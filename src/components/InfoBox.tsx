import { Card, CardContent, Typography } from "@mui/material";
import { VehicleUpdate } from "../types.ts";
import { Legend } from "./Legend.tsx";

type InfoBoxProps = {
  title: string;
  data?: VehicleUpdate[];
};

export function InfoBox({ title, data }: InfoBoxProps) {
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
        <Legend />
      </CardContent>
    </Card>
  );
}
