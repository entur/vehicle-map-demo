import { useEffect, useState } from "react";
import { VehicleUpdate } from "../types.ts";
import { IntervalRecords, recordReports } from "../domain/updateIntervals.ts";

/**
 * Watches every vehicle frame, whether or not the statistics panel is open,
 * so the panel opens on intervals already measured. The records are one
 * mutable map that outlives the vehicle cache — see updateIntervals.ts — and
 * are read by the panel when the next frame re-renders it, one frame behind.
 */
export function useUpdateIntervals(data: VehicleUpdate[]): IntervalRecords {
  const [records] = useState<IntervalRecords>(() => new Map());
  useEffect(() => {
    recordReports(records, data, Date.now());
  }, [records, data]);
  return records;
}
