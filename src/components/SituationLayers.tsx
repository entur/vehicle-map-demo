import type { FeatureCollection } from "geojson";
import { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useSituations } from "../situations/SituationsContext.ts";
import { VehicleUpdate } from "../types.ts";
import { SituationPopup } from "./SituationsPanel/SituationPopup.tsx";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Cap on how far a selection can zoom in, so a single point doesn't fly to max zoom. */
const MAX_SELECTION_ZOOM = 15;

/** The layers a click can land on. The halo layer is decoration, not a target. */
const CLICKABLE_LAYERS = ["situation-points-layer", "situation-lines-layer"];

type PopupState = {
  longitude: number;
  latitude: number;
  situationNumbers: string[];
};

function useSetSourceData(sourceId: string, data: FeatureCollection) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const source = mapRef.getMap().getSource(sourceId) as
      GeoJSONSource | undefined;
    if (!source) return;

    source.setData(data);

    return () => {
      source.setData(EMPTY_FEATURE_COLLECTION);
    };
  }, [sourceId, data, mapRef]);
}

/**
 * Draws whatever of the filtered situations can be placed, plus a halo around
 * the live vehicles a selected situation affects.
 *
 * Vehicles are matched on lineRef only. VehicleUpdate does not carry a dated
 * service journey, and adding one to the streamed vehicle subscription would
 * cost bandwidth on every frame to match ten more situations — see the plan's
 * spec amendment.
 *
 * `visible` reflects the "Situations" toggle in MapLayers, which owns the three
 * layers' `visibility` directly. The sources are kept fed either way — hiding
 * the layers must not disturb the panel — but the map is not flown to a
 * selection the user cannot see.
 */
export function SituationLayers({
  vehicles,
  visible,
}: {
  vehicles: VehicleUpdate[];
  visible: boolean;
}) {
  const { feed, features, selected, setSelected } = useSituations();
  const { current: mapRef } = useMap();
  const [popup, setPopup] = useState<PopupState | null>(null);

  // Set when a selection originates from a map click, so the fitBounds effect
  // below can skip that one run. Flying the view to something the user just
  // clicked on — and could therefore already see — is disorienting.
  const selectedFromMap = useRef(false);

  const points: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.pointFeatures }),
    [features],
  );

  const lines: FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: features.lineFeatures }),
    [features],
  );

  const affectedVehicles: FeatureCollection = useMemo(() => {
    if (!selected) return EMPTY_FEATURE_COLLECTION;

    // Resolved against the unfiltered set, matching SituationsPanel's lookup
    // of the selected situation: narrowing the filter after selecting must
    // not make the halo vanish while the detail view stays open.
    const situation = feed.situations.find(
      (s) => s.situationNumber === selected,
    );
    const lineRefs = new Set(
      (situation?.affects?.lines ?? [])
        .map((line) => line.lineRef)
        .filter((ref): ref is string => Boolean(ref)),
    );
    if (lineRefs.size === 0) return EMPTY_FEATURE_COLLECTION;

    return {
      type: "FeatureCollection",
      features: vehicles
        .filter((vehicle) => lineRefs.has(vehicle.line?.lineRef))
        .map((vehicle) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              vehicle.location.longitude,
              vehicle.location.latitude,
            ],
          },
          properties: { vehicleId: vehicle.vehicleId },
        })),
    };
  }, [selected, feed, vehicles]);

  useSetSourceData("situationPoints", points);
  useSetSourceData("situationLines", lines);
  useSetSourceData("situationVehicles", affectedVehicles);

  // Focus the map on the selected situation's own features when the
  // selection changes. Deliberately depends only on `selected` (and the map
  // instance) rather than on `features`: `features` gets a new array
  // identity on every subscription frame regardless of content (it's
  // rebuilt from a freshly-sorted `feed.situations` array each time), and
  // depending on it here would re-fly the map on every frame while a
  // selection is held, fighting anything the user does with the view.
  // Each time this *does* run, it reads `features` from the same render's
  // closure, which is already current — `features` does not itself depend
  // on `selected`, so there is no staleness to worry about.
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

  useEffect(() => {
    if (selectedFromMap.current) {
      selectedFromMap.current = false;
      return;
    }
    if (!mapRef || !selected || !visible) return;

    const bounds = new LngLatBounds();
    let hasCoordinates = false;

    for (const feature of features.pointFeatures) {
      if (feature.properties.situationNumber !== selected) continue;
      bounds.extend(feature.geometry.coordinates as [number, number]);
      hasCoordinates = true;
    }
    for (const feature of features.lineFeatures) {
      if (feature.properties.situationNumber !== selected) continue;
      for (const coordinate of feature.geometry.coordinates) {
        bounds.extend(coordinate as [number, number]);
        hasCoordinates = true;
      }
    }

    // No features for this situation (the common case on dev): leave the
    // view exactly where it is rather than jumping to a default or to null
    // island.
    if (!hasCoordinates) return;

    mapRef.getMap().fitBounds(bounds, {
      padding: 60,
      maxZoom: MAX_SELECTION_ZOOM,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mapRef, visible]);

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
      onSelect={(situationNumber) => {
        selectedFromMap.current = true;
        setSelected(situationNumber);
      }}
      onClose={() => setPopup(null)}
    />
  );
}
