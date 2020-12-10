import { FetchResult, useApolloClient } from '@apollo/client';
import { VEHICLES_QUERY, VEHICLE_UPDATES_SUBSCRIPTION } from 'api/graphql';
import { Vehicle } from 'model/vehicle';
import { useEffect } from "react";
import useVehicleReducer, { ActionType } from './useVehicleReducer';

const DEFAULT_FETCH_POLICY = 'no-cache';
const DEFAULT_UPDATE_INTERVAL_IN_MS = 250;
const DEFAULT_SWIPE_INTERVAL_IN_MS = 1000;

export default function useVehicleData() {
  const [vehicles, dispatch] = useVehicleReducer();
  const client = useApolloClient();

  useEffect(() => {
    async function hydrate() {
      const { data: hydrationData } = await client.query({
        query: VEHICLES_QUERY,
        fetchPolicy: DEFAULT_FETCH_POLICY,
      });
      if (hydrationData && hydrationData.vehicles) {
        dispatch({ type: ActionType.HYDRATE, payload: hydrationData.vehicles });
      }
    }
    hydrate();
  }, [client, dispatch]);

  useEffect(() => {
    const buffer: Vehicle[] = [];
    client.subscribe({
      query: VEHICLE_UPDATES_SUBSCRIPTION,
      fetchPolicy: DEFAULT_FETCH_POLICY
    }).subscribe((fetchResult: FetchResult) => {
      buffer.push(fetchResult?.data?.vehicleUpdates as Vehicle);
    });

    const timer = setInterval(() => {
      dispatch({ type: ActionType.UPDATE, payload: buffer.splice(0, buffer.length) });
    }, DEFAULT_UPDATE_INTERVAL_IN_MS);

    return () => {
      clearInterval(timer);
    }
  }, [client, dispatch]);

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: ActionType.EXPIRE });
    }, DEFAULT_SWIPE_INTERVAL_IN_MS);

    return () => {
      clearInterval(timer);
    }
  })

  return vehicles;
}
