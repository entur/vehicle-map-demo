export type SubscriptionFilter = {
  codespaceId?: string;
  serviceJourneyId?: string;
  mode?: string;
  operator?: string;
  vehicleId?: string;
  lineRef?: string;
  lineName?: string;
  boundingBox?: string;
  monitored?: boolean;
};
