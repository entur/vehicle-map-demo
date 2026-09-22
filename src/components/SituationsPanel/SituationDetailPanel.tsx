import { Box } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import { DETAIL_PANEL_SX } from "../detailDrawer.ts";
import { FloatingCard } from "../FloatingCard.tsx";
import { SituationDetail } from "./SituationDetail.tsx";

/**
 * The selected situation's raw detail, in its own left-hand panel — the same
 * surface `SelectedVehiclePanel` gives a selected vehicle. It used to sit
 * inline in the situations panel, which left one 250px column carrying the live
 * list, this dump, the not-on-the-map list and the whole-feed statistics at
 * once.
 *
 * Reads the selection from context rather than taking props, like every other
 * component in this panel tree, so `MapView` only has to decide whether the
 * mode is right to render it at all.
 *
 * Resolved against the unfiltered feed, matching how the map's popup resolves
 * it. That lookup cannot miss in practice: SituationsProvider drops a
 * selection the moment the filtered set stops containing it, so this panel
 * closes on a filter change rather than lingering over a situation the map no
 * longer shows.
 */
export function SituationDetailPanel() {
  const { feed, flagsBySituation, selected, setSelected } = useSituations();

  const situation =
    selected === null
      ? null
      : (feed.situations.find((s) => s.situationNumber === selected) ?? null);

  if (situation === null) return null;

  return (
    <FloatingCard
      role="region"
      aria-label="Selected situation"
      sx={DETAIL_PANEL_SX}
    >
      {/* `minHeight: 0` so the flex child may shrink below its content and
          actually scroll — a situation with many affects groups is far taller
          than the panel. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <SituationDetail
          situation={situation}
          flags={flagsBySituation.get(situation.situationNumber) ?? []}
          onClose={() => setSelected(null)}
        />
      </Box>
    </FloatingCard>
  );
}
