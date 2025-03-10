import { FormattedExecutionResult } from "graphql-ws";
import { VehicleUpdateComplete } from "../types.ts";
import { useEffect, useRef, useState } from "react";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  vehicles: VehicleUpdateComplete[];
};

const subscriptionQuery = `
  subscription($vehicleId: String!) {
    vehicles(vehicleId: $vehicleId) {
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

export const useVehicleUpdateCompleteSubscription = (vehicleId: string) => {
  const [vehicleUpdate, setVehicleUpdate] =
    useState<VehicleUpdateComplete | null>(null);

  const subscriptionRef = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    if (subscriptionRef.current?.return) {
      subscriptionRef.current.return();
    }

    subscriptionRef.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
      variables: { vehicleId },
    });

    const subscribe = async () => {
      if (!subscriptionRef.current) return;

      for await (const event of subscriptionRef.current) {
        if (event?.data?.vehicles?.length) {
          setVehicleUpdate(event.data.vehicles[0]);
        }
      }
    };

    subscribe().catch((error) => {
      console.error("Subscription error:", error);
    });

    return () => {};
  }, [vehicleId, subscriptionClient]);

  return vehicleUpdate;
};
