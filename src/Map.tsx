import { useState } from 'react';
import DeckGL from '@deck.gl/react';
import {IconLayer} from '@deck.gl/layers';
import {StaticMap, Popup, _MapContext as MapContext} from 'react-map-gl';

import iconAtlas from './icons/icons.png';
import iconMapping from './icons/icons.json';

import 'mapbox-gl/dist/mapbox-gl.css';

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

  const [tooltipInfo, setTooltipInfo] = useState<any>(null);
  const layers = [
    new IconLayer({
      id: 'icon-layer',
      data,
      pickable: true,
      iconAtlas,
      iconMapping,
      getIcon: (d: any) => Object.keys(iconMapping).includes(d.mode.toLowerCase()) ? d.mode.toLowerCase() : 'question',
      // icon size is based on data point's contributions, between 2 - 25
      //getSize: (d: any) => Math.max(2, Math.min(d.contributions / 1000 * 25, 25)),
      //sizeScale: 15,
      getSize: (d: any) => 50,
      getPosition: (d: any) => {
        if (tooltipInfo) {
          if (tooltipInfo.vehicleId === d.vehicleId) {
            setTooltipInfo(d);
          }
        }

        return [d.location.longitude, d.location.latitude];
      },
      //onHover: (info: any) => setTooltipInfo(info),
      onClick: (info: any) => setTooltipInfo(info.object)
    })
  ];

  return (
<DeckGL
      ContextProvider={MapContext.Provider}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
    >
      {tooltipInfo && tooltipInfo.location && (
        <Popup
          key="popup"
          longitude={tooltipInfo.location.longitude}
          latitude={tooltipInfo.location.latitude}
          closeButton
          closeOnClick
          onClose={() => setTooltipInfo(null)}
          anchor="top"
        >
          <div style={{backgroundColor:'white', padding: '10px', width:'500px', textAlign: 'left'}}>
            <pre>{JSON.stringify(tooltipInfo, null, 2)}</pre>
          </div>
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

/*

    */
