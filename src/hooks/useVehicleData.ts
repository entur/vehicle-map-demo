import { FetchResult, useApolloClient } from "@apollo/client";
import { VEHICLES_QUERY, VEHICLE_UPDATES_SUBSCRIPTION } from "api/graphql";
import { Options } from "model/options";
import { Filter } from "model/filter";
import { Vehicle } from "model/vehicle";
import { useEffect } from "react";
import { SubscriptionOptions } from "model/subscriptionOptions";

const DEFAULT_FETCH_POLICY = "no-cache";
const DEFAULT_SWIPE_INTERVAL_IN_MS = 1000;

/**
 * Hook to query and subscribe to remote vehicle data
 */
export default function useVehicleData(
  filter: Filter,
  subscriptionOptions: SubscriptionOptions,
  options: Options,
  dispatchHydrate: (vehicles: Vehicle[]) => void,
  dispatchUpdate: (vehicles: Vehicle[]) => void,
  dispatchSweep: () => void
) {
  const client = useApolloClient();

  /**
   * Query once to hydrate vehicle data
   */
  useEffect(() => {
    async function hydrate() {
      const { data: hydrationData } = await client.query({
        query: VEHICLES_QUERY,
        fetchPolicy: DEFAULT_FETCH_POLICY,
        variables: filter,
      });
      if (hydrationData && hydrationData.vehicles) {
        dispatchHydrate(hydrationData.vehicles);
      }
    }
    hydrate();
  }, [client, filter, dispatchHydrate]);

  /**
   * Set up subscription to receive updates on vehicles
   */
  useEffect(() => {
    /**
     * To avoid triggering re-renders too frequently, buffer subscription updates
     * and set a timer to dispatch the update on a given interval.
     */
    if (subscriptionOptions?.enableLiveUpdates) {
      const subscription = client
        .subscribe({
          query: VEHICLE_UPDATES_SUBSCRIPTION,
          fetchPolicy: DEFAULT_FETCH_POLICY,
          variables: {
            ...filter,
            ...subscriptionOptions,
          },
        })
        .subscribe((fetchResult: FetchResult) => {
          dispatchUpdate(fetchResult?.data?.vehicleUpdates as Vehicle[]);
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [client, filter, subscriptionOptions, dispatchUpdate]);

  /**
   * Set a timer to swipe through vehicles to update their status
   */
  useEffect(() => {
    const timer = setInterval(() => {
      dispatchSweep();
    }, options?.swipeIntervalMs || DEFAULT_SWIPE_INTERVAL_IN_MS);

    return () => {
      clearInterval(timer);
    };
  }, [options?.swipeIntervalMs, dispatchSweep]);
}
