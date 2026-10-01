import { Paper, PaperProps } from "@mui/material";

/**
 * A surface floating over the map: the shared card radius and shadow (both in
 * index.css, which MapLibre's controls and the chase HUD read too), and pointer
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
          borderRadius: "var(--card-radius)",
          boxShadow: "var(--floating-shadow)",
          pointerEvents: "auto",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
