import { useLazyQuery } from "@apollo/client";
import { SERVICE_JOURNEYS_QUERY } from "api/graphql";
import { ServiceJourney } from "model/serviceJourney";
import { useEffect, useMemo } from "react";

export default function useServiceJourneyIds(lineRef?: string) {
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
        .map((sj: ServiceJourney) => sj.serviceJourneyId)
        .sort() || []
    );
  }, [serviceJourneysData?.serviceJourneys]);
}
