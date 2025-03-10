import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
} from "@mui/material";
import redlightIcon from "../../static/images/redLight.png";
import orangelightIcon from "../../static/images/orangeLight.png";
import greenlightIcon from "../../static/images/greenLight.png";
import { DataInfo } from "./DataInfo";
import { DataItem, VehicleUpdateComplete } from "../../types.ts";
import { transformVehicleUpdates } from "../../utils/transformVehicleUpdates.ts";

type DataResultsProps = {
  loading: boolean;
  data: VehicleUpdateComplete[];
};

export function DataResults({ data, loading }: DataResultsProps) {
  const vehicleDataMetrics: DataItem[] = transformVehicleUpdates(data);
  return (
    <Box>
      {loading && <Skeleton variant={"rounded"}></Skeleton>}
      {!loading && (
        <List
          dense
          sx={{
            display: "grid",
            gridTemplateColumns:
              vehicleDataMetrics.length > 15 ? "repeat(2, 1fr)" : "none",
            gap: 0,
          }}
        >
          {vehicleDataMetrics.map((item, index) => {
            const percentage =
              data.length > 0 ? (item.itemsWithValue / data.length) * 100 : 0;
            let dataColor: "red" | "orange" | "green";
            if (percentage < 50) {
              dataColor = "red";
            } else if (percentage < 80) {
              dataColor = "orange";
            } else {
              dataColor = "green";
            }
            const itemIcon =
              dataColor === "red"
                ? redlightIcon
                : dataColor === "orange"
                  ? orangelightIcon
                  : greenlightIcon;
            return (
              <ListItem key={index} dense={true} disableGutters>
                <ListItemIcon
                  sx={{ minWidth: "auto", marginRight: 1, marginLeft: 2 }}
                >
                  <img
                    src={itemIcon}
                    alt={`${dataColor} light`}
                    style={{ width: "24px", height: "24px" }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={`${item.category}: ${item.itemsWithValue} / ${data.length} (${percentage.toFixed(
                    0,
                  )}%)`}
                />
              </ListItem>
            );
          })}
        </List>
      )}

      <DataInfo />
    </Box>
  );
}
