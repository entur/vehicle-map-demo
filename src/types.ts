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

export type VehicleUpdate = {
  vehicleId: string;
  mode: VehicleModeEnumeration;
  location: {
    latitude: number;
    longitude: number;
  };
};

export type Data = {
  vehicles: VehicleUpdate[];
};
