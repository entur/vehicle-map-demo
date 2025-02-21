import { createClient } from "graphql-ws";
import { useConfig } from "./config/ConfigContext.ts";
import { useRef } from "react";

export const useSubscriptionClient = () => {
  const config = useConfig();
  const client = useRef(
    createClient({ url: config["vehicle-positions-subscriptions-endpoint"] }),
  );
  return client.current;
};
