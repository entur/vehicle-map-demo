import { CodespaceSelector } from "./CodespaceSelector";
import { SelectChangeEvent } from "@mui/material";
import { Filter } from "../types";
import { CodespaceOption } from "../domain/codespaceOptions.ts";

type CodespaceFilterProps = {
  currentFilter: Filter;
  setCurrentFilter: (filter: Filter) => void;
  options: CodespaceOption[];
};

export function CodespaceFilter({
  currentFilter,
  setCurrentFilter,
  options,
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
        options={options}
      />
    </div>
  );
}
