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
  operatorRef?: string;
};

export type Line = {
  lineRef: string;
  lineName: string;
  publicCode: string;
};

export type Codespace = {
  codespaceId: string;
};

export type Operator = {
  operatorRef: string;
};

export type VehicleUpdate = {
  vehicleId: string;
  codespace: Codespace;
  operator: Operator;
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
