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
  codespaceId?: string;
};

export type Line = {
  lineRef: string;
  lineName: string;
  publicCode: string;
};

export type Codespace = {
  codespaceId: string;
};

export type VehicleUpdate = {
  vehicleId: string;
  codespace: Codespace;
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
