import {
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputLabel,
  Typography,
} from "@mui/material";
import { MapViewOptions } from "../MapView.tsx";

type Props = {
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function ShowVehicleTracesCheckbox({
  mapViewOptions,
  setMapViewOptions,
}: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Operator Filter
        </Typography>
        <FormControl fullWidth>
          <InputLabel id="show-vehicle-traces-checkbox-label">
            Show vehicle traces
          </InputLabel>
          <Checkbox
            id="operator-selector"
            checked={mapViewOptions.showVehicleTraces}
            onChange={(e) =>
              setMapViewOptions({
                ...mapViewOptions,
                showVehicleTraces: e.target.checked,
              })
            }
          />
        </FormControl>
      </CardContent>
    </Card>
  );
}
