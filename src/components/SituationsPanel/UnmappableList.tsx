import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";
import { affectsShape } from "../../domain/situationStats.ts";

/**
 * Situations that flatten to no map features at all — a small minority on
 * this feed (99 of 944 measured on dev), not the majority: affects that name
 * only an operator, or stops/journeys/lines the API could not locate, or no
 * affects at all.
 *
 * This is the map's complement over the *filtered* set: every situation the
 * current filter admits is either drawn on the map or listed here. Computing
 * it over the whole feed instead would leave it contradicting the controls
 * above it — listing ATB situations while the map filter is narrowed to AKT.
 */
export function UnmappableList() {
  const { features, filtered, setSelected, selected } = useSituations();
  const unmappable = features.unmappable;

  const byNumber = new Map(filtered.map((s) => [s.situationNumber, s]));

  return (
    <Box sx={{ marginBottom: 2 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        Not on the map ({unmappable.length} of {filtered.length})
      </Typography>
      <Box sx={{ maxHeight: "25vh", overflowY: "auto" }}>
        {unmappable.map((situationNumber) => {
          const situation = byNumber.get(situationNumber);
          if (!situation) return null;
          return (
            <Box
              key={situationNumber}
              component="button"
              type="button"
              onClick={() =>
                setSelected(
                  selected === situationNumber ? null : situationNumber,
                )
              }
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px dotted #eee",
                background: selected === situationNumber ? "#eef7f7" : "none",
                cursor: "pointer",
                padding: "4px 0",
                font: "inherit",
              }}
            >
              <Typography component="div" sx={{ fontSize: 11 }}>
                {pickTranslation(situation.summary) ?? "(no summary)"}
              </Typography>
              <Typography component="div" sx={{ fontSize: 10, color: "#999" }}>
                {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
                {affectsShape(situation)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
