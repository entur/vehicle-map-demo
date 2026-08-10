import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { Situation, TranslatedString } from "../../types.ts";
import { severityColour } from "./situationSeverity.ts";
import { isRedundant, pickTranslation } from "./situationText.ts";

type SituationListProps = {
  situations: Situation[] | null;
  /** Tighter layout for the inline list under a timetable row. */
  dense?: boolean;
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatValidity(situation: Situation): string | null {
  const period = situation.validityPeriods?.[0];
  if (!period?.startTime) return null;
  const end = period.endTime ? formatDateTime(period.endTime) : "open ended";
  return `${formatDateTime(period.startTime)} – ${end}`;
}

/**
 * Every translation of one field, each tagged with its language.
 *
 * The collapsed row shows a single picked string; this is the expanded view's
 * job, so someone debugging the feed can see exactly what was published and in
 * which languages.
 */
function TranslationLines({
  label,
  strings,
}: {
  label: string;
  strings: TranslatedString[];
}) {
  const entries = (strings ?? []).filter((entry) => entry.value?.trim());
  if (!entries.length) return null;

  return (
    <Box sx={{ marginTop: 0.75 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "#999",
        }}
      >
        {label}
      </Typography>
      {entries.map((entry, index) => (
        <Typography
          key={`${entry.language ?? "none"}-${index}`}
          component="div"
          sx={{ fontSize: 11, lineHeight: 1.4 }}
        >
          <Box component="span" sx={{ color: "#999", marginRight: 0.5 }}>
            {entry.language ?? "—"}
          </Box>
          {entry.value}
        </Typography>
      ))}
    </Box>
  );
}

function SituationRow({
  situation,
  dense,
}: {
  situation: Situation;
  dense: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const summaryText = pickTranslation(situation.summary);
  const descriptionText = pickTranslation(situation.description);
  const adviceText = pickTranslation(situation.advice);

  // Fall back through description to the bare identifier, so a situation with
  // no usable text is still visible and countable rather than a blank row.
  const headline = summaryText ?? descriptionText ?? situation.situationNumber;

  const colour = severityColour(situation.severity);
  const validity = formatValidity(situation);
  const links = (situation.infoLinks ?? []).filter((link) => link.uri);

  const toggle = () => setExpanded((open) => !open);

  return (
    <Box
      sx={{
        borderLeft: `3px solid ${colour}`,
        borderRadius: "0 2px 2px 0",
        background: "#f7f5f2",
        paddingLeft: 1,
        paddingRight: 0.5,
        paddingY: dense ? 0.25 : 0.5,
        marginBottom: 0.5,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.5,
          cursor: "pointer",
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{ color: colour, fontSize: dense ? 11 : 12, lineHeight: 1.5 }}
        >
          ⚠
        </Box>
        <Typography
          component="div"
          sx={{
            flex: 1,
            fontSize: dense ? 11 : 12,
            lineHeight: 1.4,
            ...(expanded
              ? {}
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }),
          }}
        >
          {headline}
        </Typography>
        <Box
          component="span"
          aria-hidden="true"
          sx={{ color: "#999", fontSize: 10, lineHeight: 1.8 }}
        >
          {expanded ? "▴" : "▾"}
        </Box>
      </Box>

      {expanded && (
        <Box sx={{ paddingBottom: 0.5 }}>
          <TranslationLines label="Summary" strings={situation.summary} />
          {!isRedundant(descriptionText, summaryText) && (
            <TranslationLines
              label="Description"
              strings={situation.description}
            />
          )}
          {!isRedundant(adviceText, summaryText) && (
            <TranslationLines label="Advice" strings={situation.advice} />
          )}

          {validity && (
            <Typography
              component="div"
              sx={{ marginTop: 0.75, fontSize: 10, color: "#777" }}
            >
              Valid {validity}
            </Typography>
          )}

          {links.length > 0 && (
            <Box sx={{ marginTop: 0.5 }}>
              {links.map((link, index) => (
                <Typography
                  key={`${link.uri}-${index}`}
                  component="div"
                  sx={{ fontSize: 11 }}
                >
                  <Box
                    component="a"
                    href={link.uri ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: "#2980b9" }}
                  >
                    {pickTranslation(link.labels) ?? link.uri}
                  </Box>
                </Typography>
              ))}
            </Box>
          )}

          {/*
            Nothing is deduplicated, by design. Showing the version here means a
            regression in the eventually-consistent stream is visible in the UI
            instead of being swallowed by client-side tidying.
          */}
          <Typography
            component="div"
            sx={{ marginTop: 0.75, fontSize: 9, color: "#aaa" }}
          >
            {situation.situationNumber}
            {situation.version !== null && ` · v${situation.version}`}
            {situation.reportType && ` · ${situation.reportType}`}
            {situation.severity && ` · ${situation.severity}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function SituationList({
  situations,
  dense = false,
}: SituationListProps) {
  if (!situations?.length) return null;

  return (
    <Box
      sx={{
        marginTop: 1,
        // The trip-level list sits above the scrollable timetable and would
        // push it out of view on a trip with many messages, so it scrolls
        // internally instead. The inline stop-level list is already inside the
        // timetable's own scroll container and must not nest a second one.
        ...(dense ? {} : { maxHeight: "40vh", overflowY: "auto" }),
      }}
    >
      {situations.map((situation, index) => (
        // Keyed with the index as well as the number: because nothing is
        // deduplicated, the same situationNumber can legitimately appear twice
        // during a version regression and a bare key would collide.
        <SituationRow
          key={`${situation.situationNumber}-${index}`}
          situation={situation}
          dense={dense}
        />
      ))}
    </Box>
  );
}
