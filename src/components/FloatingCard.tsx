import { Paper, PaperProps } from "@mui/material";
import { CARD_RADIUS } from "./theme.ts";

/**
 * A surface floating over the map: card radius, the shared shadow, and pointer
 * events back on — floating clusters switch them off so the map stays
 * draggable between cards. Elevation 0 because MUI lightens elevated Paper in
 * dark mode, which would make each card a slightly different grey.
 */
export function FloatingCard({ sx, ...props }: PaperProps) {
  return (
    <Paper
      elevation={0}
      {...props}
      sx={[
        {
          borderRadius: `${CARD_RADIUS}px`,
          boxShadow: "var(--floating-shadow)",
          pointerEvents: "auto",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
