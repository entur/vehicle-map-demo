import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, Marker, useMap} from 'react-map-gl/maplibre';
import {StyleSpecification} from "@maplibre/maplibre-gl-style-spec";

import { createClient } from 'graphql-ws';
import {useEffect, useRef, useState} from "react";

const client = createClient({
    url: 'wss://api.entur.io/realtime/v2/vehicles/subscriptions',
});

const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm', // This must match the source key above
    },
  ],
};

type Filter = {
    boundingBox : number[][],
}

const useVehiclePositionsData = (filter : Filter | null) => {
    const [data, setData] = useState<any[]>([]);
    const map = useRef({});
    const subscription = useRef(null);
    useEffect(() => {
        if (filter) {
            if (subscription.current) {
                subscription.current.return();
            }
                subscription.current = client.iterate({
                    query: `subscription {
                  vehicles (boundingBox: {minLat: ${filter.boundingBox[0][1]}, minLon: ${filter.boundingBox[0][0]}, maxLat: ${filter.boundingBox[1][1]}, maxLon: ${filter.boundingBox[1][0]}}) {
                    vehicleId
                    line {lineRef}
                    lastUpdated
                    location {
                      latitude
                      longitude
                    }
                  }
                }`
                });
        const subscribe = async () => {
            for await (const event of subscription.current) {
                // @ts-ignore
                for (const v of event?.data?.vehicles) {
                    if (v.location && v.location.latitude && v.location.longitude) {
                        map.current[v.vehicleId] = v;
                    }
                }
                setData(Object.values(map.current));
            }
        }
            subscribe();
        }

    }, [filter]);
    return data;
}

function CaptureBoundingBox({setCurrentFilter} : {setCurrentFilter: (filter: Filter) => void}) {
    const {current: map} = useMap();

    const currentBoundingBox = [
        [map.getMap().getBounds().getSouthWest().lng, map.getMap().getBounds().getSouthWest().lat],
        [map.getMap().getBounds().getNorthEast().lng, map.getMap().getBounds().getNorthEast().lat]
    ];

    useEffect (() => {
        setCurrentFilter({boundingBox: currentBoundingBox});
    }, [currentBoundingBox[0][0] , currentBoundingBox[0][1], currentBoundingBox[1][0], currentBoundingBox[1][1]]);
    return null;
}

function App() {
    const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
    const data = useVehiclePositionsData(currentFilter);
  return (
      <div style={{width:'100vw', height:'100vh'}}>

        <Map
            initialViewState={{
              longitude: 10.0,
              latitude: 64.0,
              zoom: 4
            }}
            mapStyle={mapStyle}
        >
          <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
            {data?.map((v) => (
                <Marker key={v.vehicleId} longitude={v.location.longitude} latitude={v.location.latitude} anchor="bottom"/>
            ))}
        </Map>
      </div>
  );
}

export default App;
