import { VehicleIconCanvas } from "./VehicleIconCanvas.tsx";
import { VEHICLE_ICON_URLS } from "./vehicleIconImages.ts";
import greenMarkerIcon from "../static/images/markerGreen.png";
import greenMarker from "../static/images/greenUpdate.png";
import orangeMarker from "../static/images/yellowUpdate.png";
import redMarker from "../static/images/redUpdate.png";
import skullMarker from "../static/images/skull.png";
import greenLight from "../static/images/greenLight.png";
import orangeLight from "../static/images/orangeLight.png";
import redLight from "../static/images/redLight.png";
import occupancy0 from "../static/images/occupancy0.png";
import occupancy1 from "../static/images/occupancy1.png";
import occupancy2 from "../static/images/occupancy2.png";
import occupancy3 from "../static/images/occupancy3.png";
import occupancy4 from "../static/images/occupancy4.png";
import occupancy5 from "../static/images/occupancy5.png";
import occupancy6 from "../static/images/occupancy6.png";
import redSkull from "../static/images/skullRed.png";
import { Box, Typography } from "@mui/material";

type LegendItems = {
  icon: string;
  label: string;
  height: number;
};

const VEHICLE_LEGEND: { url: string | null; label: string }[] = [
  { url: VEHICLE_ICON_URLS["vehicle-bus"], label: "Bus" },
  { url: VEHICLE_ICON_URLS["vehicle-coach"], label: "Coach" },
  { url: VEHICLE_ICON_URLS["vehicle-tram"], label: "Tram" },
  { url: VEHICLE_ICON_URLS["vehicle-metro"], label: "Metro" },
  { url: VEHICLE_ICON_URLS["vehicle-rail"], label: "Train" },
  { url: VEHICLE_ICON_URLS["vehicle-water"], label: "Ferry" },
  { url: null, label: "Other modes" },
];

export function Legend() {
  const legendItems: LegendItems[] = [
    { icon: greenMarkerIcon, label: "Follow vehicle marker", height: 20 },
    { icon: greenMarker, label: "Update frequency < 2s", height: 17 },
    { icon: orangeMarker, label: "Update frequency < 15s", height: 18 },
    { icon: redMarker, label: "Update frequency < 30s", height: 16 },
    { icon: skullMarker, label: "Update frequency > 30s", height: 24 },
    { icon: redSkull, label: "Update frequency > 1h", height: 24 },
    { icon: greenLight, label: "Delay < 2m", height: 24 },
    { icon: orangeLight, label: "Delay < 5m", height: 24 },
    { icon: redLight, label: "Delay > 5m", height: 24 },
    {
      icon: occupancy0,
      label: "Empty/very few passengers",
      height: 8,
    },
    {
      icon: occupancy1,
      label: "More than ~50% seats available",
      height: 8,
    },
    { icon: occupancy2, label: "~10%-50% seats available", height: 8 },
    { icon: occupancy3, label: "Only standing room available", height: 8 },
    {
      icon: occupancy4,
      label: "Standing room only, at or near crush load",
      height: 8,
    },
    {
      icon: occupancy5,
      label: "Full",
      height: 8,
    },
    {
      icon: occupancy6,
      label: "Not accepting passengers",
      height: 22,
    },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Map legend
      </Typography>

      {VEHICLE_LEGEND.map((item) => (
        <Box
          key={item.label}
          sx={{ display: "flex", alignItems: "center", mb: 1 }}
        >
          <VehicleIconCanvas url={item.url} size={24} />
          <Typography variant="body2">{item.label}</Typography>
        </Box>
      ))}

      {legendItems.map((item, index) => (
        <Box key={index} sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <img
            src={item.icon}
            alt={item.label}
            style={{ width: "auto", height: item.height, marginRight: 8 }}
          />
          <Typography variant="body2">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
