import { useEffect, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";
import { Operator } from "../types.ts";
import { graphqlRequest } from "../utils/graphqlRequest.ts";

const query = `
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
      const response = await graphqlRequest<{ operators: Operator[] }>({
        url: config["vehicle-positions-graphql-endpoint"],
        query,
        variables: { codespaceId },
        headers: requestHeaders,
      });
      setOperators(response.operators);
    };
    fetchOperators();
  }, [codespaceId, config, requestHeaders]);

  return operators;
}
