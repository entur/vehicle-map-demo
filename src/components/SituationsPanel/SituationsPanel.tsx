import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { SituationFilters } from "./SituationFilters.tsx";
import { SituationRow } from "./SituationRow.tsx";
import { SituationStatsTables } from "./SituationStatsTables.tsx";
import { SituationDetail } from "./SituationDetail.tsx";
import { UnmappableList } from "./UnmappableList.tsx";

function StatusLine() {
  const { feed, filtered } = useSituations();

  if (feed.status === "connecting") {
    return <>Connecting…</>;
  }

  if (feed.status === "empty") {
    return <>No situations published in this environment</>;
  }

  const updated = feed.lastUpdated
    ? new Date(feed.lastUpdated).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";

  const counts =
    filtered.length === feed.situations.length
      ? `${feed.situations.length} situations`
      : `${filtered.length} of ${feed.situations.length} situations`;

  if (feed.status === "error") {
    return (
      <>
        Connection lost — showing {counts} received before {updated}
      </>
    );
  }

  return (
    <>
      Live · {counts} · updated {updated}
    </>
  );
}

export function SituationsPanel() {
  const { feed, filtered, flagsBySituation, features, selected, setSelected } =
    useSituations();

  const selectedSituation =
    selected === null
      ? null
      : (feed.situations.find((s) => s.situationNumber === selected) ?? null);

  return (
    <Box sx={{ padding: 2, overflowY: "auto", height: "100%" }}>
      <Typography
        component="h2"
        sx={{ fontSize: 16, fontWeight: 700, marginBottom: 0.5 }}
      >
        Situations
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: 12,
          marginBottom: 2,
          color: feed.status === "error" ? "#c0392b" : "#666",
        }}
      >
        <StatusLine />
      </Typography>

      <SituationFilters />

      <Box sx={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 2 }}>
        {filtered.map((situation) => (
          <SituationRow
            key={situation.situationNumber}
            situation={situation}
            flags={flagsBySituation.get(situation.situationNumber) ?? []}
            featureCount={
              features.featureCountBySituation.get(situation.situationNumber) ??
              0
            }
            selected={selected === situation.situationNumber}
            onSelect={() =>
              setSelected(
                selected === situation.situationNumber
                  ? null
                  : situation.situationNumber,
              )
            }
          />
        ))}
      </Box>

      {selectedSituation && (
        <SituationDetail
          situation={selectedSituation}
          flags={flagsBySituation.get(selectedSituation.situationNumber) ?? []}
          onClose={() => setSelected(null)}
        />
      )}

      <UnmappableList />

      <SituationStatsTables />
    </Box>
  );
}
