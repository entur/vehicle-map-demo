import { useState } from "react";
import { Card, CardContent, Typography, Button, Box } from "@mui/material";
import { SelectChangeEvent } from "@mui/material";
import { CodespaceSelector } from "../CodespaceSelector.tsx";
import { OperatorSelector } from "../OperatorSelector.tsx";
import { DataDialog } from "./DataDialog.tsx";

export function DataChecker() {
  const [selectedCodespace, setSelectedCodespace] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCodespaceChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setSelectedCodespace(value);
    setSelectedOperator("");
  };

  const handleOperatorChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setSelectedOperator(value);
  };

  const runDataTest = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Data summary
        </Typography>

        <Box mb={2}>
          <CodespaceSelector
            value={selectedCodespace}
            onChange={handleCodespaceChange}
          />
        </Box>

        <Box mb={2}>
          <OperatorSelector
            value={selectedOperator}
            onChange={handleOperatorChange}
            codespaceId={selectedCodespace}
          />
        </Box>

        <Button
          variant="contained"
          color="primary"
          onClick={runDataTest}
          disabled={!selectedCodespace}
        >
          Run data summary
        </Button>
      </CardContent>

      <DataDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        selectedCodespace={selectedCodespace}
        selectedOperator={selectedOperator}
      />
    </Card>
  );
}
