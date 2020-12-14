import { useQuery } from "@apollo/client";
import { CODESPACES_QUERY } from "api/graphql";
import { Codespace } from "model/codespace";
import { useMemo } from "react";

export default function useCodespaceIds() {
  const { data: codespaceData } = useQuery(CODESPACES_QUERY);

  return useMemo(() => {
    return (
      codespaceData?.codespaces.map((c: Codespace) => c.codespaceId).sort() ||
      []
    );
  }, [codespaceData?.codespaces]);
}
