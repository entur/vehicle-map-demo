import { useLazyQuery } from "@apollo/client";
import { LINES_QUERY } from "api/graphql";
import { useEffect, useMemo } from "react";

type Line = {
  lineRef: string;
  lineName: string;
};

export default function useLinesData(codespaceId?: string) {
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
