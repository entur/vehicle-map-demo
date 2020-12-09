import { useQuery, useSubscription } from '@apollo/client';
import { VEHICLES_QUERY, VEHICLE_UPDATES_SUBSCRIPTION } from 'api/graphql';
import { useEffect } from "react";
import useVehicleReducer, { ActionType } from './useVehicleReducer';

export default function useVehicleData() {
  const [vehicles, dispatch] = useVehicleReducer();

  const {
    data: hydrationData,
  } = useQuery(VEHICLES_QUERY);

  const {
    data: subscriptionData,
  } = useSubscription(VEHICLE_UPDATES_SUBSCRIPTION);

  useEffect(() => {
    if (hydrationData && hydrationData.vehicles) {
      dispatch({ type: ActionType.HYDRATE, payload: hydrationData.vehicles });
    }
  }, [hydrationData, dispatch]);

  useEffect(() => {
    if (subscriptionData && subscriptionData.vehicleUpdates) {
      dispatch({ type: ActionType.UPDATE, payload: [subscriptionData.vehicleUpdates] });
    }
  }, [subscriptionData, dispatch]);

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: ActionType.EXPIRE });
    }, 5000);

    return () => {
      clearInterval(timer);
    }
  })

  return vehicles;
}
