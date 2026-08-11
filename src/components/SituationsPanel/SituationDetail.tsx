import { Box, Typography } from "@mui/material";
import { NationalSituation, TranslatedString } from "../../types.ts";
import { SituationFlag } from "../../domain/situationFlags.ts";
import { affectsShape } from "../../domain/situationStats.ts";
import { formatValidity } from "../SelectedVehiclePanel/situationValidity.ts";

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

function AffectsGroup({
  label,
  entries,
}: {
  label: string;
  entries: string[];
}) {
  if (entries.length === 0) return null;

  return (
    <Box sx={{ marginTop: 0.5 }}>
      <Typography component="div" sx={{ fontSize: 10, color: "#666" }}>
        {label} ({entries.length})
      </Typography>
      {entries.map((entry, index) => (
        <Typography
          key={`${entry}-${index}`}
          component="div"
          sx={{ fontSize: 11, wordBreak: "break-all", paddingLeft: 1 }}
        >
          {entry}
        </Typography>
      ))}
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
          entries={(affects?.lines ?? []).map((line) =>
            `${line.lineRef} ${line.lineName ?? ""}`.trim(),
          )}
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
          label="Service journeys"
          entries={(affects?.serviceJourneys ?? []).map(
            (journey) => journey.id,
          )}
        />
        <AffectsGroup
          label="Dated service journeys"
          entries={(affects?.datedServiceJourneys ?? []).map(
            (journey) => journey.id,
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
