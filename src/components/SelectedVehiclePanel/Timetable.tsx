import { Box } from "@mui/material";
import { useEffect, useRef } from "react";
import { Call } from "../../types.ts";
import { StopRow } from "./StopRow.tsx";

type TimetableProps = {
  calls: Call[];
  currentOrder: number | null;
};

export function Timetable({ calls, currentOrder }: TimetableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentRowRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledTripKey = useRef<string | null>(null);

  // Pick the row to scroll to: matching order if present, else first ESTIMATED.
  const indexForScroll = (() => {
    if (currentOrder !== null) {
      const idx = calls.findIndex((c) => c.order === currentOrder);
      if (idx !== -1) return idx;
    }
    return calls.findIndex((c) => c.callType === "ESTIMATED");
  })();

  // Use the first stop's order as a stable trip key (we only re-scroll when
  // the trip changes, not on every timetable frame).
  const tripKey = calls.length
    ? `${calls[0].order}-${calls[0].stopPoint.id}`
    : null;

  // Scrolls the list itself rather than calling scrollIntoView, which also
  // scrolls every scrollable ancestor: on a phone the sheet clips its
  // content, and would be scrolled out from under its own header.
  useEffect(() => {
    const container = containerRef.current;
    const row = currentRowRef.current;
    if (!container || !row) return;
    if (lastScrolledTripKey.current === tripKey) return;
    container.scrollTop =
      row.offsetTop - (container.clientHeight - row.offsetHeight) / 2;
    lastScrolledTripKey.current = tripKey;
  }, [tripKey]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflowY: "auto",
        paddingRight: 1,
        // So rows' offsetTop is measured from the list, not the page.
        position: "relative",
      }}
    >
      {calls.map((call, i) => {
        const isCurrent = currentOrder !== null && call.order === currentOrder;
        return (
          <Box
            key={`${call.order}-${call.stopPoint.id}`}
            ref={i === indexForScroll ? currentRowRef : null}
          >
            <StopRow call={call} isCurrent={isCurrent} />
          </Box>
        );
      })}
    </Box>
  );
}
