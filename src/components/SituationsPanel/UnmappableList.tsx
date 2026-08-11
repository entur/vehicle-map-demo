import { Box, Typography } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";
import { affectsShape } from "../../domain/situationStats.ts";

/**
 * Situations that flatten to no map features at all — on this feed the
 * majority, dominated by the ones referencing only dated service journeys,
 * whose IDs resolve to nothing geographic in this API.
 *
 * This list is computed over the unfiltered set and is these situations' only
 * surface, so it exists whether or not the current filter would show them.
 */
export function UnmappableList() {
  const { unmappable, feed, setSelected, selected } = useSituations();

  const byNumber = new Map(feed.situations.map((s) => [s.situationNumber, s]));

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
        Not on the map ({unmappable.length} of {feed.situations.length})
      </Typography>
      <Box sx={{ maxHeight: "25vh", overflowY: "auto" }}>
        {unmappable.map((situationNumber, index) => {
          const situation = byNumber.get(situationNumber);
          if (!situation) return null;
          return (
            <Box
              key={`${situationNumber}-${index}`}
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
