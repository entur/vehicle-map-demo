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
import occupancy0 from "../static/images/occupancy0.png";
import occupancy1 from "../static/images/occupancy1.png";
import occupancy2 from "../static/images/occupancy2.png";
import occupancy3 from "../static/images/occupancy3.png";
import occupancy4 from "../static/images/occupancy4.png";
import occupancy5 from "../static/images/occupancy5.png";
import occupancy6 from "../static/images/occupancy6.png";
import redSkull from "../static/images/skullRed.png";
import { Box, Card, CardContent, Typography } from "@mui/material";

type LegendItems = {
  icon: any;
  label: string;
  height: number;
};

export function Legend() {
  const legendItems: LegendItems[] = [
    { icon: busIcon, label: "Bus", height: 24 },
    { icon: ferryIcon, label: "Ferry", height: 28 },
    { icon: trainIcon, label: "Train", height: 22 },
    { icon: tramIcon, label: "Tram", height: 28 },
    { icon: greenMarkerIcon, label: "Follow vehicle marker", height: 20 },
    { icon: greenMarker, label: "Update frequency < 2s", height: 17 },
    { icon: orangeMarker, label: "Update frequency < 15s", height: 18 },
    { icon: redMarker, label: "Update frequency < 30s", height: 16 },
    { icon: skullMarker, label: "Update frequency > 30s", height: 24 },
    { icon: redSkull, label: "Update frequency > 1h", height: 24 },
    { icon: greenLight, label: "Update frequency < 2m", height: 24 },
    { icon: orangeLight, label: "Update frequency < 5m", height: 24 },
    { icon: redLight, label: "Delay > 5m", height: 24 },
    {
      icon: occupancy0,
      label: "Empty or has very few passengers",
      height: 8,
    },
    {
      icon: occupancy1,
      label: "More than ~50% of seats are available",
      height: 8,
    },
    { icon: occupancy2, label: "~10%-50% of seats are available", height: 8 },
    { icon: occupancy3, label: "Only standing room is available", height: 8 },
    {
      icon: occupancy4,
      label: "Standing room only, at or near crush load",
      height: 8,
    },
    {
      icon: occupancy5,
      label: "Full; no more passengers can board",
      height: 8,
    },
    {
      icon: occupancy6,
      label: "Not accepting any passengers",
      height: 22,
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Map legend
        </Typography>

        {legendItems.map((item, index) => (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "center", mb: 1 }}
          >
            <img
              src={item.icon}
              alt={item.label}
              style={{ width: "auto", height: item.height, marginRight: 8 }}
            />
            <Typography variant="body2">{item.label}</Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
