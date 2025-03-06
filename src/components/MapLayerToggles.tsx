import { ChangeEvent } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  Card,
  CardContent,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { MapViewOptions } from "../types.ts";

type Props = {
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function MapLayerToggles({ mapViewOptions, setMapViewOptions }: Props) {
  const { current: mapRef } = useMap();

  const handleToggleLayer =
    (optionKey: keyof MapViewOptions, layerId: string) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!mapRef) return;

      const map = mapRef.getMap();
      const isVisible = event.target.checked;
      const newVisibility = isVisible ? "visible" : "none";

      map.setLayoutProperty(layerId, "visibility", newVisibility);

      setMapViewOptions({
        ...mapViewOptions,
        [optionKey]: isVisible,
      });
    };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Map Layers
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showVehicles}
                onChange={handleToggleLayer("showVehicles", "vehicle-layer")}
              />
            }
            label="Vehicles"
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showVehicleTraces}
                onChange={handleToggleLayer(
                  "showVehicleTraces",
                  "vehicle-trace-layer",
                )}
              />
            }
            label="Vehicle Traces"
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showDelay}
                onChange={handleToggleLayer("showDelay", "delay")}
              />
            }
            label="Delay"
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showUpdateFrequency}
                onChange={handleToggleLayer(
                  "showUpdateFrequency",
                  "vehicle-update-interval-icon-layer",
                )}
              />
            }
            label="Update frequency"
          />

          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showDeadUpdateFrequency}
                onChange={handleToggleLayer(
                  "showDeadUpdateFrequency",
                  "vehicle-update-interval-skull-layer",
                )}
              />
            }
            label="Update frequency (more than 30s since update)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showVehicleHeatmap}
                onChange={handleToggleLayer(
                  "showVehicleHeatmap",
                  "vehicles-heatmap",
                )}
              />
            }
            label="Vehicle Heatmap"
          />
        </FormGroup>
      </CardContent>
    </Card>
  );
}
