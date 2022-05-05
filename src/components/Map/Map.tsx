import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { IconLayer } from "@deck.gl/layers";
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

export const Map = ({
  vehicles,
  followVehicleMapPoint = null,
  setFollowVehicleRef,
}: any) => {
  const [modalInfo, setModalInfo] = useState<Vehicle | null>(null);
  const [popupInfo, setPopupInfo] = useState<Vehicle | null>(null);
  const [hoverInfo, setHoverInfo] = useState<Vehicle | null>(null);
  const [viewState, setViewState] = useState<InitialViewStateProps>(
    INITIAL_VIEW_STATE
  );

  useEffect(() => {
    if (followVehicleMapPoint != null) {
      console.log({ followVehicleMapPoint });
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

  const layers = [
    new IconLayer<VehicleMapPoint>({
      id: "icon-layer",
      data: Object.values(vehicles),
      pickable: true,
      iconAtlas,
      iconMapping,
      getIcon: (d: VehicleMapPoint) => d.icon,
      getSize: () => 50,
      getPosition: (vehicleMapPoint: VehicleMapPoint) => [
        vehicleMapPoint.vehicle.location.longitude,
        vehicleMapPoint.vehicle.location.latitude,
      ],
      onClick: (info: PickInfo<VehicleMapPoint>) =>
        setPopupInfo(info?.object?.vehicle),
      onHover: (info: PickInfo<VehicleMapPoint>) =>
        setHoverInfo(info?.object?.vehicle),
    }),
  ];

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
