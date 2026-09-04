import { Box, Typography } from "@mui/material";
import { memo } from "react";
import { NationalSituation } from "../../types.ts";
import { FLAG_LEVEL, SituationFlag } from "../../domain/situationFlags.ts";
import { severityColour } from "../SelectedVehiclePanel/situationSeverity.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";

type SituationRowProps = {
  situation: NationalSituation;
  flags: SituationFlag[];
  featureCount: number;
  selected: boolean;
  onSelect: (situationNumber: string) => void;
};

/**
 * Compared by hand because `flags` is rebuilt — new array, same contents — on
 * every situations frame, which is precisely the render this memo exists to
 * skip. A default shallow compare would see a new array and re-render all ~580
 * rows each time.
 */
function propsAreEqual(a: SituationRowProps, b: SituationRowProps): boolean {
  return (
    // Situations that were not in the incoming frame keep their object
    // identity in the feed's Map, so this is a real early-out.
    a.situation === b.situation &&
    a.featureCount === b.featureCount &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect &&
    a.flags.length === b.flags.length &&
    a.flags.every((flag, index) => flag === b.flags[index])
  );
}

function SituationRowImpl({
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
      onClick={() => onSelect(situation.situationNumber)}
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

export const SituationRow = memo(SituationRowImpl, propsAreEqual);
