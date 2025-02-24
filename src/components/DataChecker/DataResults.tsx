import { Box, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import redlightIcon from "../../static/images/redlight.png";
import orangelightIcon from "../../static/images/orangelight.png";
import greenlightIcon from "../../static/images/greenlight.png";
import { DataInfo } from "./DataInfo";

export type DataItem = {
  category: string;
  actual: number;
  total: number;
};

// TODO - this is only sample data - need to fetch and evaluate real data.
const sampleResults: DataItem[] = [
  { category: "Delay time", actual: 80, total: 100 },
  { category: "Line number", actual: 60, total: 100 },
  { category: "Mode", actual: 30, total: 100 },
];

export function DataResults() {
  return (
    <Box>
      <List>
        {sampleResults.map((item, index) => {
          const percentage =
            item.total > 0 ? (item.actual / item.total) * 100 : 0;
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
            <ListItem key={index}>
              <ListItemIcon>
                <img
                  src={itemIcon}
                  alt={`${dataColor} light`}
                  style={{ width: "24px", height: "24px" }}
                />
              </ListItemIcon>
              <ListItemText
                primary={`${item.category}: ${item.actual} / ${item.total} (${percentage.toFixed(
                  0,
                )}%)`}
              />
            </ListItem>
          );
        })}
      </List>

      <DataInfo />
    </Box>
  );
}
