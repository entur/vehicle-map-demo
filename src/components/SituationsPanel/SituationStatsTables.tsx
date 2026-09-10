import { Box, Typography } from "@mui/material";
import { CountEntry } from "../../domain/situationStats.ts";
import { useSituations } from "../../situations/SituationsContext.ts";

function CountTable({
  title,
  entries,
}: {
  title: string;
  entries: CountEntry[];
}) {
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
      {entries.length === 0 && (
        <Typography component="div" sx={{ fontSize: 12, color: "#999" }}>
          —
        </Typography>
      )}
      {entries.map((entry) => (
        <Box
          key={entry.value}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span>{entry.value}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {entry.count}
          </span>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Every table counts the feed narrowed by the map's codespace filter — the same
 * scope the vehicles-mode Data report uses when it fetches a snapshot for one
 * codespace. With a codespace selected the CODESPACE table is therefore a
 * single row; kept rather than hidden, because a table that disappears reflows
 * the grid and removes the confirmation of what you are scoped to.
 *
 * Laid out as a grid rather than a stack: this opens in a wide drawer (see
 * `isWideTool`), and stacking six tables in one narrow column made the codespace
 * and affects-shape tables unreadable without long scrolling, with no way to
 * compare two of them. `auto-fill` rather than a fixed column count so the
 * layout still collapses to one column if the drawer is ever narrowed.
 */
export function SituationStatsTables() {
  const { stats, statsScope } = useSituations();

  // Stated rather than implied: with a codespace selected these tables describe
  // a slice, and a reader who missed the dropdown would otherwise take them for
  // the whole feed.
  const scope = statsScope.codespaceId
    ? `${statsScope.codespaceId} · ${statsScope.count} of ${statsScope.total} situations`
    : `${statsScope.total} situations`;

  return (
    <Box sx={{ padding: 1.5 }}>
      <Typography
        component="h2"
        sx={{ fontSize: 16, fontWeight: 700, marginBottom: 1.5 }}
      >
        Feed report
      </Typography>
      <Typography
        component="div"
        sx={{ fontSize: 12, color: "#666", marginBottom: 1.5 }}
      >
        {scope}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          columnGap: 2,
          alignItems: "start",
        }}
      >
        <CountTable title="Severity" entries={stats.bySeverity} />
        <CountTable title="Report type" entries={stats.byReportType} />
        <CountTable title="Codespace" entries={stats.byCodespace} />
        <CountTable title="Affects shape" entries={stats.byAffectsShape} />
        <CountTable
          title="Summary languages"
          entries={stats.summaryLanguages}
        />
        <CountTable
          title="Description languages"
          entries={stats.descriptionLanguages}
        />
      </Box>
    </Box>
  );
}
