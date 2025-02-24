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

type DataDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCodespace: string;
  selectedOperator: string;
};

export function DataDialog({
  open,
  onClose,
  selectedCodespace,
  selectedOperator,
}: DataDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <Box textAlign="center">
          <Typography variant="h5">Data summary</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <List>
          <ListItem>
            <ListItemText
              primary={"Codespace: " + selectedCodespace || "N/A"}
              secondary={
                selectedOperator ? "Operator: " + selectedOperator : undefined
              }
            />
          </ListItem>
        </List>
        <DataResults />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
