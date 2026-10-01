import { ChangeEvent } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Box,
} from "@mui/material";
import { MapViewOptions } from "../types.ts";
import { AppMode } from "../domain/appMode.ts";
import { VehicleIconCanvas } from "./VehicleIconCanvas.tsx";
import { VEHICLE_ICON_URLS } from "./vehicleIconImages.ts";

import greenMarker from "../static/images/greenUpdate.png";
import skullMarker from "../static/images/skull.png";
import greenLight from "../static/images/greenLight.png";
import heatMap from "../static/images/heatmap.png";
import traces from "../static/images/traces.png";
import occupancy2 from "../static/images/occupancy2.png";
import situationMarker from "../static/images/orangeMarker.png";

type Props = {
  mode: AppMode;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  showTransitNetwork: boolean;
  setShowTransitNetwork: (show: boolean) => void;
};

export function MapLayers({
  mode,
  mapViewOptions,
  setMapViewOptions,
  showTransitNetwork,
  setShowTransitNetwork,
}: Props) {
  const { current: mapRef } = useMap();

  // Takes one layer id or several: situations draw across lines and points that
  // must reveal and hide together.
  const handleToggleLayer =
    (optionKey: keyof MapViewOptions, layerIds: string | string[]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!mapRef) return;

      const map = mapRef.getMap();
      const isVisible = event.target.checked;
      const newVisibility = isVisible ? "visible" : "none";

      for (const layerId of [layerIds].flat()) {
        map.setLayoutProperty(layerId, "visibility", newVisibility);
      }

      const next = { ...mapViewOptions, [optionKey]: isVisible };

      setMapViewOptions(next);
    };

  const getLabelWithIcon = (icon: string, label: string, height: number) => (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <img
        src={icon}
        alt={label}
        style={{ height: height, width: "auto", marginRight: 8 }}
      />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Map Layers
      </Typography>
      <FormGroup>
        {mode === "vehicles" && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={mapViewOptions.showVehicles}
                  onChange={handleToggleLayer("showVehicles", [
                    "vehicle-layer",
                    "vehicle-bearing-layer",
                  ])}
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <VehicleIconCanvas
                    url={VEHICLE_ICON_URLS["vehicle-bus"]}
                    size={22}
                  />
                  <Typography variant="body2">Vehicles</Typography>
                </Box>
              }
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
              label={getLabelWithIcon(traces, "Vehicle traces", 24)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={mapViewOptions.showDelay}
                  onChange={handleToggleLayer("showDelay", "delay")}
                />
              }
              label={getLabelWithIcon(greenLight, "Delay", 24)}
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
              label={getLabelWithIcon(greenMarker, "Update frequency", 16)}
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
              label={getLabelWithIcon(skullMarker, "Stale updates (30s+)", 24)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={mapViewOptions.showOccupancy}
                  onChange={handleToggleLayer(
                    "showOccupancy",
                    "occupancy-layer",
                  )}
                />
              }
              label={getLabelWithIcon(occupancy2, "Occupancy", 8)}
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
              label={getLabelWithIcon(heatMap, "Vehicle heatmap", 24)}
            />
          </>
        )}
        {mode === "situations" && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={mapViewOptions.showAffectedStops}
                  onChange={handleToggleLayer("showAffectedStops", [
                    "situation-points-edge-layer",
                    "situation-points-layer",
                  ])}
                />
              }
              label={getLabelWithIcon(situationMarker, "Affected stops", 22)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={mapViewOptions.showAffectedLines}
                  onChange={handleToggleLayer("showAffectedLines", [
                    "situation-lines-outer-casing-layer",
                    "situation-lines-casing-layer",
                    "situation-lines-layer",
                  ])}
                />
              }
              label={getLabelWithIcon(situationMarker, "Affected spans", 22)}
            />
          </>
        )}
      </FormGroup>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Base map
      </Typography>
      <FormGroup>
        {/* In both modes; TransitNetworkLayers applies it to the map. */}
        <FormControlLabel
          control={
            <Switch
              checked={showTransitNetwork}
              onChange={(event) => setShowTransitNetwork(event.target.checked)}
            />
          }
          label={<Typography variant="body2">Transit network</Typography>}
        />
      </FormGroup>
    </Box>
  );
}
