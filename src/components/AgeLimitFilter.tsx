import { InputAdornment, TextField } from "@mui/material";
import { Filter } from "../types";
import Tooltip from "@mui/material/Tooltip";
import clearIcon from "../static/images/clear.png";

type AgeLimitFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function AgeLimitFilter({
  currentFilter,
  setCurrentFilter,
}: AgeLimitFilterProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const ageLimit = value ? parseFloat(value) : undefined;
    setCurrentFilter({
      ...currentFilter,
      ageLimit,
    });
  };

  const handleClear = () => {
    setCurrentFilter({
      ...currentFilter,
      ageLimit: undefined,
    });
  };

  return (
    <TextField
      label="Update age limit"
      value={currentFilter.ageLimit ?? ""}
      helperText="Enter seconds. Limits update age of displayed data."
      onChange={handleChange}
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={"Clear"}>
                <button
                  className="round-icon-button round-icon-button-small"
                  onClick={handleClear}
                >
                  <img src={clearIcon} alt="Clear" className="icon-small" />
                </button>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
