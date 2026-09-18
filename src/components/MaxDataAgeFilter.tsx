import { TextField, InputAdornment, IconButton } from "@mui/material";
import { Filter } from "../types";
import ClearIcon from "@mui/icons-material/Clear";
import Tooltip from "@mui/material/Tooltip";

type MaxDataAgeFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function MaxDataAgeFilter({
  currentFilter,
  setCurrentFilter,
}: MaxDataAgeFilterProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds) && seconds >= 0) {
      console.log("Setting maxDataAge to " + seconds);
      setCurrentFilter({
        ...currentFilter,
        maxDataAge: seconds,
      });
    } else {
      setCurrentFilter({
        ...currentFilter,
        maxDataAge: undefined,
      });
    }
  };

  const handleClear = () => {
    setCurrentFilter({
      ...currentFilter,
      maxDataAge: undefined,
    });
  };

  return (
    <TextField
      label="Max data age"
      type="text"
      value={currentFilter.maxDataAge ?? ""}
      onChange={handleChange}
      helperText="Enter seconds. Limits age of data."
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={"Clear"}>
                <IconButton
                  size="small"
                  aria-label="Clear"
                  onClick={handleClear}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
