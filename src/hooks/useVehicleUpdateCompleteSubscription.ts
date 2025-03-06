import { FormattedExecutionResult } from "graphql-ws";
import { VehicleUpdateComplete } from "../types.ts";
import { useEffect, useRef, useState } from "react";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

// 1) Define a type describing the subscription's returned data shape.
//    Since the subscription field is `vehicles`, which returns an array of
//    `VehicleUpdateComplete`, we define `SubscriptionData` accordingly.
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

/**
 * This hook creates a subscription for a specific vehicle by ID.
 * It returns only the first item from the vehicles array, since
 * the subscription field returns an array but we only want one.
 */
export const useVehicleUpdateCompleteSubscription = (vehicleId: string) => {
  // 2) We'll store the latest VehicleUpdateComplete in state.
  const [vehicleUpdate, setVehicleUpdate] =
    useState<VehicleUpdateComplete | null>(null);

  // 3) We store a ref to the async subscription iterator so we can stop it if needed.
  const subscriptionRef = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  // 4) Get the subscription client from your custom hook.
  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    // Cancel any existing subscription whenever the vehicleId changes
    if (subscriptionRef.current?.return) {
      subscriptionRef.current.return();
    }

    // 5) Initialize the subscription with the correct type parameter (SubscriptionData).
    subscriptionRef.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
      variables: { vehicleId },
    });

    const subscribe = async () => {
      if (!subscriptionRef.current) return;

      for await (const event of subscriptionRef.current) {
        // If the event has data and at least one vehicle is returned
        if (event?.data?.vehicles?.length) {
          // Take the first vehicle from the array
          setVehicleUpdate(event.data.vehicles[0]);
        }
      }
    };

    subscribe().catch((error) => {
      console.error("Subscription error:", error);
    });

    // Cleanup: Stop subscription on unmount or re-render
    return () => {
      subscriptionRef.current?.return?.();
    };
  }, [vehicleId, subscriptionClient]);

  // 6) Return the single VehicleUpdateComplete item (or null if not yet available).
  return vehicleUpdate;
};
