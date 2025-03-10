import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  DialogTitle,
  Typography,
  Box,
} from "@mui/material";
import { DataResults } from "./DataResults.tsx";
import { VehicleUpdateComplete } from "../../types.ts";
import { memo } from "react";

type DataDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCodespace?: string;
  selectedOperator?: string;
  loading: boolean;
  data: VehicleUpdateComplete[];
};

export const DataDialog = memo(function DataDialog({
  data,
  loading,
  open,
  onClose,
  selectedCodespace,
  selectedOperator,
}: DataDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>
        <Box textAlign="center">
          <Typography variant="h5">Data report</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <List dense>
          <ListItem>
            <ListItemText
              primary={"Codespace: " + selectedCodespace || "N/A"}
              secondary={
                selectedOperator ? "Operator: " + selectedOperator : undefined
              }
            />
          </ListItem>
        </List>
        <DataResults data={data} loading={loading} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
});
