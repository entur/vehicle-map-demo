import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";
import { useConfig } from "../config/ConfigContext.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { Operator } from "../types.ts";

const query = gql`
  query ($codespaceId: String!) {
    operators(codespaceId: $codespaceId) {
      operatorRef
      name
    }
  }
`;

export function useOperators(codespaceId: string) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const config = useConfig();
  const requestHeaders = useRequestHeaders();
  useEffect(() => {
    const fetchOperators = async () => {
      const response = await request<{ operators: Operator[] }>(
        config["vehicle-positions-graphql-endpoint"],
        query,
        { codespaceId },
        requestHeaders,
      );
      setOperators(response.operators);
    };
    fetchOperators();
  }, [codespaceId, config, requestHeaders]);

  return operators;
}
