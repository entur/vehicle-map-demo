import { useEffect, useState } from "react";
import { gql, request } from "graphql-request";

const query = gql`
  {
    operators {
      operatorRef
    }
  }
`;

export function useOperators() {
  const [operators, setOperators] = useState<string[]>([]);
  useEffect(() => {
    const fetchOperators = async () => {
      const response: any = await request(
        "https://api.entur.io/realtime/v2/vehicles/graphql",
        query,
      );
      setOperators(
        response.data.operators.map(
          (operator: { operatorRef: any }) => operator.operatorRef,
        ),
      );
    };
    fetchOperators();
  }, []);

  return operators;
}
