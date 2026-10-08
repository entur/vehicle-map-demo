import { useEffect, useId, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import LinkIcon from "@mui/icons-material/Link";
import { KioskTool } from "./RightMenu/types.ts";
import {
  DEFAULT_DWELL_MS,
  IDLE_MS,
  KioskSession,
  KioskSettings,
  withKioskParams,
} from "../domain/kioskSchedule.ts";
import {
  KIOSK_DWELL_CHOICES_MS,
  KIOSK_IDLE_CHOICES_MS,
  KIOSK_KIND_LABELS,
  KioskSummaryRow,
  choiceOr,
  formatFixedView,
  formatKioskDuration,
  kioskFilterSummary,
} from "../domain/kioskSettings.ts";

/** How long "Link copied" or "Copy failed" replaces the button's text. */
const COPY_FEEDBACK_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

/**
 * The Kiosk tool: set up a kiosk run, start it, stop it, or copy a link that
 * starts one on a wall screen. A run either chases one vehicle after another
 * or holds the map's current view and shows every vehicle in it. The filter
 * is shown, not edited — it stays the filter panel's, so the two cannot
 * contradict each other. Stop is only here: the paused pill a passer-by sees
 * can resume the kiosk but not end it.
 */
export function KioskPanel({
  session,
  filter,
  onStart,
  onStop,
  readCamera,
  dimension,
}: KioskTool) {
  const [kind, setKind] = useState<KioskSettings["kind"]>(
    () => session?.kind ?? "chase",
  );
  const [dwellMs, setDwellMs] = useState(() =>
    choiceOr(
      KIOSK_DWELL_CHOICES_MS,
      session?.kind === "chase" ? session.dwellMs : undefined,
      DEFAULT_DWELL_MS,
    ),
  );
  const [idleMs, setIdleMs] = useState(() =>
    choiceOr(KIOSK_IDLE_CHOICES_MS, session?.idleMs, IDLE_MS),
  );
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const id = window.setTimeout(() => setCopy("idle"), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [copy]);

  // What Start and Copy link would run: a fixed view takes the map's camera
  // as it is now, so it is read at the click rather than kept in state.
  const draftSettings = (): KioskSettings | null => {
    if (kind === "chase") return { kind, dwellMs, idleMs };
    const camera = readCamera();
    return camera && { kind, camera, dimension, idleMs };
  };

  const copyLink = () => {
    const settings = session ?? draftSettings();
    if (!settings) {
      setCopy("failed");
      return;
    }
    const href = withKioskParams(window.location.href, settings);
    // No clipboard outside a secure context; a refusal is shown, not thrown.
    const write = navigator.clipboard?.writeText(href);
    if (!write) {
      setCopy("failed");
      return;
    }
    write.then(
      () => setCopy("copied"),
      () => setCopy("failed"),
    );
  };
  const start = () => {
    const settings = draftSettings();
    if (settings) onStart(settings);
  };

  const shownKind = session?.kind ?? kind;
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Kiosk
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {session
          ? "A kiosk is running. After a touch it resumes by itself; Stop ends it."
          : kind === "chase"
            ? "Chases one vehicle after another, for a wall screen. A touch pauses it."
            : "Holds the map's current view and shows every vehicle in it, for a wall screen. A touch pauses it."}
      </Typography>

      {session ? (
        <SummaryRows rows={sessionRows(session)} />
      ) : (
        <Stack spacing={2}>
          <KindSelect value={kind} onChange={setKind} />
          {kind === "chase" ? (
            <DurationSelect
              label="Time per vehicle"
              value={dwellMs}
              choices={KIOSK_DWELL_CHOICES_MS}
              onChange={setDwellMs}
            />
          ) : (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Frame the view first: centre, zoom, tilt and turn the map as the
              screen should show it.
            </Typography>
          )}
          <DurationSelect
            label="Resume after a touch"
            value={idleMs}
            choices={KIOSK_IDLE_CHOICES_MS}
            onChange={setIdleMs}
          />
        </Stack>
      )}

      <Typography
        variant="overline"
        component="h6"
        sx={{ display: "block", mt: 2, color: "text.secondary" }}
      >
        {shownKind === "chase" ? "Chases" : "Shows"}
      </Typography>
      <SummaryRows rows={kioskFilterSummary(filter)} />
      {!session && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Set in the Filter panel.
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        {session ? (
          <Button variant="contained" startIcon={<StopIcon />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={start}
          >
            Start
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<LinkIcon />}
          onClick={copyLink}
          aria-live="polite"
        >
          {copy === "copied"
            ? "Link copied"
            : copy === "failed"
              ? "Copy failed"
              : "Copy link"}
        </Button>
      </Stack>
    </Box>
  );
}

function sessionRows(session: KioskSession): KioskSummaryRow[] {
  const idle = {
    label: "Resume after a touch",
    value: formatKioskDuration(session.idleMs),
  };
  return session.kind === "chase"
    ? [
        {
          label: "Time per vehicle",
          value: formatKioskDuration(session.dwellMs),
        },
        idle,
      ]
    : [
        {
          label: "View",
          value: formatFixedView(session.camera, session.dimension),
        },
        idle,
      ];
}

function KindSelect({
  value,
  onChange,
}: {
  value: KioskSettings["kind"];
  onChange: (kind: KioskSettings["kind"]) => void;
}) {
  const labelId = useId();
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={labelId}>Kind</InputLabel>
      <Select
        labelId={labelId}
        label="Kind"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as KioskSettings["kind"])
        }
      >
        {(
          Object.entries(KIOSK_KIND_LABELS) as [KioskSettings["kind"], string][]
        ).map(([kind, label]) => (
          <MenuItem key={kind} value={kind}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DurationSelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: number;
  choices: number[];
  onChange: (ms: number) => void;
}) {
  const labelId = useId();
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {choices.map((ms) => (
          <MenuItem key={ms} value={ms}>
            {formatKioskDuration(ms)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SummaryRows({ rows }: { rows: KioskSummaryRow[] }) {
  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: 2,
        rowGap: 0.5,
        m: 0,
      }}
    >
      {rows.map(({ label, value }) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography
            component="dt"
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            {label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, overflowWrap: "anywhere" }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
