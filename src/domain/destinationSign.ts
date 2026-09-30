import { VehicleUpdate } from "../types.ts";
import { signColourFor } from "./vehiclePaint.ts";

type RGB = [number, number, number];

type SignedVehicle = Pick<VehicleUpdate, "destinationName" | "line">;

/** Vehicles whose destination signs look the same: one text, one colour. */
export type SignGroup<T> = {
  /** Stable across frames for the same text and colour; used in layer ids. */
  key: string;
  text: string;
  colour: RGB;
  vehicles: T[];
};

/**
 * What a vehicle's destination signs show: its destination name as
 * published, only trimmed. Blank when the feed carries none — an unlit sign
 * rather than an invented destination.
 */
export function signTextFor(vehicle: Pick<VehicleUpdate, "destinationName">) {
  return (vehicle.destinationName ?? "").trim();
}

/**
 * The vehicles split by what their signs show. A sign's texture holds both
 * its text and its colour, and a deck.gl layer takes one texture, so each
 * group is drawn as a layer of its own. Groups keep the order in which their
 * first vehicle appears.
 */
export function signGroups<T extends SignedVehicle>(
  vehicles: T[],
): SignGroup<T>[] {
  const groups = new Map<string, SignGroup<T>>();
  for (const vehicle of vehicles) {
    const text = signTextFor(vehicle);
    const colour = signColourFor(vehicle);
    const key = `${colour.join(",")}|${text}`;
    const group = groups.get(key);
    if (group) group.vehicles.push(vehicle);
    else groups.set(key, { key, text, colour, vehicles: [vehicle] });
  }
  return [...groups.values()];
}
