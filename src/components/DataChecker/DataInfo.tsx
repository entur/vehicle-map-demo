import { useState } from "react";
import {
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import infoIcon from "../../static/images/info.png";

export function DataInfo() {
  const [infoOpen, setInfoOpen] = useState(false);

  const handleInfoOpen = () => setInfoOpen(true);
  const handleInfoClose = () => setInfoOpen(false);

  return (
    <>
      <Box mt={2} display="flex" justifyContent="flex-end" alignItems="center">
        <IconButton onClick={handleInfoOpen} size="small">
          <img
            src={infoIcon}
            alt="How is this calculated"
            title="How is this calculated"
            style={{ width: "24px", height: "24px" }}
          />
        </IconButton>
      </Box>

      <Dialog open={infoOpen} onClose={handleInfoClose}>
        <DialogTitle>Calculation Details</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The data summary is calculated as the sum of all data items with a
            value divided by the sum of all data items (with and without value),
            expressed as a percentage.
            <br />
            <br />
            Evaluation thresholds:
            <br />• Below 50%: Red
            <br />• 50% to 80%: Orange
            <br />• Above 80%: Green
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleInfoClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
