import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import { useOperators } from "../hooks/useOperators";

interface OperatorSelectorProps {
  value?: string;
  onChange: (e: SelectChangeEvent) => void;
  codespaceId?: string;
  label?: string;
}

export function OperatorSelector({
  value,
  onChange,
  codespaceId,
  label = "Select Operator",
}: OperatorSelectorProps) {
  const operators = useOperators(codespaceId!);

  return (
    <FormControl fullWidth>
      <InputLabel id="operator-selector-label">{label}</InputLabel>
      <Select
        disabled={!codespaceId}
        labelId="operator-selector-label"
        id="operator-selector"
        value={value === undefined ? "" : value}
        onChange={onChange}
        label={label}
      >
        <MenuItem value="">
          <em>All</em>
        </MenuItem>
        {operators.map((operator) => (
          <MenuItem key={operator.operatorRef} value={operator.operatorRef}>
            <div>
              <Typography variant="body1" fontWeight="bold">
                {operator.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {operator.operatorRef}
              </Typography>
            </div>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
