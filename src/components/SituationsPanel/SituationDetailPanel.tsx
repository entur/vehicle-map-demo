import { Box, Drawer } from "@mui/material";
import { useSituations } from "../../situations/SituationsContext.ts";
import {
  DETAIL_DRAWER_TOP_OFFSET,
  DETAIL_DRAWER_WIDTH,
} from "../detailDrawer.ts";
import { SituationDetail } from "./SituationDetail.tsx";

/**
 * The selected situation's raw detail, in its own left-hand drawer — the same
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
 * selection the moment the filtered set stops containing it, so this drawer
 * closes on a filter change rather than lingering over a situation the map no
 * longer shows.
 */
export function SituationDetailPanel() {
  const { feed, flagsBySituation, selected, setSelected } = useSituations();

  const situation =
    selected === null
      ? null
      : (feed.situations.find((s) => s.situationNumber === selected) ?? null);

  return (
    <Drawer
      anchor="left"
      variant="persistent"
      open={situation !== null}
      slotProps={{
        paper: {
          sx: {
            width: DETAIL_DRAWER_WIDTH,
            top: DETAIL_DRAWER_TOP_OFFSET,
            height: `calc(100% - ${DETAIL_DRAWER_TOP_OFFSET}px)`,
            padding: 2,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {situation && (
        // `minHeight: 0` so the flex child may shrink below its content and
        // actually scroll — a situation with many affects groups is far taller
        // than the drawer.
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <SituationDetail
            situation={situation}
            flags={flagsBySituation.get(situation.situationNumber) ?? []}
            onClose={() => setSelected(null)}
          />
        </Box>
      )}
    </Drawer>
  );
}
