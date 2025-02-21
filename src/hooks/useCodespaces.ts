import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";
import { useConfig } from "../config/ConfigContext.ts";

const query = gql`
  {
    codespaces {
      codespaceId
    }
  }
`;

export function useCodespaces() {
  const [codespaces, setCodespaces] = useState<string[]>([]);
  const config = useConfig();
  useEffect(() => {
    const fetchCodespaces = async () => {
      const response: any = await request(
        config["vehicle-positions-graphql-endpoint"],
        query,
      );
      setCodespaces(
        response.codespaces.map(
          (codespace: { codespaceId: string }) => codespace.codespaceId,
        ),
      );
    };
    fetchCodespaces();
  }, [config]);

  return codespaces;
}
