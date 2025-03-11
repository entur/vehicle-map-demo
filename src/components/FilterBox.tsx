import { Box, Card, CardContent, Typography } from "@mui/material";
import { CodespaceFilter } from "./CodespaceFilter";
import { OperatorFilter } from "./OperatorFilter";
import { Filter as FilterType } from "../types.ts";

type FilterProps = {
  currentFilter: FilterType;
  setCurrentFilter: (filter: FilterType) => void;
};

export function FilterBox({ currentFilter, setCurrentFilter }: FilterProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Filter
        </Typography>
        <CodespaceFilter
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
        />
        <Box mt={2}></Box>
        <OperatorFilter
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
        />
      </CardContent>
    </Card>
  );
}
