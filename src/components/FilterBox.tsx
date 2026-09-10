import { Box, Card, CardContent, Typography } from "@mui/material";
import { CodespaceFilter } from "./CodespaceFilter";
import { OperatorFilter } from "./OperatorFilter";
import { Filter as FilterType } from "../types.ts";
import { MaxDataAgeFilter } from "./MaxDataAgeFilter.tsx";
import { AppMode } from "../domain/appMode.ts";
import { SituationFilters } from "./SituationsPanel/SituationFilters.tsx";
import { codespaceOptions, withoutCounts } from "../domain/codespaceOptions.ts";
import { useCodespaces } from "../hooks/useCodespaces.ts";
import { useSituations } from "../situations/SituationsContext.ts";

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
  // The two feeds do not publish the same codespaces, so each mode offers what
  // its own data contains: vehicles from the API's `codespaces` root, situations
  // from the feed's own tally. Offering one list for both left most of the
  // situations feed unreachable — see `codespaceOptions`.
  const vehicleCodespaces = useCodespaces();
  const { feedCodespaceCounts } = useSituations();
  const selected = currentFilter.codespaceId ?? null;
  const codespaces =
    mode === "situations"
      ? codespaceOptions(feedCodespaceCounts, selected)
      : codespaceOptions(withoutCounts(vehicleCodespaces), selected);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Filter
        </Typography>
        <CodespaceFilter
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          options={codespaces}
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
