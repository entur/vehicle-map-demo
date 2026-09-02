import { MapViewOptions } from "../types.ts";
import { RightContentType } from "../components/RightMenu/types.ts";

/**
 * The app is in exactly one mode at a time. Mode decides which subscription is
 * open, not merely what is drawn, so it lives in `App` next to the filter
 * rather than inside a drawer.
 */
export type AppMode = "vehicles" | "situations";

export const APP_MODES: AppMode[] = ["vehicles", "situations"];

/**
 * Every layer a mode owns — hidden wholesale when the mode is left.
 *
 * Every id here must be classified into exactly one of `MODE_SWITCHED_LAYERS`,
 * `MODE_DEFAULT_VISIBLE_LAYERS` or `MODE_DORMANT_LAYERS` — see the total-
 * partition test in appMode.test.ts. An id that is added here without being
 * added to one of those three tables is hidden on the next mode exit and
 * never restored; the test exists precisely to catch that omission before it
 * reaches review.
 */
export const MODE_LAYERS: Record<AppMode, string[]> = {
  vehicles: [
    "vehicle-layer",
    "vehicle-trace-layer",
    "vehicle-follow-layer",
    "delay",
    "vehicle-update-interval-text-layer",
    "vehicle-update-interval-icon-layer",
    "vehicle-update-interval-skull-layer",
    "vehicles-heatmap",
    "occupancy-layer",
    "service-journey-route-layer",
  ],
  situations: [
    "situation-lines-layer",
    "situation-points-layer",
    "situation-lines-halo-layer",
    "situation-points-halo-layer",
  ],
};

/**
 * The subset of `MODE_LAYERS` whose visibility a MapViewOptions switch owns,
 * and which is therefore reapplied when the mode is entered.
 *
 * `service-journey-route-layer` is deliberately absent: it is owned by
 * `RouteLayer` and driven by the selected service journey, not by a
 * MapViewOptions key. It belongs in `MODE_DEFAULT_VISIBLE_LAYERS` instead —
 * see that table for why leaving it hidden after a mode switch is a bug, not
 * its correct entry state.
 */
export const MODE_SWITCHED_LAYERS: Record<
  AppMode,
  Record<string, keyof MapViewOptions>
> = {
  vehicles: {
    "vehicle-layer": "showVehicles",
    "vehicle-trace-layer": "showVehicleTraces",
    delay: "showDelay",
    "vehicle-update-interval-icon-layer": "showUpdateFrequency",
    "vehicle-update-interval-skull-layer": "showDeadUpdateFrequency",
    "vehicles-heatmap": "showVehicleHeatmap",
    "occupancy-layer": "showOccupancy",
  },
  situations: {
    "situation-points-layer": "showAffectedStops",
    "situation-lines-layer": "showAffectedLines",
  },
};

/**
 * Layers with no MapViewOptions switch that must be visible whenever their
 * mode is active. Their content is governed by whether their source has
 * features (or, for `vehicle-follow-layer`, by a feature filter) rather than
 * by a visibility toggle, so leaving them hidden after a mode switch silently
 * disables the feature that feeds them.
 *
 * `vehicle-follow-layer` belongs here, not in `MODE_DORMANT_LAYERS`: in
 * mapStyle it has no `visibility` key at all (so it defaults to visible) and
 * is driven instead by `filter: ["==", ["get", "followed"], true]` — a
 * feature-level filter, not a layout toggle. `VehicleMarkers` sets
 * `followed` on every feature, `useFollowedVehicle` owns which vehicle id is
 * followed, and `VehiclePopup` wires a follow button to it, so the layer is
 * live and fed continuously; it just draws nothing until a vehicle is
 * followed. Because it carries no visibility toggle, grepping for its layer
 * id finds no reference outside mapStyle — that absence does NOT mean the
 * layer is dormant, and this is exactly the mistake that stranded it hidden
 * after a Situations round trip in an earlier version of this file (it was
 * previously miscategorised as dormant). Deliberately explicit rather than
 * "everything in MODE_LAYERS that is not switched": that rule would also
 * reveal the genuinely dormant layers.
 */
export const MODE_DEFAULT_VISIBLE_LAYERS: Record<AppMode, string[]> = {
  vehicles: ["service-journey-route-layer", "vehicle-follow-layer"],
  // The halo layers are the situations-mode counterpart of
  // vehicle-follow-layer: filtered to the selected situation by
  // SituationLayers, never toggled. They stay visible when the "Affected
  // stops"/"Affected lines" switches are off, so a selection is still
  // pointed out on a map the user has decluttered.
  situations: ["situation-lines-halo-layer", "situation-points-halo-layer"],
};

/**
 * Layers that must stay hidden: declared `visibility: "none"` in mapStyle and
 * driven by nothing. Listed rather than inferred, so that "not classified"
 * cannot silently mean "hidden forever" — which is how two real regressions
 * reached review on this feature.
 *
 * `vehicle-update-interval-text-layer` is the only member: it has
 * `visibility: "none"` in mapStyle.ts and is referenced nowhere else in
 * src/, so nothing ever turns it on.
 */
export const MODE_DORMANT_LAYERS: Record<AppMode, string[]> = {
  vehicles: ["vehicle-update-interval-text-layer"],
  situations: [],
};

/** GeoJSON sources a mode writes into — emptied when the mode is left. */
export const MODE_SOURCES: Record<AppMode, string[]> = {
  vehicles: ["vehicles", "vehicleTraces", "serviceJourneyRoute"],
  situations: ["situationLines", "situationPoints"],
};

export const otherMode = (mode: AppMode): AppMode =>
  mode === "vehicles" ? "situations" : "vehicles";

/** The right-rail tools available in each mode, in display order. */
const RIGHT_RAIL_TOOLS: Record<AppMode, RightContentType[]> = {
  vehicles: ["layers", "filtering", "info", "stoplight"],
  situations: ["layers", "filtering", "situations", "situationStats"],
};

/** The right-rail tools available in `mode`, in the order they render. */
export function rightRailTools(mode: AppMode): RightContentType[] {
  return RIGHT_RAIL_TOOLS[mode];
}

/**
 * Tools whose drawer opens wider than the default 250px.
 *
 * The feed report is six count tables over the whole feed; in a 250px column
 * they stack into one long scroll and nothing can be compared side by side.
 * Kept as a table rather than a flag on the tool so the rail, the buttons and
 * the mode switch all read the same source when they shift out of the way.
 */
const WIDE_TOOLS: RightContentType[] = ["situationStats"];

export const isWideTool = (content: RightContentType): boolean =>
  WIDE_TOOLS.includes(content);

export const isVehicleFeedEnabled = (mode: AppMode): boolean =>
  mode === "vehicles";

export const isSituationsFeedEnabled = (mode: AppMode): boolean =>
  mode === "situations";

/** Anything unrecognised — including a hand-edited URL — falls back to vehicles. */
export const parseAppMode = (value: string | undefined | null): AppMode =>
  value === "situations" ? "situations" : "vehicles";
