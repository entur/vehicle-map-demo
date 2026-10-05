import { VehicleUpdate } from "../../types.ts";

/**
 * A vehicle drawn at a position worked out every animation frame: the chased
 * vehicle as the chase camera interpolates it, or the selected vehicle's
 * schedule ghost. A plain subscribable value rather than React state — a state
 * update per frame would re-render the whole map tree.
 */
export class VehicleStore {
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
