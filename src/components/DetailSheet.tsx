import { Box } from "@mui/material";
import { ReactNode, useRef, useState } from "react";
import {
  DetailLayout,
  TAP_SLOP_PX,
  nearestSnap,
  nextSnap,
  sheetHeight,
} from "../domain/bottomSheet.ts";
import { useViewportHeight } from "../hooks/useViewportHeight.ts";
import { DETAIL_PANEL_SX, detailSheetSx } from "./detailDrawer.ts";
import { FloatingCard } from "./FloatingCard.tsx";

type DetailSheetProps = {
  layout: DetailLayout;
  "aria-label": string;
  children: ReactNode;
};

const SNAP_NAMES = {
  peek: "collapsed",
  half: "half open",
  full: "fully open",
} as const;

/**
 * The surface both detail panels sit on: the left-hand card on a wide screen,
 * a bottom sheet on a phone. The sheet has a handle that is tapped to open a
 * step further or dragged to any height, landing on the nearest snap.
 */
export function DetailSheet({
  layout,
  "aria-label": ariaLabel,
  children,
}: DetailSheetProps) {
  const viewportHeight = useViewportHeight();
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  if (layout.kind === "card") {
    return (
      <FloatingCard role="region" aria-label={ariaLabel} sx={DETAIL_PANEL_SX}>
        {children}
      </FloatingCard>
    );
  }

  const { snap, maxSnap, setSnap } = layout;
  const restingHeight = sheetHeight(snap, viewportHeight);
  const maxHeight = sheetHeight(maxSnap, viewportHeight);
  const minHeight = sheetHeight("peek", viewportHeight);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: restingHeight };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const moved = drag.current.startY - event.clientY;
    if (dragHeight === null && Math.abs(moved) < TAP_SLOP_PX) return;
    setDragHeight(
      Math.min(
        maxHeight,
        Math.max(minHeight, drag.current.startHeight + moved),
      ),
    );
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragHeight === null) {
      setSnap(nextSnap(snap, maxSnap));
    } else {
      setSnap(nearestSnap(dragHeight, viewportHeight, maxSnap));
      setDragHeight(null);
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragHeight(null);
  };

  return (
    <FloatingCard
      role="region"
      aria-label={ariaLabel}
      sx={[
        detailSheetSx(dragHeight ?? restingHeight),
        { transition: dragHeight === null ? "height 200ms ease-out" : "none" },
      ]}
    >
      <Box
        component="button"
        type="button"
        aria-label={`Resize panel (${SNAP_NAMES[snap]})`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSnap(nextSnap(snap, maxSnap));
          }
        }}
        sx={{
          flex: "none",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 20,
          marginX: -2,
          padding: 0,
          border: 0,
          background: "none",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: "divider",
          }}
        />
      </Box>
      {children}
    </FloatingCard>
  );
}
