import { Card, CardContent, Typography } from "@mui/material";
import { SelectChangeEvent } from "@mui/material";
import { Filter } from "../types";
import { OperatorSelector } from "./OperatorSelector";

type OperatorFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function OperatorFilter({
  currentFilter,
  setCurrentFilter,
}: OperatorFilterProps) {
  const handleChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setCurrentFilter({
      ...currentFilter,
      operatorRef: value,
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Operator Filter
        </Typography>
        <OperatorSelector
          value={currentFilter.operatorRef ?? ""}
          onChange={handleChange}
          codespaceId={currentFilter.codespaceId ?? ""}
        />
      </CardContent>
    </Card>
  );
}
