import { useId } from "react";
import {
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  QUALITY_CAPTIONS,
  QUALITY_LABELS,
  QUALITY_SETTINGS,
  RENDER_QUALITIES,
  RenderQuality,
  pixelRatioFor,
} from "../domain/renderQuality.ts";

/**
 * Medium changes the picture only on a screen with more than Full HD's
 * pixels; on one at or below it, all that changes is the label fade, which
 * cannot be seen. Said so, or picking Medium looks like it did nothing.
 * The window stands in for the map, which fills it.
 */
function mediumOnlyStopsFading(): boolean {
  return (
    pixelRatioFor(
      QUALITY_SETTINGS.medium.maxPixels,
      window.devicePixelRatio,
      window.innerWidth,
      window.innerHeight,
    ) === null
  );
}

/**
 * Low, Medium and High, in the Layers and Kiosk panels. Both write the one
 * App state, which `?quality=` mirrors, so a copied kiosk link carries it.
 * Set apart by a divider and titled for the screen, since it is neither a
 * map layer nor part of a kiosk run. `note` is the panel's own last word on
 * where the setting goes.
 */
export function RenderQualityControl({
  quality,
  setQuality,
  note,
}: {
  quality: RenderQuality;
  setQuality: (quality: RenderQuality) => void;
  note: string;
}) {
  const labelId = useId();
  const captionId = useId();
  return (
    <>
      <Divider sx={{ mt: 2 }} />
      <Typography variant="subtitle2" id={labelId} sx={{ mt: 2 }}>
        Render quality for this screen
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={quality}
        onChange={(_, next: RenderQuality | null) => next && setQuality(next)}
        aria-labelledby={labelId}
        aria-describedby={captionId}
        sx={{ mt: 1 }}
      >
        {RENDER_QUALITIES.map((level) => (
          <ToggleButton key={level} value={level}>
            {QUALITY_LABELS[level]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography
        id={captionId}
        variant="caption"
        component="p"
        sx={{ mt: 0.5, color: "text.secondary" }}
      >
        {QUALITY_CAPTIONS[quality]}
        {quality === "medium" &&
          mediumOnlyStopsFading() &&
          " On this screen only the label fading changes."}{" "}
        {note}
      </Typography>
    </>
  );
}
