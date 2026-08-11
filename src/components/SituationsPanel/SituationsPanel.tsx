import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { SituationStatsTables } from "./SituationStatsTables.tsx";

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
  const { feed } = useSituations();

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

      <SituationStatsTables />
    </Box>
  );
}
