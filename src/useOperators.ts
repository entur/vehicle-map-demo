import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";

const query = gql`
  query ($codespaceId: String!) {
    operators(codespaceId: $codespaceId) {
      operatorRef
    }
  }
`;

export function useOperators(codespaceId: string) {
  const [operators, setOperators] = useState<string[]>([]);

  useEffect(() => {
    const fetchOperators = async () => {
      const response: any = await request(
        "https://api.entur.io/realtime/v2/vehicles/graphql",
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
  }, [codespaceId]);

  return operators;
}
