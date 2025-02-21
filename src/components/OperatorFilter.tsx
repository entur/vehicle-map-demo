import {
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import { Filter } from "../types.ts";
import { useOperators } from "../hooks/useOperators.ts";

type OperatorFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function OperatorFilter({
  currentFilter,
  setCurrentFilter,
}: OperatorFilterProps) {
  const operators = useOperators(
    currentFilter.codespaceId ? currentFilter.codespaceId : "",
  );

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
        <FormControl fullWidth>
          <InputLabel id="operator-select-label">Select Operator</InputLabel>
          <Select
            disabled={!currentFilter.codespaceId}
            labelId="operator-select-label"
            id="operator-select"
            value={currentFilter.operatorRef ?? ""}
            onChange={handleChange}
            label="Select Operator"
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {operators.map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
}
