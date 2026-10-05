import type { Filter } from "../../types.ts";
import type { KioskSession } from "../../domain/kioskSchedule.ts";

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
  onStart: (dwellMs: number, idleMs: number) => void;
  onStop: () => void;
};
