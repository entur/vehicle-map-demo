import { Client, createClient } from "graphql-ws";
import { Config } from "../config/ConfigContext.ts";

/**
 * Interval between client-sent graphql-ws pings. The load balancer in front of
 * the API drops sockets it considers idle, and the situations feed can go
 * quiet for long enough to look idle. Every drop makes graphql-ws re-subscribe,
 * and every re-subscribe makes the server replay its full opening snapshot —
 * the API has no resume cursor. Pings count as traffic and keep the socket up.
 */
const KEEP_ALIVE_MS = 30_000;

const clients = new Map<string, Client>();

/**
 * The one graphql-ws client, and so the one WebSocket, for an endpoint and
 * client name. Every subscription multiplexes over it. A client per component
 * instead opened a socket per mounted popup, panel and feed, and a component
 * that remounted — a popup closed and reopened — opened another.
 */
export function subscriptionClientFor(config: Config): Client {
  const url = config["vehicle-positions-subscriptions-endpoint"];
  const clientName = config["vehicle-positions-et-client-name"];
  const key = JSON.stringify([url, clientName]);
  let client = clients.get(key);
  if (!client) {
    client = createClient({
      url,
      connectionParams: {
        headers: { "Et-Client-Name": clientName },
      },
      keepAlive: KEEP_ALIVE_MS,
    });
    clients.set(key, client);
  }
  return client;
}
