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

/**
 * Example layer toggles for your map.
 * Adjust the layer IDs below to match your mapStyle.ts definitions.
 */
export function MapLayerToggles() {
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
