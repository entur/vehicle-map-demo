import { FormattedExecutionResult } from "graphql-ws";
import { useEffect, useRef, useState } from "react";
import { EstimatedTimetableUpdate } from "../types.ts";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  timetables: EstimatedTimetableUpdate[];
};

const subscriptionQuery = `
  subscription($serviceJourneyId: String!, $date: String!) {
    timetables(serviceJourneyIdAndDates: [{ serviceJourneyId: $serviceJourneyId, date: $date }]) {
      serviceJourney {
        id
        date
      }
      line {
        lineRef
        lineName
        publicCode
      }
      mode
      originName
      destinationName
      cancellation
      calls {
        stopPoint {
          id
          name
          location {
            latitude
            longitude
          }
        }
        order
        aimedArrivalTime
        aimedDepartureTime
        expectedArrivalTime
        expectedDepartureTime
        actualArrivalTime
        actualDepartureTime
        callType
        cancellation
        forBoarding
        occupancyStatus
      }
    }
  }
`;

export function useTimetableSubscription(
  serviceJourneyId: string | null,
  date: string | null,
): EstimatedTimetableUpdate | null {
  const [timetable, setTimetable] = useState<EstimatedTimetableUpdate | null>(
    null,
  );
  const subscriptionRef = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    if (subscriptionRef.current?.return) {
      subscriptionRef.current.return();
    }
    setTimetable(null);

    if (!serviceJourneyId || !date) {
      return;
    }

    subscriptionRef.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
      variables: { serviceJourneyId, date },
    });

    const subscribe = async () => {
      if (!subscriptionRef.current) return;
      for await (const event of subscriptionRef.current) {
        const update = event?.data?.timetables?.[0];
        if (update) {
          setTimetable(update);
        }
      }
    };

    subscribe().catch((err) => {
      console.error("Timetable subscription error:", err);
    });

    return () => {
      subscriptionRef.current?.return?.();
    };
  }, [serviceJourneyId, date, subscriptionClient]);

  return timetable;
}
