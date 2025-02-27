import { useConfig } from "../config/ConfigContext.ts";

export function useRequestHeaders() {
  const config = useConfig();

  return {
    "Et-Client-Name": config["vehicle-positions-et-client-name"],
  };
}
