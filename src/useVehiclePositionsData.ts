import { FormattedExecutionResult } from "graphql-ws";
import { Data, Filter, VehicleUpdate } from "./types.ts";
import { useEffect, useRef, useState } from "react";
import { CacheMap } from "./CacheMap.ts";
import { subscriptionClient } from "./client.ts";

const subscriptionQuery = `
  subscription($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!) {
    vehicles (boundingBox: {minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon}) {
      vehicleId
      line {lineRef}
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
  if (filter !== null) {
    return vehicles.filter((vehicle) => {
      return (
        vehicle.location.latitude > filter.boundingBox[0][1] &&
        vehicle.location.latitude < filter.boundingBox[1][1] &&
        vehicle.location.longitude > filter.boundingBox[0][0] &&
        vehicle.location.longitude < filter.boundingBox[1][0]
      );
    });
  } else {
    return vehicles;
  }
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
  }, [filter]);
  return data;
};
