import {createClient, FormattedExecutionResult} from "graphql-ws";
import {Data, Filter, VehicleUpdate} from "./types.ts";
import {useEffect, useRef, useState} from "react";

const client = createClient({
  url: 'wss://api.entur.io/realtime/v2/vehicles/subscriptions',
});

const subscriptionQuery = `
  subscription($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!) {
    vehicles (boundingBox: {minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon}) {
      vehicleId
      line {lineRef}
      lastUpdated
      location {
        latitude
        longitude
      }
    }
  }
`;

export const useVehiclePositionsData = (filter : Filter | null) => {
  const [data, setData] = useState<VehicleUpdate[]>([]);
  const map = useRef<Record<string, VehicleUpdate>>({});
  const subscription = useRef<AsyncIterableIterator<FormattedExecutionResult<Data, unknown>>>(null);
  useEffect(() => {
    if (subscription.current !== null) {
      // @ts-ignore
      subscription.current?.return();
    }

    subscription.current = client.iterate<Data>({
      query: subscriptionQuery,
      variables: {
        minLon: filter?.boundingBox[0][0],
        minLat: filter?.boundingBox[0][1],
        maxLon: filter?.boundingBox[1][0],
        maxLat: filter?.boundingBox[1][1],
      }
    });
    const subscribe = async () => {
      for await (const event of subscription.current!) {
        // @ts-ignore
        for (const v of event.data.vehicles) {
          if (v.location && v.location.latitude && v.location.longitude) {
            map.current[v.vehicleId] = v;
          }
        }
        setData(Object.values(map.current));
      }
    }
    if (filter) {
      subscribe();
    }
  }, [filter]);
  return data;
}
