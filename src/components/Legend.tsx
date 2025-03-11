import busIcon from "../static/images/bus.png";
import ferryIcon from "../static/images/ferry.png";
import trainIcon from "../static/images/train.png";
import tramIcon from "../static/images/tram.png";
import greenMarkerIcon from "../static/images/markerGreen.png";
import greenMarker from "../static/images/greenUpdate.png";
import orangeMarker from "../static/images/yellowUpdate.png";
import redMarker from "../static/images/redUpdate.png";
import skullMarker from "../static/images/skull.png";
import greenLight from "../static/images/greenLight.png";
import orangeLight from "../static/images/orangeLight.png";
import redLight from "../static/images/redLight.png";
import { Box, Typography } from "@mui/material";

export function Legend() {
  const legendItems = [
    { icon: busIcon, label: "Bus" },
    { icon: ferryIcon, label: "Ferry" },
    { icon: trainIcon, label: "Train" },
    { icon: tramIcon, label: "Tram" },
    { icon: greenMarkerIcon, label: "Follow vehicle marker" },
    { icon: greenMarker, label: "Update frequency < 2s" },
    { icon: orangeMarker, label: "Update frequency < 15s" },
    { icon: redMarker, label: "Update frequency < 30s" },
    { icon: skullMarker, label: "Update frequency > 30s" },
    { icon: greenLight, label: "Delay < 2m" },
    { icon: orangeLight, label: "Delay < 5m" },
    { icon: redLight, label: "Delay > 5m" },
  ];

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Map legend
      </Typography>
      {legendItems.map((item, index) => (
        <Box key={index} sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <img
            src={item.icon}
            alt={item.label}
            style={{ width: "auto", height: 32, marginRight: 8 }}
          />
          <Typography variant="body2">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
