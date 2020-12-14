import { useLazyQuery } from "@apollo/client";
import { LINES_QUERY } from "api/graphql";
import { Line } from "model/line";
import { useEffect, useMemo } from "react";

export default function useLineRefs(codespaceId?: string) {
  const [fetchLines, { data: linesData }] = useLazyQuery(LINES_QUERY);

  useEffect(() => {
    if (codespaceId) {
      fetchLines({
        variables: { codespaceId },
      });
    }
  }, [codespaceId, fetchLines]);

  return useMemo(() => {
    return (
      linesData?.lines
        .map((l: Line) => l.lineRef)
        .filter((v: string, i: number, a: string) => a.indexOf(v) === i)
        .sort() || []
    );
  }, [linesData?.lines]);
}
