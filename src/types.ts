export type VehicleModeEnumeration =
  | "AIR"
  | "BUS"
  | "COACH"
  | "FERRY"
  | "METRO"
  | "TAXI"
  | "TRAM"
  | "RAIL";

export type Filter = {
  boundingBox: number[][];
};

export type Line = {
  lineRef: string;
  lineName: string;
  publicCode: string;
};

export type VehicleUpdate = {
  vehicleId: string;
  mode: VehicleModeEnumeration;
  line: Line;
  delay: number;
  location: {
    latitude: number;
    longitude: number;
  };
};

export type Data = {
  vehicles: VehicleUpdate[];
};
