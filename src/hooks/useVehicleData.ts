import { FetchResult, useApolloClient } from "@apollo/client";
import { VEHICLES_QUERY, VEHICLE_UPDATES_SUBSCRIPTION } from "api/graphql";
import { Options } from "model/options";
import { Filter } from "model/filter";
import { Vehicle } from "model/vehicle";
import { useEffect } from "react";
import useVehicleReducer, { ActionType } from "./useVehicleReducer";
import { SubscriptionOptions } from "model/subscriptionOptions";
import { LineLayerOptions } from "model/lineLayerOptions";

const DEFAULT_FETCH_POLICY = "no-cache";

/**
 * Hook to query and subscribe to remote vehicle data
 */
export default function useVehicleData(
  filter: Filter,
  subscriptionOptions: SubscriptionOptions,
  options: Options,
  lineLayerOptions: LineLayerOptions
) {
  const [state, dispatch] = useVehicleReducer(options, lineLayerOptions);
  const client = useApolloClient();

  /**
   * Query once to hydrate vehicle data
   */
  useEffect(() => {
    async function hydrate() {
      const { data: hydrationData } = await client.query({
        query: VEHICLES_QUERY,
        fetchPolicy: DEFAULT_FETCH_POLICY,
        variables: {
          ...filter,
          includePointsOnLink: lineLayerOptions.includePointsOnLink,
        },
      });
      if (hydrationData && hydrationData.vehicles) {
        dispatch({ type: ActionType.HYDRATE, payload: hydrationData.vehicles });
      }
    }
    hydrate();
  }, [
    client,
    dispatch,
    filter,
    lineLayerOptions.includePointsOnLink,
    options.hideServiceJourneysWithInvalidIds,
  ]);

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
            includePointsOnLink: false,
          },
        })
        .subscribe((fetchResult: FetchResult) => {
          if (fetchResult?.data?.vehicleUpdates.length > 0) {
            dispatch({
              type: ActionType.UPDATE,
              payload: fetchResult?.data?.vehicleUpdates as Vehicle[],
            });
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [
    client,
    dispatch,
    filter,
    subscriptionOptions,
    options.hideServiceJourneysWithInvalidIds,
  ]);

  return state;
}
