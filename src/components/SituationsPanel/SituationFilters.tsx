import { Box, Typography } from "@mui/material";
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

/** Chips are far denser than checkbox rows — the codespace facet alone runs to
 * sixteen values, and the drawer is only 250px wide. */
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
  const accent = warning ? "#c0392b" : "#1976d2";

  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        border: `1px solid ${selected ? accent : "#d8d8d8"}`,
        borderRadius: "11px",
        background: selected ? accent : "#fff",
        color: selected ? "#fff" : warning ? accent : "#333",
        cursor: "pointer",
        font: "inherit",
        fontSize: 11,
        lineHeight: 1.5,
        padding: "1px 7px",
        // A zero-count facet value is kept rather than hidden — it is a
        // regression detector — but it should not read as live data.
        opacity: count === 0 && !selected ? 0.45 : 1,
        "&:hover": { borderColor: accent },
      }}
    >
      {dotColour && (
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColour,
            // The dot carries no information the label doesn't once the chip is
            // filled, and it clashes with the fill.
            outline: selected ? "1px solid #fff" : "none",
            flexShrink: 0,
          }}
        />
      )}
      <span>{label}</span>
      <Box
        component="span"
        sx={{
          fontVariantNumeric: "tabular-nums",
          fontSize: 10,
          color: selected ? "rgba(255,255,255,0.85)" : "#8a8a8a",
        }}
      >
        {count}
      </Box>
    </Box>
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
            color: "#888",
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
              color: "#1976d2",
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
    filter.codespaces.length +
    filter.severities.length +
    filter.reportTypes.length +
    filter.flags.length;

  return (
    <Box
      sx={{
        marginBottom: 2,
        padding: 1.25,
        background: "#fff",
        border: "1px solid #e4e4e4",
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
              color: "#1976d2",
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
        title="Codespace"
        facetKey="codespaces"
        entries={facets.codespaces}
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
