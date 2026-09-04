import { Box, Typography } from "@mui/material";
import { NationalSituation, TranslatedString } from "../../types.ts";
import { SituationFlag } from "../../domain/situationFlags.ts";
import { affectsShape } from "../../domain/situationStats.ts";
import { formatValidity } from "../SelectedVehiclePanel/situationValidity.ts";
import { decodePolyline } from "../../utils/decodePolyline.ts";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ display: "flex", gap: 1, fontSize: 11 }}>
      <span style={{ color: "#666", minWidth: 110 }}>{label}</span>
      <span style={{ wordBreak: "break-all" }}>{value ?? "—"}</span>
    </Box>
  );
}

function Translations({
  label,
  strings,
}: {
  label: string;
  strings: TranslatedString[];
}) {
  if (!strings || strings.length === 0) return null;

  return (
    <Box sx={{ marginTop: 1 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
        }}
      >
        {label}
      </Typography>
      {strings.map((entry, index) => (
        <Box
          key={`${entry.language ?? "untagged"}-${index}`}
          sx={{ marginTop: 0.25 }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 10, color: "#999", marginRight: 0.5 }}
          >
            {entry.language ?? "untagged"}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12 }}>
            {entry.value ?? "(empty)"}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// Mirrors situationFeatures.ts: the map only draws a line for a span that
// decodes to at least two coordinates, so "span" here must mean the same
// thing or the panel and the map disagree about what is on screen.
function hasDrawableSpan(points: string | null | undefined): boolean {
  if (!points) return false;
  return decodePolyline(points).length >= 2;
}

function AffectsGroup({
  label,
  entries,
  cap,
}: {
  label: string;
  entries: string[];
  /** Caps how many rows render; a fixture situation can carry 1,000+. The
   * true count still shows in the heading and in the trailing summary row,
   * so capping never quietly understates the total. */
  cap?: number;
}) {
  if (entries.length === 0) return null;

  const truncated = cap !== undefined && entries.length > cap;
  const shown = truncated ? entries.slice(0, cap) : entries;

  return (
    <Box sx={{ marginTop: 0.5 }}>
      <Typography component="div" sx={{ fontSize: 10, color: "#666" }}>
        {label} ({entries.length})
      </Typography>
      {shown.map((entry, index) => (
        <Typography
          key={`${entry}-${index}`}
          component="div"
          sx={{ fontSize: 11, wordBreak: "break-all", paddingLeft: 1 }}
        >
          {entry}
        </Typography>
      ))}
      {truncated && (
        <Typography
          component="div"
          sx={{
            fontSize: 11,
            paddingLeft: 1,
            color: "#666",
            fontStyle: "italic",
          }}
        >
          … and {entries.length - cap} more ({entries.length} total)
        </Typography>
      )}
    </Box>
  );
}

export function SituationDetail({
  situation,
  flags,
  onClose,
}: {
  situation: NationalSituation;
  flags: SituationFlag[];
  onClose: () => void;
}) {
  const affects = situation.affects;
  const validity = formatValidity(situation);

  return (
    <Box
      sx={{
        border: "1px solid #ddd",
        borderRadius: 1,
        padding: 1.5,
        marginBottom: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
          Detail
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          sx={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 14,
            padding: 0,
            color: "#666",
          }}
        >
          ×
        </Box>
      </Box>

      <Translations label="Summary" strings={situation.summary} />
      <Translations label="Description" strings={situation.description} />
      <Translations label="Advice" strings={situation.advice} />

      <Box sx={{ marginTop: 1 }}>
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#666",
          }}
        >
          Validity
        </Typography>
        {(validity ?? ["—"]).map((line, index) => (
          <Typography
            key={`${line}-${index}`}
            component="div"
            sx={{ fontSize: 11 }}
          >
            {line}
          </Typography>
        ))}
      </Box>

      {situation.infoLinks.length > 0 && (
        <Box sx={{ marginTop: 1 }}>
          <Typography
            component="div"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#666",
            }}
          >
            Info links
          </Typography>
          {situation.infoLinks.map((link, index) => (
            <Typography
              key={`${link.uri ?? "no-uri"}-${index}`}
              component="div"
              sx={{ fontSize: 11, wordBreak: "break-all" }}
            >
              {link.uri ?? "(no uri)"}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ marginTop: 1 }}>
        <Typography
          component="div"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#666",
          }}
        >
          Affects — {affectsShape(situation)}
        </Typography>
        <AffectsGroup
          label="Lines"
          entries={(affects?.affectedLines ?? []).map((affectedLine) => {
            const line = affectedLine.line;
            const stops = affectedLine.stops?.length ?? 0;
            const name =
              `${line?.lineRef ?? "(no lineRef)"} ${line?.lineName ?? ""}`.trim();
            return stops ? `${name} — ${stops} stop(s)` : name;
          })}
        />
        <AffectsGroup
          label="Journeys"
          entries={(affects?.vehicleJourneys ?? []).map((journey) => {
            const id =
              journey.datedServiceJourney?.id ??
              journey.serviceJourney?.id ??
              "(no id)";
            const parts = [id];
            if (journey.line?.lineRef) parts.push(journey.line.lineRef);
            if (journey.operator?.operatorRef)
              parts.push(journey.operator.operatorRef);
            parts.push(`${journey.stops?.length ?? 0} stop(s)`);
            parts.push(
              hasDrawableSpan(journey.affectedPointsOnLink?.points)
                ? "span"
                : "no span",
            );
            return parts.join(" — ");
          })}
        />
        <AffectsGroup
          label="Affected stops"
          cap={200}
          entries={[
            ...(affects?.vehicleJourneys ?? []).flatMap(
              (journey) => journey.stops ?? [],
            ),
            ...(affects?.affectedLines ?? []).flatMap(
              (affectedLine) => affectedLine.stops ?? [],
            ),
          ].map((entry) => {
            const conditions = entry.stopConditions.join(", ");
            const name = `${entry.stop.id} ${entry.stop.name ?? ""}`.trim();
            return conditions ? `${name} [${conditions}]` : name;
          })}
        />
        <AffectsGroup
          label="Stop points"
          entries={(affects?.stopPoints ?? []).map((stop) =>
            `${stop.id} ${stop.name ?? ""}`.trim(),
          )}
        />
        <AffectsGroup
          label="Stop places"
          entries={(affects?.stopPlaces ?? []).map((stop) =>
            `${stop.id} ${stop.name ?? ""}`.trim(),
          )}
        />
        <AffectsGroup
          label="Operators"
          entries={(affects?.operators ?? []).map((operator) =>
            `${operator.operatorRef} ${operator.name ?? ""}`.trim(),
          )}
        />
      </Box>

      <Box sx={{ marginTop: 1 }}>
        <Field label="situationNumber" value={situation.situationNumber} />
        <Field label="version" value={situation.version?.toString() ?? null} />
        <Field label="participantRef" value={situation.participantRef} />
        <Field
          label="codespace"
          value={situation.codespace?.codespaceId ?? null}
        />
        <Field label="sourceType" value={situation.sourceType} />
        <Field label="progress" value={situation.progress} />
        <Field label="severity" value={situation.severity} />
        <Field label="reportType" value={situation.reportType} />
        <Field
          label="priority"
          value={situation.priority?.toString() ?? null}
        />
        <Field
          label="planned"
          value={situation.planned === null ? null : String(situation.planned)}
        />
        <Field label="creationTime" value={situation.creationTime} />
        <Field label="versionedAtTime" value={situation.versionedAtTime} />
        <Field label="lastUpdated" value={situation.lastUpdated} />
        <Field label="expiration" value={situation.expiration} />
        <Field
          label="openEnded"
          value={
            situation.openEnded === null ? null : String(situation.openEnded)
          }
        />
        <Field label="age" value={situation.age} />
        <Field label="flags" value={flags.length ? flags.join(", ") : null} />
      </Box>
    </Box>
  );
}
