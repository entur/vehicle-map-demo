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
  // Access the current map instance via react-map-gl/maplibre's hook:
  const { current: mapRef } = useMap();

  // Store each layer’s on/off state here:
  // Initialize to 'false' (hidden) or 'true' (visible) as you prefer
  const [layerVisibility, setLayerVisibility] = useState({
    "vehicle-delay-heatmap": false, // heatmap layer
    delay: true, // circle layer (example)
    "vehicle-layer": true,
    // add more layers if needed
  });

  // Toggles a specific layer on/off in the map and updates local state
  const handleToggleLayer =
    (layerId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!mapRef) return;

      const map = mapRef.getMap();
      const isVisible = event.target.checked;
      const newVisibility = isVisible ? "visible" : "none";

      // Toggle visibility on the map’s layer
      map.setLayoutProperty(layerId, "visibility", newVisibility);

      // Update our local React state
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
