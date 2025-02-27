import React, { useContext } from "react";

export interface Config {
  "vehicle-positions-graphql-endpoint": string;
  "vehicle-positions-subscriptions-endpoint": string;
  "vehicle-positions-et-client-name": string;
}

export const ConfigContext = React.createContext<Config>({
  "vehicle-positions-graphql-endpoint": "",
  "vehicle-positions-subscriptions-endpoint": "",
  "vehicle-positions-et-client-name": "",
});

export const useConfig = () => {
  return useContext(ConfigContext);
};
