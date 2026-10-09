import React, { useContext } from "react";

export interface Config {
  "vehicle-positions-graphql-endpoint": string;
  "vehicle-positions-subscriptions-endpoint": string;
  "vehicle-positions-et-client-name": string;
  /** entur/baat-token-proxy's `/token`, for Norge i bilder aerial tiles. */
  "nib-token-endpoint": string;
}

export const ConfigContext = React.createContext<Config>({
  "vehicle-positions-graphql-endpoint": "",
  "vehicle-positions-subscriptions-endpoint": "",
  "vehicle-positions-et-client-name": "",
  "nib-token-endpoint": "",
});

export const useConfig = () => {
  return useContext(ConfigContext);
};
