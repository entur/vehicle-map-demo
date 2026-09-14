import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";
import { useConfig } from "../config/ConfigContext.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { CountEntry, countBy } from "../domain/situationStats.ts";

// Deliberately not the API's `codespaces` root. That now lists every codespace
// in the NeTEx planned data — measured on dev, 61 codespaces against 21 in the
// vehicle feed — and it still misses SKA, VAR and VOT, which publish about 30%
// of the vehicles. The only list that matches the feed is a tally of the feed.
const query = gql`
  {
    vehicles {
      codespace {
        codespaceId
      }
    }
  }
`;

type Response = {
  vehicles: { codespace: { codespaceId: string } | null }[];
};

/**
 * The codespaces currently publishing vehicles, each with its vehicle count,
 * from one unfiltered snapshot fetched on mount. Unscoped by bbox, unlike the
 * live subscription, so the list does not change as the map pans.
 */
export function useVehicleCodespaceCounts() {
  const [counts, setCounts] = useState<CountEntry[]>([]);
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  useEffect(() => {
    const fetchCounts = async () => {
      const response = await request<Response>(
        config["vehicle-positions-graphql-endpoint"],
        query,
        {},
        requestHeaders,
      );
      setCounts(
        countBy(
          response.vehicles,
          (vehicle) => vehicle.codespace?.codespaceId ?? null,
        ),
      );
    };
    fetchCounts();
  }, [config, requestHeaders]);

  return counts;
}
