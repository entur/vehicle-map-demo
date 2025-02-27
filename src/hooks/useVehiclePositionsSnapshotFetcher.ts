import { useCallback, useState } from "react";
import { gql, request } from "graphql-request";
import { useConfig } from "../config/ConfigContext.ts";
import { VehicleUpdateComplete } from "../types.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";

const query = gql`
  query ($codespaceId: String, $operatorRef: String) {
    vehicles(codespaceId: $codespaceId, operatorRef: $operatorRef) {
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

export function useVehiclePositionsSnapshotFetcher() {
  const [data, setData] = useState<VehicleUpdateComplete[]>([]);
  const [loading, setLoading] = useState(false);
  const config = useConfig();
  const requestHeaders = useRequestHeaders();

  const fetchSnapshot = useCallback(
    async ({
      codespaceId,
      operatorRef,
    }: {
      codespaceId?: string;
      operatorRef?: string;
    }) => {
      setLoading(true);
      const response: any = await request(
        config["vehicle-positions-graphql-endpoint"],
        query,
        { codespaceId, operatorRef },
        requestHeaders,
      );
      setData(response.vehicles);
      setLoading(false);
      return response;
    },
    [config],
  );

  return { data, loading, fetchSnapshot };
}
