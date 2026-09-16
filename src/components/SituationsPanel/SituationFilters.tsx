import { Box, Chip, Typography } from "@mui/material";
import { CountEntry } from "../../domain/situationStats.ts";
import {
  EMPTY_SITUATION_FILTER,
  SituationFilter,
} from "../../domain/situationFilter.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { useSituations } from "../../situations/SituationsContext.ts";
import { severityColour } from "../SelectedVehiclePanel/situationSeverity.ts";
import { SeverityEnumeration } from "../../types.ts";

type FacetKey = keyof SituationFilter;

/** Chips are far denser than checkbox rows in a narrow panel. */
function FacetChip({
  label,
  count,
  selected,
  warning,
  dotColour,
  onToggle,
}: {
  label: string;
  count: number;
  selected: boolean;
  warning?: boolean;
  dotColour?: string;
  onToggle: () => void;
}) {
  return (
    <Chip
      size="small"
      clickable
      onClick={onToggle}
      aria-pressed={selected}
      variant={selected ? "filled" : "outlined"}
      color={warning ? "error" : selected ? "primary" : "default"}
      icon={
        dotColour ? (
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: dotColour,
              // The dot would clash with a filled chip without a ring.
              outline: selected
                ? "1px solid var(--mui-palette-background-paper)"
                : "none",
              flexShrink: 0,
            }}
          />
        ) : undefined
      }
      label={
        <>
          {label}{" "}
          <Box
            component="span"
            sx={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}
          >
            {count}
          </Box>
        </>
      }
      sx={{
        fontSize: 11,
        height: 22,
        // A zero-count facet value is kept rather than hidden — it is a
        // regression detector — but it should not read as live data.
        opacity: count === 0 && !selected ? 0.45 : 1,
        "& .MuiChip-icon": { marginLeft: "6px", marginRight: "-2px" },
      }}
    />
  );
}

function Facet({
  title,
  facetKey,
  entries,
  dotFor,
  warningFor,
}: {
  title: string;
  facetKey: FacetKey;
  entries: CountEntry[];
  dotFor?: (value: string) => string;
  warningFor?: (value: string) => boolean;
}) {
  const { filter, setFilter } = useSituations();
  const selected = filter[facetKey] as string[];

  const setValues = (next: string[]) => {
    // The computed key widens the object literal past SituationFilter, and the
    // flags facet holds SituationFlag rather than string — both are safe here
    // because every value shown came out of facetCounts over the real data.
    setFilter({ ...filter, [facetKey]: next } as SituationFilter);
  };

  const toggle = (value: string) =>
    setValues(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );

  return (
    <Box sx={{ marginBottom: 1.25 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 0.5,
        }}
      >
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "text.disabled",
          }}
        >
          {title}
        </Typography>
        {selected.length > 0 && (
          <Box
            component="button"
            type="button"
            onClick={() => setValues([])}
            aria-label={`Clear ${title.toLowerCase()} filter`}
            sx={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 10,
              color: "text.secondary",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {selected.length} selected · clear
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {entries.map((entry) => (
          <FacetChip
            key={entry.value}
            label={entry.value}
            count={entry.count}
            selected={selected.includes(entry.value)}
            dotColour={dotFor?.(entry.value)}
            warning={warningFor?.(entry.value)}
            onToggle={() => toggle(entry.value)}
          />
        ))}
      </Box>
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

  const selectedCount =
    filter.severities.length + filter.reportTypes.length + filter.flags.length;

  return (
    <Box
      sx={{
        marginBottom: 2,
        padding: 1.25,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "6px",
        // The last facet's own bottom margin would double up with the card's
        // padding into a visible gap.
        "& > div:last-of-type": { marginBottom: 0 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 1,
        }}
      >
        <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
          Filter
        </Typography>
        {selectedCount > 0 && (
          <Box
            component="button"
            type="button"
            onClick={() => setFilter(EMPTY_SITUATION_FILTER)}
            sx={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 11,
              color: "text.secondary",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            clear all
          </Box>
        )}
      </Box>

      <Facet
        title="Severity"
        facetKey="severities"
        entries={facets.severities}
        dotFor={(value) => severityColour(value as SeverityEnumeration)}
      />
      <Facet
        title="Report type"
        facetKey="reportTypes"
        entries={facets.reportTypes}
      />
      <Facet
        title="Quality flags"
        facetKey="flags"
        entries={facets.flags}
        warningFor={(value) => FLAG_LEVEL[value as SituationFlag] === "warning"}
      />
    </Box>
  );
}
