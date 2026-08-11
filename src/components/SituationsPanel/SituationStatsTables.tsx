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

/** Every table counts the unfiltered set — these describe the feed, not the selection. */
export function SituationStatsTables() {
  const { stats } = useSituations();

  return (
    <Box>
      <CountTable title="Severity" entries={stats.bySeverity} />
      <CountTable title="Report type" entries={stats.byReportType} />
      <CountTable title="Codespace" entries={stats.byCodespace} />
      <CountTable title="Affects shape" entries={stats.byAffectsShape} />
      <CountTable title="Summary languages" entries={stats.summaryLanguages} />
      <CountTable
        title="Description languages"
        entries={stats.descriptionLanguages}
      />
    </Box>
  );
}
