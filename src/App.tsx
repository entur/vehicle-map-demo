import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, Marker, useMap} from 'react-map-gl/maplibre';
import {StyleSpecification} from "@maplibre/maplibre-gl-style-spec";

import {createClient, FormattedExecutionResult} from 'graphql-ws';
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
    boundingBox: (number | undefined)[][],
}

type Data = {
  vehicles: VehicleUpdate
}

type VehicleUpdate = {
  vehicleId: string
  location: {
    latitude: number,
    longitude: number
  }
}

const useVehiclePositionsData = (filter : Filter | null) => {
    const [data, setData] = useState<VehicleUpdate[]>([]);
    const map = useRef<Record<string, VehicleUpdate>>({});
    const subscription = useRef<AsyncIterableIterator<FormattedExecutionResult<Data, unknown>>>(null);
    useEffect(() => {
        if (subscription.current !== null) {
            // @ts-ignore
            subscription.current?.return();
        }

        subscription.current = client.iterate<Data>({
            query: `subscription($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!) {
                      vehicles (boundingBox: {minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon}) {
                        vehicleId
                        line {lineRef}
                        lastUpdated
                        location {
                          latitude
                          longitude
                        }
                      }
                    }`,
          variables: {
              minLon: filter?.boundingBox[0][0],
              minLat: filter?.boundingBox[0][1],
              maxLon: filter?.boundingBox[1][0],
              maxLat: filter?.boundingBox[1][1],
          }
        });
        const subscribe = async () => {
            for await (const event of subscription.current!) {
                // @ts-ignore
                for (const v of event.data.vehicles) {
                  if (v.location && v.location.latitude && v.location.longitude) {
                    map.current[v.vehicleId] = v;
                  }
                }
                setData(Object.values(map.current));
            }
        }
      if (filter) {
        subscribe();
      }
    }, [filter]);
    return data;
}

function CaptureBoundingBox({setCurrentFilter} : {setCurrentFilter: (filter: Filter) => void}) {
    const {current: map} = useMap();

    const currentBoundingBox = [
        [map?.getMap().getBounds().getSouthWest().lng, map?.getMap().getBounds().getSouthWest().lat],
        [map?.getMap().getBounds().getNorthEast().lng, map?.getMap().getBounds().getNorthEast().lat]
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
