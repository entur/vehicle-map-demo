import { useState } from 'react';
import DeckGL from '@deck.gl/react';
import {IconLayer} from '@deck.gl/layers';
import {StaticMap, Popup, _MapContext as MapContext} from 'react-map-gl';

import iconAtlas from './icons/icons.png';
import iconMapping from './icons/icons.json';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Vehicle } from './useVehicleData';

// Set your mapbox access token here
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const MAPBOX_MAP_STYLE = process.env.REACT_APP_MAPBOX_MAP_STYLE;

// Viewport settings
const INITIAL_VIEW_STATE = {
  longitude: 10.757933,
  latitude: 59.911491,
  zoom: 13,
  pitch: 0,
  bearing: 0
};

export default function Map({ data }: any) {

  const [popupInfo, setPopupInfo] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);

  const layers = [
    new IconLayer({
      id: 'icon-layer',
      data,
      pickable: true,
      iconAtlas,
      iconMapping,
      getIcon: (d: any) => {
        return d.icon;
      },
      getSize: () => 50,
      getPosition: (vehicleMapPoint: any) => {
        const vehicle: Vehicle = vehicleMapPoint.vehicle;
        if (popupInfo && popupInfo.vehicleId === vehicle.vehicleId) {
          setPopupInfo(vehicle);
        }

        return [vehicle.location.longitude, vehicle.location.latitude];
      },
      onClick: (info: any) => setPopupInfo(info?.object?.vehicle),
      onHover: (info: any) => setHoverInfo(info?.object?.vehicle)
    })
  ];

  return (
<DeckGL
      ContextProvider={MapContext.Provider}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
    >
      {popupInfo && popupInfo.location && (
        <Popup
          key="popup"
          longitude={popupInfo.location.longitude}
          latitude={popupInfo.location.latitude}
          closeButton
          closeOnClick
          onClose={() => setPopupInfo(null)}
          anchor="bottom"
        >
          <div style={{backgroundColor:'white', padding: '10px', width:'500px', textAlign: 'left'}}>
            <pre>{JSON.stringify(popupInfo, null, 2)}</pre>
          </div>
        </Popup>
      )}
      {hoverInfo && hoverInfo.location && (
        <Popup
          key="hover"
          closeButton={false}
          longitude={hoverInfo.location.longitude}
          latitude={hoverInfo.location.latitude}
          anchor="bottom"
        >
          { hoverInfo.lineRef }
        </Popup>
      )}
      <StaticMap
        key="map"
        width="100%"
        height="100%"
        mapStyle={MAPBOX_MAP_STYLE}
        mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} />
    </DeckGL>
  );
}
