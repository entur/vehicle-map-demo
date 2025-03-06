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
  serviceJourney: ServiceJourney;
  lastUpdated: string;
};

export type ServiceJourney = {
  id: string;
  date: string;
};

export type DatedServiceJourney = {
  id: string;
  serviceJourney: ServiceJourney;
};

export type OccupancyStatus =
  | "noData" // No occupancy data is available
  | "empty" // Vehicle is considered empty or has very few passengers
  | "manySeatsAvailable" // More than ~50% of seats are available
  | "fewSeatsAvailable" // ~10%-50% of seats are available
  | "standingRoomOnly" // Only standing room is available
  | "crushedStandingRoomOnly" // Standing room only, at or near crush load
  | "full" // Vehicle is full; no more passengers can board
  | "notAcceptingPassengers"; // Vehicle is not accepting any passengers

export type VehicleStatusEnumeration =
  | "ASSIGNED"
  | "AT_ORIGIN"
  | "CANCELLED"
  | "COMPLETED"
  | "IN_PROGRESS"
  | "OFF_ROUTE";

export type ProgressBetweenStops = {
  linkDistance: number; // The distance (in meters, for example) between stops
  percentage: number; // How far along the route the vehicle is, in percent
};

export type MonitoredCall = {
  stopPointRef: string; // Reference to the stop or quay
  order: number; // The order in which the vehicle calls this stop
  vehicleAtStop: boolean; // Indicates if the vehicle is currently at the stop
};

export type VehicleUpdateComplete = {
  direction: string | null;
  serviceJourney: ServiceJourney;
  datedServiceJourney: DatedServiceJourney | null;
  operator: Operator;
  codespace: Codespace;
  originRef: string;
  originName: string;
  destinationRef: string;
  destinationName: string;
  mode: VehicleModeEnumeration;
  vehicleId: string;
  occupancyStatus: OccupancyStatus;
  line: Line;
  lastUpdated: string;
  expiration: string;
  location: {
    latitude: number;
    longitude: number;
  };
  speed: number | null;
  bearing: number | null;
  monitored: boolean;
  delay: number;
  inCongestion: boolean;
  vehicleStatus: VehicleStatusEnumeration;
  progressBetweenStops: ProgressBetweenStops;
  monitoredCall: MonitoredCall;
};

export type Data = {
  vehicles: VehicleUpdate[];
};

export type DataItem = {
  category: string;
  itemsWithValue: number;
};

export type MapViewOptions = {
  showVehicleTraces: boolean;
  showVehicles: boolean;
  showDelay: boolean;
  showVehicleHeatmap: boolean;
  showUpdateFrequency: boolean;
};
