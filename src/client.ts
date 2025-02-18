import { createClient } from "graphql-ws";

export const subscriptionClient = createClient({
  url: "wss://api.entur.io/realtime/v2/vehicles/subscriptions",
});
