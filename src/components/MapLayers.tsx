import { ChangeEvent } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  Card,
  CardContent,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Box,
} from "@mui/material";
import { MapViewOptions } from "../types.ts";

import busIcon from "../static/images/bus.png";
import greenMarker from "../static/images/greenUpdate.png";
import skullMarker from "../static/images/skull.png";
import greenLight from "../static/images/greenLight.png";
import heatMap from "../static/images/heatmap.png";
import traces from "../static/images/traces.png";

type Props = {
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function MapLayers({ mapViewOptions, setMapViewOptions }: Props) {
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

  const getLabelWithIcon = (icon: string, label: string) => (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <img
        src={icon}
        alt={label}
        style={{ height: 24, width: "auto", marginRight: 8 }}
      />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );

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
            label={getLabelWithIcon(busIcon, "Vehicles")}
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
            label={getLabelWithIcon(traces, "Vehicle traces")}
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showDelay}
                onChange={handleToggleLayer("showDelay", "delay")}
              />
            }
            label={getLabelWithIcon(greenLight, "Delay")}
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
            label={getLabelWithIcon(greenMarker, "Update frequency")}
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
            label={getLabelWithIcon(skullMarker, "Stale updates (30s+)")}
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
            label={getLabelWithIcon(heatMap, "Vehicle heatmap")}
          />
        </FormGroup>
      </CardContent>
    </Card>
  );
}
