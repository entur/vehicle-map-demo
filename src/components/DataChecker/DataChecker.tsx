import { memo, useState } from "react";
import { Card, CardContent, Typography, Button, Box } from "@mui/material";
import { SelectChangeEvent } from "@mui/material";
import { CodespaceSelector } from "../CodespaceSelector.tsx";
import { OperatorSelector } from "../OperatorSelector.tsx";
import { DataDialog } from "./DataDialog.tsx";
import { useVehiclePositionsSnapshotFetcher } from "../../hooks/useVehiclePositionsSnapshotFetcher.ts";

export const DataChecker = memo(function DataChecker() {
  const [selectedCodespace, setSelectedCodespace] = useState<
    string | undefined
  >();
  const [selectedOperator, setSelectedOperator] = useState<
    string | undefined
  >();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, loading, fetchSnapshot } = useVehiclePositionsSnapshotFetcher();

  const handleCodespaceChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setSelectedCodespace(value);
    if (selectedOperator !== undefined) {
      setSelectedOperator(undefined);
    }
  };

  const handleOperatorChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setSelectedOperator(value);
  };

  const runDataTest = () => {
    fetchSnapshot({
      codespaceId: selectedCodespace,
      operatorRef: selectedOperator,
    });
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
            value={selectedOperator ?? ""}
            onChange={handleOperatorChange}
            codespaceId={selectedCodespace ?? ""}
          />
        </Box>

        <Button
          variant="contained"
          color="primary"
          onClick={runDataTest}
          disabled={!selectedCodespace}
          fullWidth
        >
          Run data summary
        </Button>
      </CardContent>

      <DataDialog
        data={data}
        loading={loading}
        open={dialogOpen}
        onClose={handleCloseDialog}
        selectedCodespace={selectedCodespace}
        selectedOperator={selectedOperator}
      />
    </Card>
  );
});
