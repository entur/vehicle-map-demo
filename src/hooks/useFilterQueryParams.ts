import { Filter } from "../types.ts";
import { useEffect, useRef } from "react";

function getQueryParams() {
  if (!window.location.search) return {};
  return window.location.search
    .slice(1)
    .split("&")
    .reduce<Record<string, string>>((acc, current) => {
      const [key, value] = current.split("=");
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function useFilterQueryParams(
  filter: Filter | null,
  setFilter: (filter: Filter) => void,
) {
  const loadState = useRef<{ loaded: boolean }>({
    loaded: false,
  });
  useEffect(() => {
    if (!loadState.current.loaded) {
      loadState.current.loaded = true;
      const queryParams = getQueryParams();
      setFilter({
        ...(filter || {}),
        ...queryParams,
      } as Filter);
    }
  }, [filter, setFilter]);

  useEffect(() => {
    if (filter !== null) {
      const queryParams = getQueryParams();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { boundingBox, ...rest } = filter as Filter;
      const updatedParams = {
        ...queryParams,
        ...rest,
      };

      const url = new URL(window.location.href);

      Object.entries(updatedParams).forEach(([key, value]) => {
        if (value !== undefined) {
          if (typeof value === "string") {
            url.searchParams.set(key, value);
          } else {
            url.searchParams.set(key, "" + value);
          }
        } else {
          url.searchParams.delete(key);
        }
      });
      window.history.replaceState({}, "", url.toString());
    }
  }, [filter]);
}
