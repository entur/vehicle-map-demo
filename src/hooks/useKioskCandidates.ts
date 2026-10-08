import { useEffect, useMemo, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { graphqlRequest } from "../utils/graphqlRequest.ts";
import { Filter } from "../types.ts";
import {
  CandidatePool,
  KioskSnapshot,
  KioskVehicle,
  SNAPSHOT_INTERVAL_MS,
  SnapshotVehicle,
  maxDataAgeSecondsOf,
  toKioskVehicle,
} from "../domain/kioskCandidates.ts";

// Only what choosing a vehicle and captioning it need. The full snapshot
// query (useVehiclePositionsSnapshotFetcher) selects every field and is
// several MB unfiltered, which a wall screen would fetch every minute.
const query = `
  query ($codespaceId: String, $operatorRef: String) {
    vehicles(codespaceId: $codespaceId, operatorRef: $operatorRef) {
      vehicleId
      serviceJourney {
        id
        date
      }
      codespace {
        codespaceId
      }
      mode
      line {
        publicCode
      }
      destinationName
      lastUpdated
      monitored
      location {
        latitude
        longitude
      }
    }
  }
`;

type Snapshots = {
  current: KioskSnapshot | null;
  previous: KioskSnapshot | null;
};

const NO_SNAPSHOTS: Snapshots = { current: null, previous: null };

/**
 * The vehicles the kiosk may pick from: the filter's codespace and operator,
 * anywhere, refetched every SNAPSHOT_INTERVAL_MS. The previous snapshot is
 * kept so a vehicle can be compared with itself. Not the live subscription,
 * whose box is only the few kilometres around the chased vehicle.
 */
export function useKioskCandidates(
  filter: Partial<Filter>,
  enabled: boolean,
): CandidatePool {
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  const [snapshots, setSnapshots] = useState<Snapshots>(NO_SNAPSHOTS);
  const { codespaceId, operatorRef } = filter;
  // A run picks only from snapshots fetched for it. Held across a stop, a
  // start or a filter change, the last run's `current` — possibly hours old,
  // for another codespace or operator — would look new to the first tick
  // (`waiting` starts at `since: -Infinity`) and be picked from, and its
  // `previous` would skew the "moved" test. Dropped during render, so the
  // new run's first tick already sees nothing.
  const runKey = enabled
    ? JSON.stringify([codespaceId ?? null, operatorRef ?? null])
    : null;
  const [heldFor, setHeldFor] = useState(runKey);
  if (runKey !== heldFor) {
    setHeldFor(runKey);
    setSnapshots(NO_SNAPSHOTS);
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const fetchSnapshot = async () => {
      try {
        const response = await graphqlRequest<{ vehicles: SnapshotVehicle[] }>({
          url: config["vehicle-positions-graphql-endpoint"],
          query,
          variables: { codespaceId, operatorRef },
          headers: requestHeaders,
          signal: controller.signal,
        });
        // The effect was torn down — the run ended or its filter changed —
        // after this response arrived but before it was handled. It belongs
        // to a run that no longer exists.
        if (controller.signal.aborted) return;
        const snapshot: KioskSnapshot = {
          fetchedAt: Date.now(),
          vehicles: response.vehicles
            .map(toKioskVehicle)
            .filter((v): v is KioskVehicle => v !== null),
        };
        setSnapshots((prev) => ({ current: snapshot, previous: prev.current }));
      } catch (error) {
        // Keep the snapshots already held; the next poll tries again. Logged,
        // so a broken query is not hidden behind an endless "Waiting for
        // vehicles…". Teardown mid-request aborts, which is not a failure.
        if (!controller.signal.aborted) {
          console.warn(
            "Kiosk: vehicle snapshot failed; keeping the previous one",
            error,
          );
        }
      }
    };
    fetchSnapshot();
    const id = window.setInterval(fetchSnapshot, SNAPSHOT_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [enabled, config, requestHeaders, codespaceId, operatorRef]);

  return useMemo(
    () => ({ ...snapshots, maxDataAgeSeconds: maxDataAgeSecondsOf(filter) }),
    [snapshots, filter],
  );
}
