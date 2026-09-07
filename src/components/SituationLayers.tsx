import type { FeatureCollection } from "geojson";
import { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  dimmedUnlessSelected,
  selectedSituationFilter,
} from "../domain/situationSelection.ts";
import type { SituationFeatures } from "../domain/situationFeatures.ts";
import { useSituations } from "../situations/SituationsContext.ts";
import { SITUATION_LAYER_OPACITY } from "./mapStyle.ts";
import { SituationPopup } from "./SituationsPanel/SituationPopup.tsx";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Cap on how far a selection can zoom in, so a single point doesn't fly to max zoom. */
const MAX_SELECTION_ZOOM = 15;

/** Shared by both fits, so the view arrives the same way however it was asked for. */
const FIT_OPTIONS = {
  padding: 60,
  maxZoom: MAX_SELECTION_ZOOM,
  duration: 800,
} as const;

/**
 * The extent of one situation's features, or of every feature when
 * `situationNumber` is null. Returns null when nothing matched — a situation
 * the map cannot draw (the common case on dev) or a codespace with nothing
 * mappable in it — so callers leave the view where it is rather than flying to
 * a default or to null island.
 *
 * Shared by the two effects that move the view, so a selection and a codespace
 * change frame their subject the same way.
 */
function boundsFor(
  features: SituationFeatures,
  situationNumber: string | null,
): LngLatBounds | null {
  const bounds = new LngLatBounds();
  let hasCoordinates = false;

  const wanted = (feature: { properties: { situationNumber: string } }) =>
    situationNumber === null ||
    feature.properties.situationNumber === situationNumber;

  for (const feature of features.pointFeatures) {
    if (!wanted(feature)) continue;
    bounds.extend(feature.geometry.coordinates as [number, number]);
    hasCoordinates = true;
  }
  for (const feature of features.lineFeatures) {
    if (!wanted(feature)) continue;
    for (const coordinate of feature.geometry.coordinates) {
      bounds.extend(coordinate as [number, number]);
      hasCoordinates = true;
    }
  }

  return hasCoordinates ? bounds : null;
}

/** The layers a click can land on. */
const CLICKABLE_LAYERS = ["situation-points-layer", "situation-lines-layer"];

/** Filtered to the selected situation's features; see mapStyle.ts. */
const HALO_LAYERS = [
  "situation-points-halo-layer",
  "situation-lines-halo-layer",
];

/** How far the other situations fade while one is selected. */
const DIMMED_FACTOR = 0.3;

type PopupState = {
  longitude: number;
  latitude: number;
  situationNumbers: string[];
};

function useSetSourceData(sourceId: string, data: FeatureCollection) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const source = mapRef?.getMap().getSource(sourceId) as
      GeoJSONSource | undefined;
    source?.setData(data);
  }, [sourceId, data, mapRef]);

  // Emptying the source belongs to unmount alone. Doing it in the cleanup of
  // the effect above ran it on every `data` change too — clear, then refill,
  // with a repaint free to land in between.
  useEffect(() => {
    return () => {
      const source = mapRef?.getMap().getSource(sourceId) as
        GeoJSONSource | undefined;
      source?.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [sourceId, mapRef]);
}

/**
 * Draws whatever of the filtered situations can be placed on the map.
 *
 * `visible` reflects the situations layer switches in MapLayers, which own the
 * layers' `visibility` directly. The sources are kept fed either way — hiding
 * the layers must not disturb the panel — but the map is not flown to a
 * selection the user cannot see.
 */
export function SituationLayers({ visible }: { visible: boolean }) {
  const { features, selected, setSelected, codespaceId } = useSituations();
  const { current: mapRef } = useMap();
  const [popup, setPopup] = useState<PopupState | null>(null);

  const points: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.pointFeatures }),
    [features],
  );

  const lines: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.lineFeatures }),
    [features],
  );

  useSetSourceData("situationPoints", points);
  useSetSourceData("situationLines", lines);

  // Clicking a situation feature opens a popup listing everything under the
  // pointer. Hidden layers render nothing, so `queryRenderedFeatures` returns
  // nothing while the Situations toggle is off and no popup can open.
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const hitLayers = () => CLICKABLE_LAYERS.filter((id) => map.getLayer(id));

    const clickSubscription = map.on("click", (event) => {
      const layers = hitLayers();
      if (layers.length === 0) return;

      const hits = map.queryRenderedFeatures(event.point, { layers });
      if (hits.length === 0) {
        setPopup(null);
        return;
      }

      // One click can hit several situations at the same place; keep them all,
      // in hit order, deduplicated only by situation.
      const situationNumbers = [
        ...new Set(
          hits
            .map((feature) => feature.properties?.situationNumber)
            .filter((value): value is string => typeof value === "string"),
        ),
      ];

      setPopup({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        situationNumbers,
      });
    });

    const enterSubscriptions = hitLayers().map((id) =>
      map.on("mouseenter", id, () => {
        map.getCanvas().style.cursor = "pointer";
      }),
    );
    const leaveSubscriptions = hitLayers().map((id) =>
      map.on("mouseleave", id, () => {
        map.getCanvas().style.cursor = "";
      }),
    );

    return () => {
      clickSubscription.unsubscribe();
      enterSubscriptions.forEach((s) => s.unsubscribe());
      leaveSubscriptions.forEach((s) => s.unsubscribe());
    };
  }, [mapRef]);

  // Single the selection out on the map: halo layers show only its features,
  // and everything else fades. Applied to the style rather than the data, so
  // a selection never rebuilds the features. The cleanup restores the resting
  // state, which is what makes leaving situations mode (or a layer that is
  // toggled while a selection is held) safe: no situation stays dimmed.
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const apply = (selection: string | null) => {
      for (const id of HALO_LAYERS) {
        if (map.getLayer(id)) {
          map.setFilter(id, selectedSituationFilter(selection));
        }
      }
      for (const [id, paint] of Object.entries(SITUATION_LAYER_OPACITY)) {
        if (!map.getLayer(id)) continue;
        for (const [property, full] of Object.entries(paint)) {
          map.setPaintProperty(
            id,
            property,
            dimmedUnlessSelected(selection, full, full * DIMMED_FACTOR),
          );
        }
      }
    };

    apply(selected);
    return () => apply(null);
  }, [selected, mapRef]);

  // Focus the map on the selected situation's own features when the
  // selection changes, wherever the selection came from: a row in the
  // situations list and a row in the map popup are the same act, so they get
  // the same view. A popup selection can therefore zoom out — the situation
  // whose dot was clicked may also carry a line span reaching well past it —
  // which is the point: the fitted view is what shows the whole extent of what
  // was picked.
  // Deliberately depends only on `selected` (and the map instance) rather than
  // on `features`: `features` gets a new array identity on every subscription
  // frame regardless of content (it's rebuilt from a freshly-sorted
  // `feed.situations` array each time), and depending on it here would re-fly
  // the map on every frame while a selection is held, fighting anything the
  // user does with the view. Each time this *does* run, it reads `features`
  // from the same render's closure, which is already current — `features` does
  // not itself depend on `selected`, so there is no staleness to worry about.
  useEffect(() => {
    if (!mapRef || !selected || !visible) return;

    const bounds = boundsFor(features, selected);
    if (!bounds) return;

    mapRef.getMap().fitBounds(bounds, FIT_OPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mapRef, visible]);

  // Frame the whole codespace when the user picks a different one: the set on
  // the map has just been replaced, and its situations are usually nowhere
  // near the view the previous codespace left behind.
  //
  // Fires on a codespace change and nothing else — `visible`, `features` and
  // `selected` are read from the closure rather than depended on, so toggling
  // the layers back on doesn't fly the view to the whole codespace. It is a
  // change, not a state to reconcile.
  //
  // A held selection wins: one that survives the change keeps its own framing,
  // and running both fits would leave them fighting over the view. When the
  // change drops the selection instead (`selectionWithin`, applied during
  // render), `selected` is already null here and this runs.
  //
  // Fits on change, not on mount: the mount run happens while `features` is
  // still empty — the feed has delivered nothing yet — so a codespace restored
  // from a shared link, or carried in from vehicles mode, leaves the view
  // alone.
  useEffect(() => {
    if (!mapRef || !visible || selected) return;

    const bounds = boundsFor(features, null);
    if (!bounds) return;

    mapRef.getMap().fitBounds(bounds, FIT_OPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codespaceId, mapRef]);

  // Derived rather than synced: hiding the layers hides anything opened from
  // them, without an effect that clears state. The popup can only have been
  // opened while visible, so showing the layers again restores a popup that is
  // still pointing at real features.
  if (!popup || !visible) return null;

  return (
    <SituationPopup
      longitude={popup.longitude}
      latitude={popup.latitude}
      situationNumbers={popup.situationNumbers}
      onSelect={(situationNumber) => setSelected(situationNumber)}
      onClose={() => setPopup(null)}
    />
  );
}
