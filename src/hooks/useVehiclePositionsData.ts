import { FormattedExecutionResult } from "graphql-ws";
import { Data, Filter, MapViewOptions, VehicleUpdate } from "../types.ts";
import { useEffect, useRef, useState } from "react";
import { CacheMap } from "../utils/CacheMap.ts";
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

const filterVehicles = (filter: Filter | null, vehicles: VehicleData[]) => {
  // If no filter, return all vehicles
  if (!filter) {
    return vehicles;
  }

  return vehicles.filter((vehicle) => {
    const inBoundingBox =
      vehicle.vehicleUpdate.location.latitude > filter.boundingBox[0][1] &&
      vehicle.vehicleUpdate.location.latitude < filter.boundingBox[1][1] &&
      vehicle.vehicleUpdate.location.longitude > filter.boundingBox[0][0] &&
      vehicle.vehicleUpdate.location.longitude < filter.boundingBox[1][0];

    const inCodespace =
      // If filter.codespaceId is falsy (e.g. undefined/null), skip codespace filtering
      !filter.codespaceId ||
      vehicle.vehicleUpdate.codespace.codespaceId === filter.codespaceId;

    const inOperatorRef =
      // If filter.operatorRef is falsy (e.g. undefined/null), skip operatorRef filtering
      !filter.operatorRef ||
      vehicle.vehicleUpdate.operator.operatorRef === filter.operatorRef;

    return inOperatorRef && inBoundingBox && inCodespace;
  });
};

export type VehicleData = {
  vehicleId: string;
  vehicleUpdate: VehicleUpdate;
  trace: number[][];
};

export const useVehiclePositionsData = (
  filter: Filter | null,
  mapViewOptions: MapViewOptions,
) => {
  const map = useRef<CacheMap<string, VehicleData>>(
    new CacheMap({ expirationInMs: 60_000 }),
  );
  const [data, setData] = useState<VehicleData[]>(
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
            let trace = map.current.get(vehicle.vehicleId)?.trace;

            if (mapViewOptions.showVehicleTraces) {
              if (!trace) {
                trace = [];
              }

              trace.push([
                vehicle.location.longitude,
                vehicle.location.latitude,
              ]);
            } else {
              trace = [];
            }

            map.current.set(vehicle.vehicleId, {
              vehicleId: vehicle.vehicleId,
              vehicleUpdate: vehicle,
              trace,
            });
          }
        });
        setData(filterVehicles(filter, Array.from(map.current.values())));
      }
    };
    if (filter) {
      subscribe();
    }
  }, [filter, subscriptionClient, mapViewOptions]);
  return data;
};
