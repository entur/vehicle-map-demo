import { useState, ChangeEvent } from "react";
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
  const [layerVisibility, setLayerVisibility] = useState({
    "vehicle-delay-heatmap": false,
    delay: true,
    "vehicle-layer": true,
  });

  const handleToggleLayer =
    (layerId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!mapRef) return;

      const map = mapRef.getMap();
      const isVisible = event.target.checked;
      const newVisibility = isVisible ? "visible" : "none";

      map.setLayoutProperty(layerId, "visibility", newVisibility);

      setLayerVisibility((prev) => ({
        ...prev,
        [layerId]: isVisible,
      }));
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
                checked={layerVisibility["vehicle-layer"]}
                onChange={handleToggleLayer("vehicle-layer")}
              />
            }
            label="Vehicles"
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showVehicleTraces}
                onChange={(e) =>
                  setMapViewOptions({
                    ...mapViewOptions,
                    showVehicleTraces: e.target.checked,
                  })
                }
              />
            }
            label="Vehicle traces"
          />
          <FormControlLabel
            control={
              <Switch
                checked={layerVisibility.delay}
                onChange={handleToggleLayer("delay")}
              />
            }
            label="Delay"
          />

          <FormControlLabel
            control={
              <Switch
                checked={layerVisibility["vehicle-delay-heatmap"]}
                onChange={handleToggleLayer("vehicle-delay-heatmap")}
              />
            }
            label="Delay Heatmap"
          />
        </FormGroup>
      </CardContent>
    </Card>
  );
}
