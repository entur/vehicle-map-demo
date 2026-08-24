import { MapViewOptions } from "../types.ts";

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
 * `vehicle-follow-layer` and `vehicle-update-interval-text-layer` are declared
 * `visibility: "none"` in mapStyle and referenced nowhere else in src/: nothing
 * currently turns them on. They are listed so the completeness test passes and
 * so they cannot be stranded visible by a future change — not revived.
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
  situations: ["situation-lines-layer", "situation-points-layer"],
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
 * features, not by a visibility toggle, so leaving them hidden after a mode
 * switch silently disables the feature that feeds them.
 *
 * Deliberately explicit rather than "everything in MODE_LAYERS that is not
 * switched": that rule would also reveal the dormant layers, and
 * `vehicle-follow-layer` reads the live `vehicles` source, so it would start
 * drawing.
 */
export const MODE_DEFAULT_VISIBLE_LAYERS: Record<AppMode, string[]> = {
  vehicles: ["service-journey-route-layer"],
  situations: [],
};

/** GeoJSON sources a mode writes into — emptied when the mode is left. */
export const MODE_SOURCES: Record<AppMode, string[]> = {
  vehicles: ["vehicles", "vehicleTraces", "serviceJourneyRoute"],
  situations: ["situationLines", "situationPoints"],
};

export const otherMode = (mode: AppMode): AppMode =>
  mode === "vehicles" ? "situations" : "vehicles";

export const isVehicleFeedEnabled = (mode: AppMode): boolean =>
  mode === "vehicles";

export const isSituationsFeedEnabled = (mode: AppMode): boolean =>
  mode === "situations";

/** Anything unrecognised — including a hand-edited URL — falls back to vehicles. */
export const parseAppMode = (value: string | undefined | null): AppMode =>
  value === "situations" ? "situations" : "vehicles";
