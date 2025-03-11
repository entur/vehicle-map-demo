import { CodespaceSelector } from "./CodespaceSelector";
import { SelectChangeEvent } from "@mui/material";
import { Filter } from "../types";

type CodespaceFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
};

export function CodespaceFilter({
  currentFilter,
  setCurrentFilter,
}: CodespaceFilterProps) {
  const handleChange = (e: SelectChangeEvent) => {
    const value = e.target.value as string;
    setCurrentFilter({
      ...currentFilter,
      codespaceId: value,
      operatorRef: undefined,
    });
  };

  return (
    <div>
      <CodespaceSelector
        value={currentFilter.codespaceId ?? ""}
        onChange={handleChange}
      />
    </div>
  );
}
