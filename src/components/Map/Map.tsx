import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { IconLayer, PathLayer } from "@deck.gl/layers";
import { StaticMap, Popup, _MapContext as MapContext } from "react-map-gl";
import { InitialViewStateProps, PickInfo } from "@deck.gl/core/lib/deck";
import { Modal } from "@entur/modal";
import { TertiaryButton } from "@entur/button";
import { TooltipContent } from "./TooltipContent";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { Vehicle } from "model/vehicle";
import iconAtlas from "static/icons/icons.png";
import iconMapping from "static/icons/icons.json";
import "mapbox-gl/dist/mapbox-gl.css";
import { RGBAColor } from "deck.gl";
import { decode } from "@googlemaps/polyline-codec";

const DEFAULT_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const MAPBOX_MAP_STYLE = process.env.REACT_APP_MAPBOX_MAP_STYLE;

// Viewport settings
const INITIAL_VIEW_STATE: InitialViewStateProps = {
  longitude: 10.757933,
  latitude: 59.911491,
  zoom: 13,
  pitch: 0,
  bearing: 0,
};

const colors: Record<string, number[]> = {};

function random_rgba(ref: string, alpha: number): RGBAColor {
  if (!colors[ref]) {
    var o = Math.round,
      r = Math.random,
      s = 255;
    colors[ref] = [o(r() * s), o(r() * s), o(r() * s), alpha];
  }
  return colors[ref] as RGBAColor;
}

export const Map = ({
  vehicles,
  followVehicleMapPoint = null,
  setFollowVehicleRef,
  lineLayerOptions,
}: any) => {
  const [modalInfo, setModalInfo] = useState<Vehicle | null>(null);
  const [popupInfo, setPopupInfo] = useState<Vehicle | null>(null);
  const [hoverInfo, setHoverInfo] = useState<Vehicle | null>(null);
  const [viewState, setViewState] =
    useState<InitialViewStateProps>(INITIAL_VIEW_STATE);

  useEffect(() => {
    if (followVehicleMapPoint != null) {
      const vehicleMapPoint = followVehicleMapPoint;
      if (vehicleMapPoint) {
        setHoverInfo(vehicleMapPoint.vehicle);
        setViewState((v: InitialViewStateProps) => ({
          ...v,
          longitude: vehicleMapPoint.vehicle.location.longitude,
          latitude: vehicleMapPoint.vehicle.location.latitude,
        }));
      }
    }
  }, [followVehicleMapPoint]);

  useEffect(() => {
    if (popupInfo) {
      const vehicleMapPoint: VehicleMapPoint = vehicles[popupInfo.vehicleRef];
      if (vehicleMapPoint) {
        if (
          vehicleMapPoint.vehicle.location.longitude !==
            popupInfo.location.longitude ||
          vehicleMapPoint.vehicle.location.latitude !==
            popupInfo.location.latitude
        ) {
          setPopupInfo(vehicleMapPoint.vehicle);
          setViewState((v: InitialViewStateProps) => ({
            ...v,
            longitude: vehicleMapPoint.vehicle.location.longitude,
            latitude: vehicleMapPoint.vehicle.location.latitude,
          }));
        }
      }
    }
    // eslint-disable-next-line
  }, [vehicles]);

  const layers = [];

  if (lineLayerOptions.includePointsOnLink) {
    layers.push(
      new PathLayer<[string, VehicleMapPoint]>({
        id: "points-on-link-layer",
        data: vehicles,
        getPath: (d) =>
          d[1].vehicle?.serviceJourney?.pointsOnLink?.points
            ? decode(d[1].vehicle?.serviceJourney?.pointsOnLink?.points).map(
                (coordinates) => [coordinates[1], coordinates[0]]
              )
            : [],
        getColor: (d) => random_rgba(d[1].vehicle.line.lineRef, 25),
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true,
      })
    );
  }

  if (lineLayerOptions.showHistoricalPath) {
    layers.push(
      new PathLayer<[string, VehicleMapPoint]>({
        id: "historical-path-layer",
        data: vehicles,
        getPath: (d) => d[1].historicalPath,
        getColor: (d) => random_rgba(d[1].vehicle.vehicleRef, 100),
        updateTriggers: {
          getPath: (entry: [string, VehicleMapPoint]) => {
            return entry[1]?.lastUpdated;
          },
        },
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true,
      })
    );
  }

  layers.push(
    new IconLayer<[string, VehicleMapPoint]>({
      id: "icon-layer",
      data: vehicles,
      pickable: true,
      iconAtlas,
      iconMapping,
      getIcon: (d) => d[1].icon,
      getSize: () => 50,
      getPosition: (entry) => [
        entry[1]?.vehicle?.location?.longitude,
        entry[1]?.vehicle?.location?.latitude,
      ],
      updateTriggers: {
        getPosition: (entry: [string, VehicleMapPoint]) => {
          return entry[1]?.lastUpdated;
        },
      },
      onClick: (info: PickInfo<[string, VehicleMapPoint]>) =>
        setPopupInfo(
          (Array.from(vehicles.values())[info.index] as any).vehicle
        ),
      onHover: (info: PickInfo<[string, VehicleMapPoint]>) =>
        setHoverInfo(
          (Array.from(vehicles.values())[info.index] as VehicleMapPoint)
            ?.vehicle
        ),
    })
  );

  return (
    <>
      <DeckGL
        ContextProvider={MapContext.Provider}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
        style={{ left: "400px", width: "calc(100% - 400px)" }}
      >
        {popupInfo && (
          <Popup
            key="popup"
            longitude={popupInfo.location.longitude}
            latitude={popupInfo.location.latitude}
            closeButton
            closeOnClick
            onClose={() => setPopupInfo(null)}
          >
            <TooltipContent
              vehicle={popupInfo}
              onShowModalClick={setModalInfo}
              onFollowVehicle={(vehicleRef: string) =>
                setFollowVehicleRef(vehicleRef)
              }
              full
            />
          </Popup>
        )}
        {!popupInfo && hoverInfo && (
          <Popup
            key="hover"
            closeButton={false}
            longitude={hoverInfo.location.longitude}
            latitude={hoverInfo.location.latitude}
            anchor="bottom"
          >
            <TooltipContent
              vehicle={hoverInfo}
              onFollowVehicle={(vehicleRef: string) =>
                setFollowVehicleRef(vehicleRef)
              }
            />
          </Popup>
        )}
        <StaticMap
          key="map"
          width="100%"
          height="100%"
          reuseMaps
          preventStyleDiffing
          {...(!!MAPBOX_MAP_STYLE && !!MAPBOX_ACCESS_TOKEN
            ? {
                mapStyle: MAPBOX_MAP_STYLE,
                mapboxApiAccessToken: MAPBOX_ACCESS_TOKEN,
              }
            : { mapStyle: DEFAULT_STYLE })}
        />
      </DeckGL>
      <Modal
        open={!!modalInfo}
        onDismiss={() => setModalInfo(null)}
        title="Vehicle JSON"
        size="medium"
      >
        <pre>{JSON.stringify(modalInfo, null, 2)}</pre>
        <TertiaryButton
          onClick={() =>
            navigator.clipboard.writeText(JSON.stringify(modalInfo, null, 2))
          }
        >
          Copy to clipboard
        </TertiaryButton>
      </Modal>
    </>
  );
};
