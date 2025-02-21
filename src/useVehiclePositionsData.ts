import { FormattedExecutionResult } from "graphql-ws";
import { Data, Filter, VehicleUpdate } from "./types.ts";
import { useEffect, useRef, useState } from "react";
import { CacheMap } from "./CacheMap.ts";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

const subscriptionQuery = `
  subscription($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!, $codespaceId: String, $operatorRef: String) {
    vehicles (boundingBox: {minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon}, codespaceId: $codespaceId, operatorRef: $operatorRef) {
      vehicleId
      codespace {
        codespaceId
      }
      operator {
        operatorRef
      }
      lastUpdated
      mode
      delay
      line {
        lineRef
        lineName
        publicCode
      }
      location {
        latitude
        longitude
      }
    }
  }
`;

const filterVehicles = (filter: Filter | null, vehicles: VehicleUpdate[]) => {
  // If no filter, return all vehicles
  if (!filter) {
    return vehicles;
  }

  return vehicles.filter((vehicle) => {
    const inBoundingBox =
      vehicle.location.latitude > filter.boundingBox[0][1] &&
      vehicle.location.latitude < filter.boundingBox[1][1] &&
      vehicle.location.longitude > filter.boundingBox[0][0] &&
      vehicle.location.longitude < filter.boundingBox[1][0];

    const inCodespace =
      // If filter.codespaceId is falsy (e.g. undefined/null), skip codespace filtering
      !filter.codespaceId ||
      vehicle.codespace.codespaceId === filter.codespaceId;

    const inOperatorRef =
      // If filter.operatorRef is falsy (e.g. undefined/null), skip operatorRef filtering
      !filter.operatorRef ||
      vehicle.operator.operatorRef === filter.operatorRef;

    return inOperatorRef && inBoundingBox && inCodespace;
  });
};

export const useVehiclePositionsData = (filter: Filter | null) => {
  const map = useRef<CacheMap<string, VehicleUpdate>>(
    new CacheMap({ expirationInMs: 60_000 }),
  );
  const [data, setData] = useState<VehicleUpdate[]>(
    Array.from(map.current.values()),
  );
  const subscription =
    useRef<AsyncIterableIterator<FormattedExecutionResult<Data, unknown>>>(
      null,
    );

  const subscriptionClient = useSubscriptionClient();
  useEffect(() => {
    if (subscription.current?.return) {
      subscription.current.return();
    }

    subscription.current = subscriptionClient.iterate<Data>({
      query: subscriptionQuery,
      variables: {
        minLon: filter?.boundingBox[0][0],
        minLat: filter?.boundingBox[0][1],
        maxLon: filter?.boundingBox[1][0],
        maxLat: filter?.boundingBox[1][1],
        ...(filter?.codespaceId && { codespaceId: filter.codespaceId }),
        ...(filter?.operatorRef && { operatorRef: filter.operatorRef }),
      },
    });
    const subscribe = async () => {
      for await (const event of subscription.current!) {
        event?.data?.vehicles.forEach((vehicle) => {
          if (
            vehicle.location &&
            vehicle.location.latitude &&
            vehicle.location.longitude
          ) {
            map.current.set(vehicle.vehicleId, vehicle);
          }
        });
        setData(filterVehicles(filter, Array.from(map.current.values())));
      }
    };
    if (filter) {
      subscribe();
    }
  }, [filter, subscriptionClient]);
  return data;
};
