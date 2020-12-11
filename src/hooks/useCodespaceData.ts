import { useQuery } from "@apollo/client";
import { CODESPACES_QUERY } from "api/graphql";
import { useMemo } from "react";

type Codespace = {
  id: string;
};

export default function useCodespaceData() {
  const { data: codespaceData } = useQuery(CODESPACES_QUERY);

  return useMemo(() => {
    return codespaceData?.codespaces.map((c: Codespace) => c.id).sort() || [];
  }, [codespaceData?.codespaces]);
}
