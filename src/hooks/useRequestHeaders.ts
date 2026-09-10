import { useMemo } from "react";
import { useConfig } from "../config/ConfigContext.ts";

export function useRequestHeaders() {
  const config = useConfig();

  // Stabilised so consumers that put this in an effect dependency array don't
  // re-run on every render — config itself is set once at bootstrap and does
  // not change identity for the app's lifetime.
  return useMemo(
    () => ({
      "Et-Client-Name": config["vehicle-positions-et-client-name"],
    }),
    [config],
  );
}
