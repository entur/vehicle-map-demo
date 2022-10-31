import { Position } from "deck.gl";
import { Vehicle } from "./vehicle";

export type VehicleMapPoint = {
  icon: string;
  vehicle: Vehicle;
  historicalPath: Position[];
  lastUpdated: number;
};
