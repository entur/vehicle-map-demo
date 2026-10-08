import type { Filter } from "../../types.ts";
import type {
  KioskSession,
  KioskSettings,
} from "../../domain/kioskSchedule.ts";
import type { FixedCamera } from "../../domain/fixedCamera.ts";
import type { ViewDimension } from "../../domain/viewDimension.ts";

export type RightContentType =
  | "filtering"
  | "info"
  | "layers"
  | "stoplight"
  | "statistics"
  | "situations"
  | "situationStats"
  | "kiosk";

/** What the Kiosk tool shows and does; `MapView` owns the run. */
export type KioskTool = {
  session: KioskSession | null;
  /** What a run chases: the current filter, or the running one's own. */
  filter: Partial<Filter> | null;
  onStart: (settings: KioskSettings) => void;
  onStop: () => void;
  /** The map's camera now, for a fixed view; null before the map loads. */
  readCamera: () => FixedCamera | null;
  /** The view dimension now, which a fixed view restores with its camera. */
  dimension: ViewDimension;
};
