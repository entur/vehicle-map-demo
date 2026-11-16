import { Box, Typography } from "@mui/material";
import { Filter, VehicleModeEnumeration, VehicleUpdate } from "../types.ts";
import {
  INTERVAL_BUCKETS,
  intervalHistogram,
  IntervalRecords,
  intervalsByCodespace,
  recordsMatching,
} from "../domain/updateIntervals.ts";
import { CHART_BAR } from "../domain/dataColours.ts";

type InfoBoxProps = {
  data?: VehicleUpdate[];
  updateIntervals: IntervalRecords;
  filter: Filter | null | undefined;
};

const MODE_LABELS: Record<VehicleModeEnumeration, string> = {
  BUS: "Buses",
  COACH: "Coaches",
  RAIL: "Trains",
  TRAM: "Trams",
  METRO: "Metro",
  FERRY: "Ferries",
  AIR: "Aircraft",
  TAXI: "Taxis",
};

const sectionTitleSx = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "text.secondary",
  marginTop: 2,
  marginBottom: 0.5,
} as const;

const rowSx = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
} as const;

function formatSeconds(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
}

function modeCounts(data: VehicleUpdate[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const vehicle of data) {
    const label = MODE_LABELS[vehicle.mode] ?? `Unknown (${vehicle.mode})`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function IntervalChart({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  return (
    <Box
      component="ul"
      aria-label="Vehicles by update interval"
      sx={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {INTERVAL_BUCKETS.map((bucket, i) => {
        const count = counts[i];
        const share = total ? Math.round((count / total) * 100) : 0;
        return (
          <Box
            component="li"
            key={bucket.label}
            title={`${bucket.label}: ${count} vehicles (${share}%)`}
            sx={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 64px",
              alignItems: "center",
              columnGap: 1,
              height: 22,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              borderRadius: "var(--mui-shape-borderRadius)",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Box sx={{ color: "text.secondary", textAlign: "right" }}>
              {bucket.label}
            </Box>
            <Box sx={{ height: 12 }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${(count / max) * 100}%`,
                  minWidth: count ? 2 : 0,
                  bgcolor: CHART_BAR,
                  borderRadius: "0 4px 4px 0",
                }}
              />
            </Box>
            <Box>
              {count}
              <Box component="span" sx={{ color: "text.secondary" }}>
                {` · ${share}%`}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function InfoBox({ data, updateIntervals, filter }: InfoBoxProps) {
  const shown = recordsMatching(updateIntervals, filter);
  const histogram = intervalHistogram(shown);
  const byCodespace = intervalsByCodespace(shown);
  const measured = histogram.counts.reduce((a, b) => a + b, 0);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Statistics
      </Typography>
      {data && (
        <>
          <Box sx={sectionTitleSx}>{`Vehicles in view: ${data.length}`}</Box>
          {modeCounts(data).map(([label, count]) => (
            <Box key={label} sx={rowSx}>
              <span>{label}</span>
              <span>{count}</span>
            </Box>
          ))}
        </>
      )}

      <Box sx={sectionTitleSx}>Update interval</Box>
      <Typography
        component="p"
        sx={{ fontSize: 12, color: "text.secondary", marginBottom: 1 }}
      >
        Median time between consecutive reports per vehicle in the current
        filter and view, measured since the map opened. {measured} vehicles
        measured
        {histogram.pending > 0 &&
          `, ${histogram.pending} waiting for a second report`}
        .
      </Typography>
      <IntervalChart counts={histogram.counts} />

      <Box sx={sectionTitleSx}>By codespace</Box>
      {byCodespace.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: "text.disabled" }}>—</Typography>
      ) : (
        <Box
          component="table"
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            "& th": {
              fontWeight: 600,
              color: "text.secondary",
              textAlign: "right",
              paddingBottom: 0.5,
            },
            "& td": { textAlign: "right" },
            "& th:first-of-type, & td:first-of-type": { textAlign: "left" },
          }}
        >
          <thead>
            <tr>
              <th>Codespace</th>
              <th>Vehicles</th>
              <th>Median interval</th>
            </tr>
          </thead>
          <tbody>
            {byCodespace.map((row) => (
              <tr key={row.codespaceId}>
                <td>{row.codespaceId}</td>
                <td>{row.vehicles}</td>
                <td>{formatSeconds(row.medianSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </Box>
  );
}
