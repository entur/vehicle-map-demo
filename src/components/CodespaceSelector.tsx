import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { useCodespaces } from "../hooks/useCodespaces";

interface CodespaceSelectorProps {
  value?: string;
  onChange: (e: SelectChangeEvent) => void;
  label?: string;
}

export function CodespaceSelector({
  value,
  onChange,
  label = "Select Codespace",
}: CodespaceSelectorProps) {
  const codespaces = useCodespaces();

  return (
    <FormControl fullWidth>
      <InputLabel id="codespace-selector-label">{label}</InputLabel>
      <Select
        labelId="codespace-selector-label"
        id="codespace-selector"
        value={value === undefined ? "" : value}
        onChange={onChange}
        label={label}
      >
        <MenuItem value="">
          <em>All</em>
        </MenuItem>
        {codespaces.map((cs) => (
          <MenuItem key={cs} value={cs}>
            {cs}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
