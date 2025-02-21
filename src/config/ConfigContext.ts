import React, { useContext } from "react";

export interface Config {
  "vehicle-positions-graphql-endpoint": string;
  "vehicle-positions-subscriptions-endpoint": string;
}

export const ConfigContext = React.createContext<Config>({
  "vehicle-positions-graphql-endpoint": "",
  "vehicle-positions-subscriptions-endpoint": "",
});

export const useConfig = () => {
  return useContext(ConfigContext);
};
