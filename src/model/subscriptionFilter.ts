export type SubscriptionFilter = {
  codespace?: string;
  serviceJourneyId?: string;
  operator?: string;
  vehicleId?: string;
  lineRef?: string;
  lineName?: string;
  boundingBox?: string;
  monitored?: boolean;
};
