import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { CodespaceOption } from "../domain/codespaceOptions.ts";

interface CodespaceSelectorProps {
  value?: string;
  onChange: (e: SelectChangeEvent) => void;
  label?: string;
  /** What this mode's data actually contains — see `codespaceOptions`. */
  options: CodespaceOption[];
}

export function CodespaceSelector({
  value,
  onChange,
  label = "Select Codespace",
  options,
}: CodespaceSelectorProps) {
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
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.value}
            {option.count !== null && (
              <Box component="span" sx={{ marginLeft: 1, color: "#999" }}>
                {option.count}
              </Box>
            )}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
