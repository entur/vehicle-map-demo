import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";

const query = gql`
  {
    codespaces {
      codespaceId
    }
  }
`;

export function useCodespaces() {
  const [codespaces, setCodespaces] = useState<string[]>([]);
  useEffect(() => {
    const fetchCodespaces = async () => {
      const response: any = await request(
        "https://api.entur.io/realtime/v2/vehicles/graphql",
        query,
      );
      setCodespaces(
        response.codespaces.map(
          (codespace: { codespaceId: String }) => codespace.codespaceId,
        ),
      );
    };
    fetchCodespaces();
  }, []);

  return codespaces;
}
