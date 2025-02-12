import {Map, Marker} from "react-map-gl/maplibre";
import {mapStyle} from "./mapStyle.ts";
import {CaptureBoundingBox} from "./CaptureBoundingBox.tsx";
import {Filter, VehicleUpdate} from "./types.ts";
import 'maplibre-gl/dist/maplibre-gl.css';

type MapViewProps = {
  data: VehicleUpdate[];
  setCurrentFilter: (filter: Filter) => void;
}

export function MapView({data, setCurrentFilter}: MapViewProps) {
  return (
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
  )
}
