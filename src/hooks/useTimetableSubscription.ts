import { FormattedExecutionResult } from "graphql-ws";
import { useEffect, useRef, useState } from "react";
import { EstimatedTimetableUpdate } from "../types.ts";
import { SITUATION_FIELDS_FRAGMENT } from "./situationFragments.ts";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  timetables: EstimatedTimetableUpdate[];
};

const subscriptionQuery = `
  ${SITUATION_FIELDS_FRAGMENT}

  subscription($serviceJourneyId: String!, $date: String!) {
    timetables(serviceJourneyIdAndDates: [{ id: $serviceJourneyId, date: $date }]) {
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
      situations {
        ...SituationFields
      }
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
        situations {
          ...SituationFields
        }
      }
    }
  }
`;

export function useTimetableSubscription(
  serviceJourneyId: string | null,
  date: string | null,
): EstimatedTimetableUpdate | null {
  // Stored with the journey it arrived for, so a changed selection reads as no
  // timetable straight away instead of being cleared by the effect.
  const journeyKey = `${serviceJourneyId}|${date}`;
  const [received, setReceived] = useState<{
    journeyKey: string;
    timetable: EstimatedTimetableUpdate;
  } | null>(null);
  const subscriptionRef = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    if (subscriptionRef.current?.return) {
      subscriptionRef.current.return();
    }

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
          setReceived({ journeyKey, timetable: update });
        }
      }
    };

    subscribe().catch((err) => {
      console.error("Timetable subscription error:", err);
    });

    return () => {
      subscriptionRef.current?.return?.();
    };
  }, [serviceJourneyId, date, journeyKey, subscriptionClient]);

  return received?.journeyKey === journeyKey ? received.timetable : null;
}
