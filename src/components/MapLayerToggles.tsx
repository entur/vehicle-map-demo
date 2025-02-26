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
import { MapViewOptions } from "./MapView.tsx";

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
                checked={mapViewOptions.showDelayHeatmap}
                onChange={handleToggleLayer(
                  "showDelayHeatmap",
                  "vehicle-delay-heatmap",
                )}
              />
            }
            label="Delay Heatmap"
          />
        </FormGroup>
      </CardContent>
    </Card>
  );
}
