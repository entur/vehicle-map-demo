import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";
import { useConfig } from "./config/ConfigContext.ts";

const query = gql`
  query ($codespaceId: String!) {
    operators(codespaceId: $codespaceId) {
      operatorRef
    }
  }
`;

export function useOperators(codespaceId: string) {
  const [operators, setOperators] = useState<string[]>([]);
  const config = useConfig();

  useEffect(() => {
    const fetchOperators = async () => {
      const response: any = await request(
        config["vehicle-positions-graphql-endpoint"],
        query,
        { codespaceId },
      );
      setOperators(
        response.operators.map(
          (operator: { operatorRef: any }) => operator.operatorRef,
        ),
      );
    };
    fetchOperators();
  }, [codespaceId, config]);

  return operators;
}
