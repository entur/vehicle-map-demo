import { OperatorSelector } from "./OperatorSelector";
import { SelectChangeEvent } from "@mui/material";
import { Filter } from "../types";

type OperatorFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function OperatorFilter({
  currentFilter,
  setCurrentFilter,
}: OperatorFilterProps) {
  const handleChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setCurrentFilter({
      ...currentFilter,
      operatorRef: value,
    });
  };

  return (
    <div>
      <OperatorSelector
        value={currentFilter.operatorRef ?? ""}
        onChange={handleChange}
        codespaceId={currentFilter.codespaceId ?? ""}
      />
    </div>
  );
}
