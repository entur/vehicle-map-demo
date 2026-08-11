import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";
import { CountEntry } from "../../domain/situationStats.ts";
import { SituationFilter } from "../../domain/situationFilter.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { useSituations } from "../../situations/SituationsContext.ts";

type FacetKey = keyof SituationFilter;

function Facet({
  title,
  facetKey,
  entries,
  colourFor,
}: {
  title: string;
  facetKey: FacetKey;
  entries: CountEntry[];
  colourFor?: (value: string) => string | undefined;
}) {
  const { filter, setFilter } = useSituations();
  const selected = filter[facetKey] as string[];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];
    // The computed key widens the object literal past SituationFilter, and the
    // flags facet holds SituationFlag rather than string — both are safe here
    // because every value shown came out of facetCounts over the real data.
    setFilter({ ...filter, [facetKey]: next } as SituationFilter);
  };

  return (
    <Box sx={{ marginBottom: 1.5 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        {title}
      </Typography>
      {entries.map((entry) => (
        <FormControlLabel
          key={entry.value}
          sx={{ display: "flex", marginLeft: 0, marginRight: 0 }}
          control={
            <Checkbox
              size="small"
              checked={selected.includes(entry.value)}
              onChange={() => toggle(entry.value)}
              sx={{ padding: "2px 6px 2px 0" }}
            />
          }
          label={
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 12,
                color: colourFor?.(entry.value),
              }}
            >
              <span>{entry.value}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {entry.count}
              </span>
            </Box>
          }
        />
      ))}
    </Box>
  );
}

/**
 * Counts come from the unfiltered set on purpose: a facet whose count collapsed
 * to match the current selection would stop describing the feed.
 *
 * Flags are ANDed with each other and with the other facets, so a zero-count
 * flag stays listed rather than vanishing — it is a regression detector.
 */
export function SituationFilters() {
  const { facets, filter, setFilter } = useSituations();

  const anySelected =
    filter.codespaces.length +
      filter.severities.length +
      filter.reportTypes.length +
      filter.flags.length >
    0;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
          Filter
        </Typography>
        {anySelected && (
          <Box
            component="button"
            type="button"
            onClick={() =>
              setFilter({
                codespaces: [],
                severities: [],
                reportTypes: [],
                flags: [],
              })
            }
            sx={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 11,
              color: "#1976d2",
              padding: 0,
            }}
          >
            clear
          </Box>
        )}
      </Box>

      <Facet
        title="Severity"
        facetKey="severities"
        entries={facets.severities}
      />
      <Facet
        title="Report type"
        facetKey="reportTypes"
        entries={facets.reportTypes}
      />
      <Facet
        title="Codespace"
        facetKey="codespaces"
        entries={facets.codespaces}
      />
      <Facet
        title="Quality flags"
        facetKey="flags"
        entries={facets.flags}
        colourFor={(value) =>
          FLAG_LEVEL[value as SituationFlag] === "warning"
            ? "#c0392b"
            : undefined
        }
      />
    </Box>
  );
}
