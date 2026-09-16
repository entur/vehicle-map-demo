import { FormattedExecutionResult } from "graphql-ws";
import { VehicleUpdateComplete } from "../types.ts";
import { useEffect, useRef, useState } from "react";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  vehicles: VehicleUpdateComplete[];
};

const subscriptionQuery = `
  subscription($vehicleId: String!, $serviceJourneyId: String!) {
    vehicles(vehicleId: $vehicleId, serviceJourneyId: $serviceJourneyId, includeInvalidLocations: true) {
      direction
      serviceJourney {
        id
        date
      }
      datedServiceJourney {
        id
        serviceJourney {
          id
          date
        }
      }
      operator {
        operatorRef
        name
      }
      codespace {
        codespaceId
      }
      originRef
      originName
      destinationRef
      destinationName
      mode
      vehicleId
      occupancyStatus
      line {
        lineRef
        lineName
        publicCode
      }
      lastUpdated
      expiration
      location {
        latitude
        longitude
      }
      speed
      bearing
      monitored
      delay
      inCongestion
      vehicleStatus
      progressBetweenStops {
        linkDistance
        percentage
      }
      monitoredCall {
        stopPointRef
        order
        vehicleAtStop
      }
    }
  }
`;

export const useVehicleUpdateCompleteSubscription = (
  vehicleId: string,
  serviceJourneyId: string,
) => {
  const [vehicleUpdate, setVehicleUpdate] =
    useState<VehicleUpdateComplete | null>(null);

  const subscriptionRef = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    // A frame already resolved in the iterator's queue when `.return()` is
    // called in the cleanup can still run one more loop iteration; `cancelled`
    // keeps it from reaching state after unmount or a change of vehicle.
    let cancelled = false;

    subscriptionRef.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
      variables: { vehicleId, serviceJourneyId },
    });

    const subscribe = async () => {
      if (!subscriptionRef.current) return;

      for await (const event of subscriptionRef.current) {
        if (cancelled) break;
        if (event?.data?.vehicles?.length) {
          setVehicleUpdate(event.data.vehicles[0]);
        }
      }
    };

    subscribe().catch((error) => {
      console.error("Subscription error:", error);
    });

    // Closed on unmount as well as on a change of vehicle. Without this the
    // subscription outlived its popup or panel for the rest of the session.
    return () => {
      cancelled = true;
      subscriptionRef.current?.return?.();
    };
  }, [vehicleId, serviceJourneyId, subscriptionClient]);

  return vehicleUpdate;
};
