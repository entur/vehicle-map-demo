import { VehicleUpdate } from "../../types.ts";

/**
 * The chased vehicle as the chase camera currently sees it: the newest report,
 * with its location and bearing replaced by the interpolated ones. Written
 * every animation frame, so it is a plain subscribable value rather than React
 * state — a state update per frame would re-render the whole map tree.
 */
export class ChasedVehicleStore {
  private value: VehicleUpdate | null = null;
  private readonly listeners = new Set<() => void>();

  get() {
    return this.value;
  }

  set(value: VehicleUpdate | null) {
    this.value = value;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Identifies a chase: the same vehicle on another journey is another chase. */
export type ChasedVehicle = { vehicleId: string; serviceJourneyId: string };
