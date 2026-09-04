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

/** A stop as `affects` delivers it: id always, name and location only when the API resolved them. */
export type StopRef = {
  id: string;
  name: string | null;
  location: { latitude: number; longitude: number } | null;
};

export type StopConditionEnumeration =
  | "exceptionalStop"
  | "destination"
  | "notStopping"
  | "requestStop"
  | "startPoint";

/** A stop within an affected journey or line, with the SIRI stop conditions that qualify it. */
export type AffectedStop = {
  stop: StopRef;
  stopConditions: StopConditionEnumeration[];
};

/**
 * One affected journey, with the stops it is affected at and — when the API can
 * produce one — the span of its route between the first and last of them.
 *
 * `line` here is display context only. A journey entry is scoped to the journey
 * it names, never to this line.
 */
export type AffectedVehicleJourney = {
  serviceJourney: { id: string } | null;
  datedServiceJourney: { id: string } | null;
  line: Line | null;
  operator: Operator | null;
  stops: AffectedStop[] | null;
  affectedPointsOnLink: { points: string | null; length: number | null } | null;
};

/**
 * One affected line, with the stops it is affected at and - when the API can
 * produce one - a span of its geometry.
 *
 * That span is **one representative pattern**, not the line as a whole: a line
 * has many journey patterns, and the API picks the first the affected stops
 * locate on, or the longest when the line is affected as a whole. Treat it as
 * indicative of where the line is affected, not as the line's shape.
 */
export type AffectedLine = {
  line: Line | null;
  stops: AffectedStop[] | null;
  affectedPointsOnLink: { points: string | null; length: number | null } | null;
};

/**
 * What a situation claims to affect.
 *
 * `vehicleJourneys` and `affectedLines` are the only places journeys and lines
 * are published. They replaced flat `lines`, `serviceJourneys` and
 * `datedServiceJourneys` lists, which the API has since removed entirely: each
 * entry now pairs its journey or line with the located stops it is affected at,
 * and either kind may carry an `affectedPointsOnLink` span — the journey's own
 * route, or, for a line, one representative pattern of it.
 *
 * `stopPoints` and `stopPlaces` are **not** superseded by those two — measured
 * on dev, every situation carrying them names no journey and no line at all.
 */
export type Affects = {
  vehicleModes: VehicleModeEnumeration[] | null;
  stopPoints: StopRef[] | null;
  stopPlaces: StopRef[] | null;
  operators: Operator[] | null;
  vehicleJourneys: AffectedVehicleJourney[] | null;
  affectedLines: AffectedLine[] | null;
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
