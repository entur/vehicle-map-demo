import { Box, Typography } from "@mui/material";
import { NationalSituation } from "../../types.ts";
import { useSituations } from "../../situations/SituationsContext.ts";
import { pickTranslation } from "../SelectedVehiclePanel/situationText.ts";
import { affectsShape } from "../../domain/situationStats.ts";
import { FLAG_LEVEL } from "../../domain/situationFlags.ts";

/**
 * Situations that flatten to no map features at all — a small minority on
 * this feed (99 of 944 measured on dev), not the majority: affects that name
 * only an operator, or stops/journeys/lines the API could not locate, or no
 * affects at all.
 *
 * The half `partitionByMappability` did not give the list above, passed in
 * rather than re-derived here so the two lists cannot overlap: these
 * situations appear in this list and nowhere else, which is why the meta line
 * carries severity, reportType and the quality flags as well as the affects
 * shape. The flags matter here in particular: every situation carrying
 * `mistypedJourneyRef` is unmappable, so this list is the only place that badge
 * is ever seen.
 *
 * The panel partitions the *filtered* set, so this stays the map's complement under
 * whatever the controls above admit — computed over the whole feed it would
 * list ATB situations while the map filter is narrowed to AKT.
 */
export function UnmappableList({
  unmappable,
}: {
  unmappable: NationalSituation[];
}) {
  const { filtered, setSelected, selected, flagsBySituation } = useSituations();

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
        {unmappable.map((situation) => {
          const situationNumber = situation.situationNumber;
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
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Typography
                  component="span"
                  sx={{ fontSize: 10, color: "#999" }}
                >
                  {situation.codespace?.codespaceId ?? "(no codespace)"} ·{" "}
                  {situation.severity ?? "(no severity)"} ·{" "}
                  {situation.reportType ?? "(no type)"} ·{" "}
                  {affectsShape(situation)}
                </Typography>
                {(flagsBySituation.get(situationNumber) ?? []).map((flag) => (
                  <Typography
                    key={flag}
                    component="span"
                    sx={{
                      fontSize: 10,
                      color:
                        FLAG_LEVEL[flag] === "warning" ? "#c0392b" : "#999",
                    }}
                  >
                    {flag}
                  </Typography>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
