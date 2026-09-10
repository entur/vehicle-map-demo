import { createClient } from "graphql-ws";
import { useConfig } from "../config/ConfigContext.ts";
import { useState } from "react";
import { useRequestHeaders } from "./useRequestHeaders.ts";

/**
 * Interval between client-sent graphql-ws pings. The load balancer in front of
 * the API drops sockets it considers idle, and the situations feed can go
 * quiet for long enough to look idle. Every drop makes graphql-ws re-subscribe,
 * and every re-subscribe makes the server replay its full opening snapshot —
 * the API has no resume cursor. Pings count as traffic and keep the socket up.
 */
const KEEP_ALIVE_MS = 30_000;

export const useSubscriptionClient = () => {
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  const [client] = useState(() =>
    createClient({
      url: config["vehicle-positions-subscriptions-endpoint"],
      connectionParams: {
        headers: requestHeaders,
      },
      keepAlive: KEEP_ALIVE_MS,
    }),
  );
  return client;
};
