import { FetchResult, useApolloClient } from "@apollo/client";
import { VEHICLES_QUERY, VEHICLE_UPDATES_SUBSCRIPTION } from "api/graphql";
import { Options } from "model/options";
import { SubscriptionFilter } from "model/subscriptionFilter";
import { Vehicle } from "model/vehicle";
import { useEffect } from "react";
import useVehicleReducer, { ActionType } from "./useVehicleReducer";

const DEFAULT_FETCH_POLICY = "no-cache";
const DEFAULT_UPDATE_INTERVAL_IN_MS = 250;
const DEFAULT_SWIPE_INTERVAL_IN_MS = 1000;

/**
 * Hook to query and subscribe to remote vehicle data
 */
export default function useVehicleData(
  subscriptionFilter?: SubscriptionFilter,
  options?: Options
) {
  const [state, dispatch] = useVehicleReducer();
  const client = useApolloClient();

  /**
   * Query once to hydrate vehicle data
   */
  useEffect(() => {
    async function hydrate() {
      const { data: hydrationData } = await client.query({
        query: VEHICLES_QUERY,
        fetchPolicy: DEFAULT_FETCH_POLICY,
        variables: subscriptionFilter,
      });
      if (hydrationData && hydrationData.vehicles) {
        dispatch({ type: ActionType.HYDRATE, payload: hydrationData.vehicles });
      }
    }
    hydrate();
  }, [client, dispatch, subscriptionFilter]);

  /**
   * Set up subscription to receive updates on vehicles
   */
  useEffect(() => {
    /**
     * To avoid triggering re-renders too frequently, buffer subscription updates
     * and set a timer to dispatch the update on a given interval.
     */
    const buffer: Vehicle[] = [];

    client
      .subscribe({
        query: VEHICLE_UPDATES_SUBSCRIPTION,
        fetchPolicy: DEFAULT_FETCH_POLICY,
        variables: subscriptionFilter,
      })
      .subscribe((fetchResult: FetchResult) => {
        buffer.push(fetchResult?.data?.vehicleUpdates as Vehicle);
      });

    const timer = setInterval(() => {
      if (buffer.length > 0) {
        dispatch({
          type: ActionType.UPDATE,
          payload: buffer.splice(0, buffer.length),
        });
      }
    }, options?.updateIntervalMs || DEFAULT_UPDATE_INTERVAL_IN_MS);

    return () => {
      clearInterval(timer);
    };
  }, [client, dispatch, options?.updateIntervalMs, subscriptionFilter]);

  /**
   * Set a timer to swipe through vehicles to update their status
   */
  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: ActionType.EXPIRE });
    }, options?.swipeIntervalMs || DEFAULT_SWIPE_INTERVAL_IN_MS);

    return () => {
      clearInterval(timer);
    };
  });

  return state;
}
