import { createClient } from "graphql-ws";
import { useConfig } from "../config/ConfigContext.ts";
import { useState } from "react";
import { useRequestHeaders } from "./useRequestHeaders.ts";

export const useSubscriptionClient = () => {
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  const [client] = useState(() =>
    createClient({
      url: config["vehicle-positions-subscriptions-endpoint"],
      connectionParams: {
        headers: requestHeaders,
      },
    }),
  );
  return client;
};
