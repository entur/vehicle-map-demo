import { Box, Card, CardContent, Typography } from "@mui/material";
import { CodespaceFilter } from "./CodespaceFilter";
import { OperatorFilter } from "./OperatorFilter";
import { Filter as FilterType } from "../types.ts";
import { MaxDataAgeFilter } from "./MaxDataAgeFilter.tsx";
import { AppMode } from "../domain/appMode.ts";
import { SituationFilters } from "./SituationsPanel/SituationFilters.tsx";

type FilterProps = {
  mode: AppMode;
  currentFilter: FilterType;
  setCurrentFilter: (filter: FilterType) => void;
};

export function FilterBox({
  mode,
  currentFilter,
  setCurrentFilter,
}: FilterProps) {
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
        {mode === "vehicles" && (
          <>
            <Box sx={{ mt: 2 }} />
            <OperatorFilter
              currentFilter={currentFilter}
              setCurrentFilter={setCurrentFilter}
            />
            <Box sx={{ mt: 2 }} />
            <MaxDataAgeFilter
              currentFilter={currentFilter}
              setCurrentFilter={setCurrentFilter}
            />
          </>
        )}
        {mode === "situations" && (
          <>
            <Box sx={{ mt: 2 }} />
            <SituationFilters />
          </>
        )}
      </CardContent>
    </Card>
  );
}
