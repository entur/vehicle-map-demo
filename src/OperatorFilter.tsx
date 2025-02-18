import { useOperators } from "./useOperators.ts";

export function OperatorFilter() {
  const operators = useOperators();

  console.log(operators);

  return null;
}
