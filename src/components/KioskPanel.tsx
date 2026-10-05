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
  withKioskParams,
} from "../domain/kioskSchedule.ts";
import {
  KIOSK_DWELL_CHOICES_MS,
  KIOSK_IDLE_CHOICES_MS,
  KioskSummaryRow,
  choiceOr,
  formatKioskDuration,
  kioskFilterSummary,
} from "../domain/kioskSettings.ts";

/** How long "Link copied" or "Copy failed" replaces the button's text. */
const COPY_FEEDBACK_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

/**
 * The Kiosk tool: set up a kiosk run, start it, stop it, or copy a link that
 * starts one on a wall screen. The filter is shown, not edited — it stays the
 * filter panel's, so the two cannot contradict each other. Stop is only here:
 * the paused pill a passer-by sees can resume the kiosk but not end it.
 */
export function KioskPanel({ session, filter, onStart, onStop }: KioskTool) {
  const [dwellMs, setDwellMs] = useState(() =>
    choiceOr(KIOSK_DWELL_CHOICES_MS, session?.dwellMs, DEFAULT_DWELL_MS),
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

  const settings = session ?? { dwellMs, idleMs };
  const copyLink = () => {
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Kiosk
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {session
          ? "A kiosk is running. After a touch it resumes by itself; Stop ends it."
          : "Chases one vehicle after another, for a wall screen. A touch pauses it."}
      </Typography>

      {session ? (
        <SummaryRows
          rows={[
            {
              label: "Time per vehicle",
              value: formatKioskDuration(session.dwellMs),
            },
            {
              label: "Resume after a touch",
              value: formatKioskDuration(session.idleMs),
            },
          ]}
        />
      ) : (
        <Stack spacing={2}>
          <DurationSelect
            label="Time per vehicle"
            value={dwellMs}
            choices={KIOSK_DWELL_CHOICES_MS}
            onChange={setDwellMs}
          />
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
        Chases
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
            onClick={() => onStart(dwellMs, idleMs)}
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
