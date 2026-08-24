export type VehicleModeEnumeration =
  "AIR" | "BUS" | "COACH" | "FERRY" | "METRO" | "TAXI" | "TRAM" | "RAIL";

export type Filter = {
  boundingBox: number[][];
  codespaceId?: string;
  operatorRef?: string;
  maxDataAge?: number;
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
  name: string;
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
  occupancyStatus: OccupancyStatus;
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
  | "unknown" // SIRI: unknown
  | "empty" // Vehicle is considered empty or has very few passengers
  | "manySeatsAvailable" // More than ~50% of seats are available
  | "seatsAvailable" // SIRI: some seats are available
  | "fewSeatsAvailable" // ~10%-50% of seats are available
  | "standingAvailable" // SIRI: standing room is available
  | "standingRoomOnly" // Only standing room is available
  | "crushedStandingRoomOnly" // Standing room only, at or near crush load
  | "full" // Vehicle is full; no more passengers can board
  | "notAcceptingPassengers" // Vehicle is not accepting any passengers
  | "undefined"; // SIRI: undefined

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
  showDeadUpdateFrequency: boolean;
  showOccupancy: boolean;
  showAffectedStops: boolean;
  showAffectedLines: boolean;
};

export type Stop = {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
};

export type CallType = "RECORDED" | "ESTIMATED";

export type SeverityEnumeration =
  | "unknown"
  | "verySlight"
  | "slight"
  | "normal"
  | "severe"
  | "verySevere"
  | "noImpact"
  | "undefined";

export type TranslatedString = {
  value: string | null;
  language: string | null;
};

export type ValidityPeriod = {
  startTime: string | null;
  endTime: string | null;
};

export type InfoLink = {
  uri: string | null;
  labels: TranslatedString[];
};

/**
 * A deviation message from the realtime feed (SIRI situation exchange).
 *
 * This is the trimmed shape the timetable subscription's `Call`/
 * `EstimatedTimetableUpdate` selects — only the fields that view renders.
 * Do not widen this type for fields used elsewhere: affects, priority,
 * progress, creationTime, openEnded and age are already modelled and
 * displayed on the sibling `NationalSituation` below, which the situations
 * feed uses instead.
 */
export type Situation = {
  situationNumber: string;
  version: number | null;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  summary: TranslatedString[];
  description: TranslatedString[];
  advice: TranslatedString[];
  validityPeriods: ValidityPeriod[];
  infoLinks: InfoLink[];
};

export type SituationProgress =
  | "draft"
  | "pendingApproval"
  | "approvedDraft"
  | "open"
  | "published"
  | "closing"
  | "closed";

/**
 * What a situation claims to affect.
 *
 * Only `stopPoints` and `stopPlaces` carry coordinates — `Line` exposes no
 * geometry at all, and the service-journey IDs here are in a different
 * namespace from the realtime feed's, so they resolve to nothing. See the
 * design spec for the measurements behind that.
 */
export type AffectedStop = {
  id: string;
  name: string | null;
  location: { latitude: number; longitude: number } | null;
};

export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  lines: Line[] | null;
  stopPoints: AffectedStop[] | null;
  stopPlaces: AffectedStop[] | null;
  serviceJourneys: ServiceJourney[] | null;
  datedServiceJourneys: { id: string }[] | null;
  operators: Operator[] | null;
};

/**
 * A situation from the national `situations` feed, as opposed to the trimmed
 * `Situation` the timetable subscription selects. Every field here comes from
 * the `SituationQaFields` fragment.
 */
export type NationalSituation = Situation & {
  participantRef: string | null;
  codespace: Codespace | null;
  sourceType: string | null;
  progress: SituationProgress | null;
  priority: number | null;
  planned: boolean | null;
  creationTime: string | null;
  versionedAtTime: string | null;
  lastUpdated: string | null;
  expiration: string | null;
  openEnded: boolean | null;
  age: string | null;
  affects: Affects | null;
};

export type Call = {
  stopPoint: Stop;
  order: number;
  aimedArrivalTime: string | null;
  aimedDepartureTime: string | null;
  expectedArrivalTime: string | null;
  expectedDepartureTime: string | null;
  actualArrivalTime: string | null;
  actualDepartureTime: string | null;
  callType: CallType;
  cancellation: boolean;
  forBoarding: boolean | null;
  occupancyStatus: OccupancyStatus | null;
  situations: Situation[] | null;
};

export type EstimatedTimetableUpdate = {
  serviceJourney: ServiceJourney;
  line: Line;
  mode: VehicleModeEnumeration;
  originName: string;
  destinationName: string;
  cancellation: boolean;
  calls: Call[];
  situations: Situation[] | null;
};

export type RoutePolyline = {
  coordinates: number[][]; // [lng, lat] pairs
  length: number | null;
};
