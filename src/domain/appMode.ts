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
 * `RouteLayer` and driven by the selected service journey. Selections are
 * cleared on a mode switch, so hidden is its correct entry state, and looking
 * it up here would read a MapViewOptions key that does not exist.
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
