import { Box, Typography } from "@mui/material";
import { NationalSituation } from "../../types.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { severityColour } from "../SelectedVehiclePanel/situationSeverity.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";

type SituationRowProps = {
  situation: NationalSituation;
  flags: SituationFlag[];
  featureCount: number;
  selected: boolean;
  onSelect: () => void;
};

export function SituationRow({
  situation,
  flags,
  featureCount,
  selected,
  onSelect,
}: SituationRowProps) {
  const summary = pickTranslation(situation.summary) ?? "(no summary)";

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderBottom: "1px dotted #eee",
        borderLeft: `3px solid ${severityColour(situation.severity)}`,
        background: selected ? "#eef7f7" : "none",
        cursor: "pointer",
        padding: "6px 8px",
        font: "inherit",
      }}
    >
      <Typography component="div" sx={{ fontSize: 12, fontWeight: 600 }}>
        {summary}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", marginTop: 0.25 }}>
        <Typography component="span" sx={{ fontSize: 10, color: "#666" }}>
          {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
          {situation.severity ?? "(no severity)"} ·{" "}
          {situation.reportType ?? "(no type)"}
        </Typography>
        {featureCount === 0 && (
          <Typography component="span" sx={{ fontSize: 10, color: "#999" }}>
            not on map
          </Typography>
        )}
        {flags.map((flag) => (
          <Typography
            key={flag}
            component="span"
            sx={{
              fontSize: 10,
              color: FLAG_LEVEL[flag] === "warning" ? "#c0392b" : "#666",
            }}
          >
            {flag}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
