import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {StyleSpecification} from "@maplibre/maplibre-gl-style-spec";

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
function App() {
  return (
      <div style={{width:'100vw', height:'100vh'}}>
        <Map
            initialViewState={{
              longitude: 10.0,
              latitude: 64.0,
              zoom: 4
            }}
            mapStyle={mapStyle}
        />
      </div>
  );
}

export default App;
