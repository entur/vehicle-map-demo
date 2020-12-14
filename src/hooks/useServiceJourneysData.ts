import { useLazyQuery } from "@apollo/client";
import { SERVICE_JOURNEYS_QUERY } from "api/graphql";
import { useEffect, useMemo } from "react";

export type ServiceJourney = {
  id: string;
};

export default function useServiceJourneysData(lineRef?: string) {
  const [fetchServiceJourneys, { data: serviceJourneysData }] = useLazyQuery(
    SERVICE_JOURNEYS_QUERY
  );

  useEffect(() => {
    if (lineRef) {
      fetchServiceJourneys({
        variables: { lineRef },
      });
    }
  }, [lineRef, fetchServiceJourneys]);

  return useMemo(() => {
    return (
      serviceJourneysData?.serviceJourneys
        .map((sj: ServiceJourney) => sj.id)
        .sort() || []
    );
  }, [serviceJourneysData?.serviceJourneys]);
}
