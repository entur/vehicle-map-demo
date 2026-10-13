import { Box, Link, Typography } from "@mui/material";
import { FloatingCard } from "./FloatingCard.tsx";
import { SURFACE_INSET } from "./theme.ts";
import { formatTime } from "./SelectedVehiclePanel/callTimes.ts";
import {
  WeatherDetails,
  compassPoint,
  formatPrecipitation,
  formatTemperature,
  formatWind,
  symbolLabel,
} from "../domain/weatherDetails.ts";

type WeatherCardProps = {
  /** The reading the weather is drawn from; null shows nothing. */
  details: WeatherDetails | null;
  /** px off the bottom edge, clear of whatever `MapView` has there. */
  bottom: number;
  /** A phone: one line of values instead of labelled rows. */
  compact: boolean;
};

const MET_NORWAY = "https://www.met.no/en";

/**
 * The numbers behind the weather drawn over the map, in the bottom-right
 * corner above the attribution strip, where no other surface stands.
 *
 * MET Norway's terms shape what it says. The values are the reading's own,
 * with their units, since CC BY asks that changes be indicated and there are
 * none. The coming hour's symbol is labelled "Next hour" because it is a
 * forecast where the rest is measured now. The source is credited beside the
 * numbers, in MET's suggested wording, with the time the reading was fetched,
 * which they ask for. It uses no Yr logo or symbols: their terms forbid a
 * service that looks like theirs. The licence link stays in the attribution
 * strip, which carries the credit whenever this card is shown.
 */
export function WeatherCard({ details, bottom, compact }: WeatherCardProps) {
  if (!details) return null;
  const {
    airTemperature,
    precipitationRate,
    windSpeed,
    windFromDirection,
    windGust,
    nextHourSymbol,
  } = details;
  const nextHour = nextHourSymbol === null ? null : symbolLabel(nextHourSymbol);
  const retrieved = formatTime(new Date(details.retrievedAt).toISOString());

  const source = (
    <Typography
      variant="caption"
      sx={{ display: "block", color: "text.secondary", whiteSpace: "nowrap" }}
    >
      Data from{" "}
      <Link
        href={MET_NORWAY}
        target="_blank"
        rel="noopener"
        color="inherit"
        underline="always"
      >
        MET Norway
      </Link>
      {retrieved && `, retrieved ${retrieved}`}
    </Typography>
  );

  const sx = {
    position: "absolute",
    right: SURFACE_INSET,
    bottom,
    // With the detail cards, under RightMenu: an open tool panel covers it.
    zIndex: 2,
    boxSizing: "border-box",
    maxWidth: `calc(100vw - ${2 * SURFACE_INSET}px)`,
    fontVariantNumeric: "tabular-nums",
  } as const;

  if (compact) {
    const values = [
      airTemperature !== null && formatTemperature(airTemperature),
      precipitationRate !== null && formatPrecipitation(precipitationRate),
      windSpeed !== null &&
        formatWind(windSpeed, null) +
          (windFromDirection === null
            ? ""
            : ` ${compassPoint(windFromDirection)}`),
    ].filter(Boolean);
    return (
      <FloatingCard
        data-testid="weather-card"
        sx={{ ...sx, paddingX: 1.5, paddingY: 0.75 }}
      >
        <Typography variant="body2" noWrap>
          {values.join(" · ")}
        </Typography>
        {source}
      </FloatingCard>
    );
  }

  return (
    <FloatingCard
      data-testid="weather-card"
      sx={{ ...sx, paddingX: 2, paddingY: 1.5 }}
    >
      {airTemperature !== null && (
        <Typography variant="h6" component="p" sx={{ lineHeight: 1.2 }}>
          {formatTemperature(airTemperature)}
        </Typography>
      )}
      <Box
        component="dl"
        sx={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          columnGap: 2,
          rowGap: 0.25,
          marginY: 0.75,
          "& dt": { color: "text.secondary" },
          "& dd": { margin: 0 },
        }}
      >
        <Row label="Precipitation">
          {precipitationRate === null
            ? "Not measured here"
            : formatPrecipitation(precipitationRate)}
        </Row>
        {windSpeed !== null && (
          <Row label="Wind">
            {formatWind(windSpeed, windFromDirection)}
            {windGust !== null && `, gusts ${windGust.toFixed(1)}`}
          </Row>
        )}
        {nextHour && <Row label="Next hour">{nextHour}</Row>}
      </Box>
      {source}
    </FloatingCard>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Typography variant="body2" component="dt">
        {label}
      </Typography>
      <Typography variant="body2" component="dd">
        {children}
      </Typography>
    </>
  );
}
