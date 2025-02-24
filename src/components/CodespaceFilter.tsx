import { Card, CardContent, Typography } from "@mui/material";
import { Filter } from "../types";
import { CodespaceSelector } from "./CodespaceSelector";
import { SelectChangeEvent } from "@mui/material";

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
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Codespace Filter
        </Typography>
        <CodespaceSelector
          value={currentFilter.codespaceId ?? ""}
          onChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}
