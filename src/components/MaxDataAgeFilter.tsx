import { TextField, InputAdornment } from "@mui/material";
import { Filter } from "../types";
import clearIcon from "../static/images/clear.png";
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
    setCurrentFilter({
      ...currentFilter,
      maxDataAge: value,
    });
  };

  const handleClear = () => {
    setCurrentFilter({
      ...currentFilter,
      maxDataAge: undefined,
    });
  };

  return (
    <TextField
      label="Max Data Age"
      type="text"
      value={currentFilter.maxDataAge ?? ""}
      onChange={handleChange}
      helperText="Enter duration in ISO‑8601 format (e.g. PT1M for 60 seconds)"
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
                  <img src={clearIcon} alt="Detail" className="icon-small" />
                </button>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
