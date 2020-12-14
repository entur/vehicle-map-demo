import { useLazyQuery } from "@apollo/client";
import { OPERATORS_QUERY } from "api/graphql";
import { Operator } from "model/operator";
import { useEffect, useMemo } from "react";

export default function useOperatorRefs(codespaceId?: string) {
  const [fetchOperators, { data: operatorsData }] = useLazyQuery(
    OPERATORS_QUERY
  );

  useEffect(() => {
    if (codespaceId) {
      fetchOperators({
        variables: { codespaceId },
      });
    }
  }, [codespaceId, fetchOperators]);

  return useMemo(() => {
    return (
      operatorsData?.operators.map((o: Operator) => o.operatorRef).sort() || []
    );
  }, [operatorsData?.operators]);
}
