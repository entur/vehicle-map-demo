export type Vehicle = {
  codespaceId: string;
  vehicleId: string;
  direction: string | number;
  lineName: string;
  lineRef: string;
  serviceJourneyId: string;
  operator: string;
  mode: string;
  lastUpdated: string;
  expiration: string;
  speed: number;
  heading: number;
  monitored: boolean;
  delay: number;
  location: {
    latitude: number;
    longitude: number;
  };
};
