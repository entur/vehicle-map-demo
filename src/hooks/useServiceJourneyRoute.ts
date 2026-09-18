import { gql, request } from "graphql-request";
import { useEffect, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { RoutePolyline } from "../types.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";

const query = gql`
  query ($id: String!) {
    serviceJourney(id: $id) {
      pointsOnLink {
        points
        length
      }
    }
  }
`;

type Response = {
  serviceJourney: {
    pointsOnLink: {
      points: string | null;
      length: number | null;
    } | null;
  } | null;
};

export function useServiceJourneyRoute(
  serviceJourneyId: string | null,
): RoutePolyline | null {
  // Stored with the journey it was fetched for, so a changed id reads as no
  // route straight away instead of being cleared by the effect.
  const [fetched, setFetched] = useState<{
    serviceJourneyId: string;
    route: RoutePolyline | null;
  } | null>(null);
  const config = useConfig();
  const requestHeaders = useRequestHeaders();

  useEffect(() => {
    if (!serviceJourneyId) return;

    const controller = new AbortController();
    const setRoute = (route: RoutePolyline | null) =>
      setFetched({ serviceJourneyId, route });

    request<Response>({
      url: config["vehicle-positions-graphql-endpoint"],
      document: query,
      variables: { id: serviceJourneyId },
      requestHeaders,
      signal: controller.signal,
    })
      .then((response) => {
        const points = response.serviceJourney?.pointsOnLink?.points;
        if (!points) {
          setRoute(null);
          return;
        }
        setRoute({
          coordinates: decodePolyline(points),
          length: response.serviceJourney?.pointsOnLink?.length ?? null,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch service journey route", err);
        setRoute(null);
      });

    return () => controller.abort();
  }, [serviceJourneyId, config, requestHeaders]);

  return serviceJourneyId !== null &&
    fetched?.serviceJourneyId === serviceJourneyId
    ? fetched.route
    : null;
}
