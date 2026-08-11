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
    // A subscription that never delivered a single frame before failing
    // (e.g. the schema simply doesn't expose `Subscription.situations` in
    // this environment) is a different situation from a feed that dropped
    // mid-stream — "showing 0 of 0 situations received before —" is
    // ungrammatical and implies data that never existed. Only claim a
    // dropped connection once something had actually arrived.
    if (feed.lastUpdated === null) {
      return <>Situations feed unavailable in this environment</>;
    }
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
    <Box
      sx={{
        padding: 2,
        overflowY: "auto",
        // `.right-menu-container` (src/index.css, shared with the other four
        // drawer panels) is `position: absolute; top: 0` with no `height`,
        // so a percentage height here would resolve against an auto-height
        // ancestor and never actually bound this box — `overflowY: "auto"`
        // would never engage and content (notably the uncapped affects
        // groups in SituationDetail) could grow past the bottom of the
        // screen with no way to scroll to it. Bound against the viewport
        // instead, which doesn't depend on any ancestor's height, and leave
        // a margin roughly matching the container's own 20px top offset so
        // the panel doesn't get clipped by the map's `overflow: hidden`.
        maxHeight: "calc(100vh - 40px)",
      }}
    >
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
