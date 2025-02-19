import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { Filter } from "./types.ts";
import { useCodespaces } from "./useCodespaces.ts";

type CodespaceFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function CodespaceFilter({
  currentFilter,
  setCurrentFilter,
}: CodespaceFilterProps) {
  const codespaces = useCodespaces();

  const handleChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    // Merge the new codespaceId into the existing filter object
    setCurrentFilter({
      ...currentFilter,
      codespaceId: value,
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Codespace Filter
        </Typography>
        <FormControl fullWidth>
          <InputLabel id="codespace-select-label">Select Codespace</InputLabel>
          <Select
            labelId="codespace-select-label"
            id="codespace-select"
            value={currentFilter.codespaceId ?? ""}
            onChange={handleChange}
            label="Select Codespace"
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
      </CardContent>
    </Card>
  );
}
