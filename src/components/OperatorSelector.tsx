import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { useOperators } from "../hooks/useOperators";

interface OperatorSelectorProps {
  value: string;
  onChange: (e: SelectChangeEvent) => void;
  codespaceId: string;
  label?: string;
}

export function OperatorSelector({
  value,
  onChange,
  codespaceId,
  label = "Select Operator",
}: OperatorSelectorProps) {
  const operators = useOperators(codespaceId);

  return (
    <FormControl fullWidth>
      <InputLabel id="operator-selector-label">{label}</InputLabel>
      <Select
        disabled={!codespaceId}
        labelId="operator-selector-label"
        id="operator-selector"
        value={value}
        onChange={onChange}
        label={label}
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
  );
}
