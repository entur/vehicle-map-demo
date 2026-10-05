import { useCallback, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { VehicleUpdateComplete } from "../types.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { graphqlRequest } from "../utils/graphqlRequest.ts";

const query = `
  query ($codespaceId: String, $operatorRef: String) {
    vehicles(
      codespaceId: $codespaceId
      operatorRef: $operatorRef
      includeInvalidLocations: true
    ) {
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
      const response = await graphqlRequest<{
        vehicles: VehicleUpdateComplete[];
      }>({
        url: config["vehicle-positions-graphql-endpoint"],
        query,
        variables: { codespaceId, operatorRef },
        headers: requestHeaders,
      });
      setData(response.vehicles);
      setLoading(false);
      return response;
    },
    [config, requestHeaders],
  );

  return { data, loading, fetchSnapshot };
}
