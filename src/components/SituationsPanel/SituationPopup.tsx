import { Box, Typography } from "@mui/material";
import { Popup } from "react-map-gl/maplibre";
import { useSituations } from "../../situations/SituationsContext.ts";
import { severityColour } from "../SelectedVehiclePanel/situationSeverity.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";

type SituationPopupProps = {
  longitude: number;
  latitude: number;
  /** Every situation whose feature was under the click, in hit order. */
  situationNumbers: string[];
  onSelect: (situationNumber: string) => void;
  onClose: () => void;
};

/**
 * Lists every situation at the clicked point rather than assuming one.
 *
 * Features are deduplicated within a situation but deliberately not across
 * situations, so a single stop affected by three situations carries three
 * coincident features and one click hits all three. Picking the topmost would
 * silently hide the other two — which is exactly the overlap this tool exists
 * to expose.
 */
export function SituationPopup({
  longitude,
  latitude,
  situationNumbers,
  onSelect,
  onClose,
}: SituationPopupProps) {
  const { feed, selected } = useSituations();

  const situations = situationNumbers
    .map((situationNumber) =>
      feed.situations.find((s) => s.situationNumber === situationNumber),
    )
    .filter((situation) => situation !== undefined);

  if (situations.length === 0) return null;

  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      offset={[0, -10]}
      onClose={onClose}
      closeOnClick={false}
      maxWidth="320px"
    >
      <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#666",
            marginBottom: 0.5,
          }}
        >
          {situations.length === 1
            ? "1 situation here"
            : `${situations.length} situations here`}
        </Typography>

        {situations.map((situation) => (
          <Box
            key={situation.situationNumber}
            component="button"
            type="button"
            onClick={() => onSelect(situation.situationNumber)}
            aria-pressed={selected === situation.situationNumber}
            sx={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              borderBottom: "1px dotted #eee",
              borderLeft: `3px solid ${severityColour(situation.severity)}`,
              background:
                selected === situation.situationNumber ? "#eef7f7" : "none",
              cursor: "pointer",
              padding: "4px 6px",
              font: "inherit",
            }}
          >
            <Typography component="div" sx={{ fontSize: 12, fontWeight: 600 }}>
              {pickTranslation(situation.summary) ?? "(no summary)"}
            </Typography>
            <Typography component="div" sx={{ fontSize: 10, color: "#666" }}>
              {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
              {situation.severity ?? "(no severity)"} ·{" "}
              {situation.reportType ?? "(no type)"}
            </Typography>
            <Typography
              component="div"
              sx={{ fontSize: 9, color: "#999", wordBreak: "break-all" }}
            >
              {situation.situationNumber}
            </Typography>
          </Box>
        ))}
      </Box>
    </Popup>
  );
}
