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
