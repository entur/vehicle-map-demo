import { Box, IconButton, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { SEVERITY_SEVERE } from "../domain/dataColours.ts";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Call, VehicleUpdate } from "../types.ts";
import { FloatingCard } from "./FloatingCard.tsx";
import { VehicleIconCanvas } from "./VehicleIconCanvas.tsx";
import { VEHICLE_ICON_URLS } from "./vehicleIconImages.ts";
import { SURFACE_INSET } from "./theme.ts";
import { vehicleIconName } from "../domain/vehicleIcons.ts";
import { labelColoursFor } from "../domain/vehiclePaint.ts";
import { KioskVehicle } from "../domain/kioskCandidates.ts";
import { upcomingCalls } from "../domain/kioskJourney.ts";
import {
  FixedViewState,
  fixedViewResumesInMs,
} from "../domain/kioskFixedView.ts";
import {
  KioskConfig,
  KioskState,
  formatCountdown,
  kioskView,
} from "../domain/kioskSchedule.ts";
import {
  delayBucket,
  delayColour,
  formatDelay,
} from "./SelectedVehiclePanel/delayThresholds.ts";
import {
  formatTime,
  resolveCallTimes,
} from "./SelectedVehiclePanel/callTimes.ts";

const CLOCK_MS = 1000;
/** Clear space kept between the band's top edge and the chased vehicle. */
const BAND_VEHICLE_GAP = 12;
const ICON_SIZE = 56;
/**
 * In place of the line code, which a third of the feed does not publish. The
 * kiosk picks such a vehicle only when nothing that publishes one matches.
 */
const NO_LINE_CODE = "No line published";
/**
 * The band's height, fixed so that what it shows never changes it: its height
 * is the map's bottom padding, and every padding change jumps the camera,
 * which cancels the chase's exit ease and the 2D ease running at a switch.
 * Fits the caption (overline, h4, h6) and the stop strip inside the card's
 * padding.
 */
const BAND_HEIGHT = 128;

type KioskOverlayProps = {
  state: KioskState;
  config: KioskConfig;
  /** The target's latest live report, once it is in the feed. */
  vehicle: VehicleUpdate | null;
  /** The target journey's calls, or null without its timetable. */
  calls: Call[] | null;
  narrow: boolean;
  /** px off the map's bottom edge, clear of the attribution (`sheetBottom`). */
  bottom: number;
  /** px of the map's bottom edge the band hides, 0 when it is gone. */
  onCoveredChange: (px: number) => void;
  /** Resume the kiosk now, from the paused pill. */
  onResume: () => void;
};

/**
 * What a wall screen shows: a band across the bottom with the chased
 * vehicle and its next stops, "Next: …" while flying to another, and a small
 * pill while a visitor has paused it. On a phone only the pill; the detail
 * sheet stays.
 */
export function KioskOverlay({
  state,
  config,
  vehicle,
  calls,
  narrow,
  bottom,
  onCoveredChange,
  onResume,
}: KioskOverlayProps) {
  const now = useNow(CLOCK_MS);
  const view = kioskView(state, now, config);

  if (view.kind === "paused") {
    return (
      <KioskPausedPill resumesInMs={view.resumesInMs} onResume={onResume} />
    );
  }
  if (narrow) {
    if (view.kind === "message") return <KioskPill>{view.text}</KioskPill>;
    if (view.kind === "travelling") {
      return (
        <KioskPill>
          Next: {view.target.lineCode || NO_LINE_CODE}{" "}
          {view.target.destinationName ?? ""}
        </KioskPill>
      );
    }
    return null;
  }
  return (
    <KioskBand
      bottom={bottom}
      onCoveredChange={onCoveredChange}
      progress={view.kind === "chasing" ? view.progress : null}
      pulsing={view.kind === "chasing" && view.waitingForStop}
    >
      {view.kind === "message" ? (
        <Typography variant="h5">{view.text}</Typography>
      ) : (
        <>
          <Caption
            target={view.target}
            vehicle={view.kind === "chasing" ? vehicle : null}
            next={view.kind === "travelling"}
          />
          {view.kind === "chasing" && calls && (
            <StopStrip calls={upcomingCalls(calls)} />
          )}
        </>
      )}
    </KioskBand>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function KioskBand({
  bottom,
  onCoveredChange,
  progress,
  pulsing,
  children,
}: {
  bottom: number;
  onCoveredChange: (px: number) => void;
  progress: number | null;
  pulsing: boolean;
  children: ReactNode;
}) {
  // Reported like the HUD's, so MapBottomPadding — still the only writer of
  // the bottom padding — centres the chase in the map above the band.
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const band = ref.current;
    if (!band) return;
    const report = () =>
      onCoveredChange(Math.ceil(bottom + band.offsetHeight + BAND_VEHICLE_GAP));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(band);
    return () => {
      observer.disconnect();
      onCoveredChange(0);
    };
  }, [bottom, onCoveredChange]);

  return (
    <Box
      ref={ref}
      sx={{
        position: "absolute",
        left: SURFACE_INSET,
        right: SURFACE_INSET,
        bottom,
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      <FloatingCard
        role="region"
        aria-label="Kiosk"
        sx={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: BAND_HEIGHT,
          px: 3,
          py: 2.5,
          boxSizing: "border-box",
        }}
      >
        {progress !== null && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 3,
              width: `${progress * 100}%`,
              bgcolor: "text.secondary",
              transition: "width 1s linear",
              ...(pulsing && {
                animation: "kiosk-pulse 1.6s ease-in-out infinite",
                "@keyframes kiosk-pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.35 },
                },
              }),
            }}
          />
        )}
        {children}
      </FloatingCard>
    </Box>
  );
}

function Caption({
  target,
  vehicle,
  next,
}: {
  target: KioskVehicle;
  vehicle: VehicleUpdate | null;
  next: boolean;
}) {
  const mode = vehicle?.mode ?? target.mode;
  const lineCode = vehicle?.line.publicCode ?? target.lineCode;
  const destination = vehicle?.destinationName ?? target.destinationName;
  // Only as a pair, as on the map (labelColoursFor).
  const colours = vehicle ? labelColoursFor(vehicle.line) : null;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        minWidth: 0,
        flexShrink: 0,
        maxWidth: "45%",
      }}
    >
      <VehicleIconCanvas
        url={VEHICLE_ICON_URLS[vehicleIconName(mode)] ?? null}
        size={ICON_SIZE}
      />
      <Box sx={{ minWidth: 0 }}>
        {/* Its line is kept while chasing, so the caption does not move. */}
        <Typography
          variant="overline"
          aria-hidden={!next}
          sx={{
            display: "block",
            color: "text.secondary",
            lineHeight: 1.2,
            visibility: next ? "visible" : "hidden",
          }}
        >
          Next
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
          {lineCode ? (
            <Typography
              component="span"
              variant="h4"
              sx={{
                fontWeight: 700,
                px: 1,
                borderRadius: "var(--mui-shape-borderRadius)",
                ...(colours && {
                  color: colours.text,
                  backgroundColor: colours.halo,
                }),
              }}
            >
              {lineCode}
            </Typography>
          ) : (
            <Typography
              component="span"
              variant="h4"
              noWrap
              sx={{ color: "text.secondary" }}
            >
              {NO_LINE_CODE}
            </Typography>
          )}
          <Typography component="span" variant="h4" noWrap>
            {destination ?? ""}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          {target.codespaceId}
          {vehicle && (
            <>
              {" · "}
              <Box
                component="span"
                sx={{ color: delayColour(delayBucket(vehicle.delay)) }}
              >
                {formatDelay(vehicle.delay)}
              </Box>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

function StopStrip({ calls }: { calls: Call[] }) {
  if (calls.length === 0) return null;
  // The stop being approached: the first one still served.
  const approached = calls.find((call) => call.cancellation !== true);
  return (
    <Box
      component="ol"
      sx={{
        display: "flex",
        gap: 1,
        m: 0,
        p: 0,
        listStyle: "none",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {calls.map((call) => {
        const times = resolveCallTimes(call);
        const cancelled = call.cancellation === true;
        const current = call === approached;
        const realtimeLabel = formatTime(times.realtime);
        const aimedLabel = formatTime(times.aimed);
        // The scheduled time beside the expected one, as the timetable shows
        // it, only when the two differ on the clock.
        const showAimed =
          realtimeLabel !== null &&
          aimedLabel !== null &&
          realtimeLabel !== aimedLabel;
        return (
          <Box
            component="li"
            key={call.order}
            sx={{
              flex: "1 1 0",
              minWidth: 0,
              px: 1.5,
              py: 1,
              borderRadius: "var(--mui-shape-borderRadius)",
              ...(current && {
                bgcolor: "selection.bg",
                color: "selection.main",
              }),
            }}
          >
            {/* Coloured by this stop's own delay, as in the timetable, never
                by the card: the approached stop's selection colour is a
                green that reads as "on time". */}
            <Typography
              variant="h6"
              noWrap
              sx={{
                color: cancelled
                  ? SEVERITY_SEVERE
                  : realtimeLabel !== null
                    ? delayColour(delayBucket(times.delaySeconds))
                    : "inherit",
              }}
            >
              {cancelled ? "—" : (realtimeLabel ?? aimedLabel ?? "–")}
              {!cancelled && showAimed && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    fontSize: "0.75em",
                    fontWeight: 400,
                    color: "text.secondary",
                    textDecoration: "line-through",
                  }}
                >
                  {aimedLabel}
                </Box>
              )}
            </Typography>
            <Typography
              variant="body1"
              noWrap
              sx={
                cancelled
                  ? { color: SEVERITY_SEVERE, textDecoration: "line-through" }
                  : { color: current ? "inherit" : "text.secondary" }
              }
            >
              {call.stopPoint.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * What a fixed-view kiosk shows: nothing while it runs — the map is the
 * whole screen — and the paused pill while a visitor has it.
 */
export function FixedViewKioskOverlay({
  state,
  idleMs,
  onResume,
}: {
  state: FixedViewState;
  idleMs: number;
  onResume: () => void;
}) {
  const now = useNow(CLOCK_MS);
  const resumesInMs = fixedViewResumesInMs(state, now, idleMs);
  if (resumesInMs === null) return null;
  return <KioskPausedPill resumesInMs={resumesInMs} onResume={onResume} />;
}

/** Both kiosks' pill while a visitor has paused them; it cannot stop one. */
function KioskPausedPill({
  resumesInMs,
  onResume,
}: {
  resumesInMs: number;
  onResume: () => void;
}) {
  return (
    <KioskPill
      action={
        <IconButton
          size="small"
          aria-label="Resume kiosk"
          onClick={onResume}
          sx={{ my: -0.5, mr: -1 }}
        >
          <PlayArrowIcon fontSize="small" />
        </IconButton>
      }
    >
      Kiosk paused · resumes in {formatCountdown(resumesInMs)}
    </KioskPill>
  );
}

function KioskPill({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <FloatingCard
      role="status"
      sx={{
        position: "absolute",
        top: SURFACE_INSET,
        left: 0,
        right: 0,
        mx: "auto",
        width: "fit-content",
        maxWidth: `calc(100% - ${8 * SURFACE_INSET}px)`,
        zIndex: 4,
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      {/* Tabular figures, so the countdown does not move the button. */}
      <Typography
        variant="body2"
        noWrap
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {children}
      </Typography>
      {action}
    </FloatingCard>
  );
}
