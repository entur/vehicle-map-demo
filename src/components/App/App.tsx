import React, { useCallback, useEffect, useState } from "react";
import { Map } from "../Map";
import { ControlPanel } from "components/ControlPanel";
import useVehicleData from "hooks/useVehicleData";
import "./App.scss";
import { Filter } from "model/filter";
import { Options } from "model/options";
import { SubscriptionOptions } from "model/subscriptionOptions";
import { VehicleMapPoint } from "model/vehicleMapPoint";
import { LineLayerOptions } from "model/lineLayerOptions";

const defaultFilter: Filter = {
  monitored: true,
};

const defaultSubscriptionOptions: SubscriptionOptions = {
  enableLiveUpdates: true,
  bufferSize: 20,
  bufferTime: 250,
};

const defaultOptions: Options = {
  sweepIntervalMs: 1000,
  removeExpired: true,
  removeExpiredAfterSeconds: 3600,
  markInactive: true,
  markInactiveAfterSeconds: 60,
};

const defaultLineLayerOptions: LineLayerOptions = {
  includePointsOnLink: false,
  showHistoricalPath: false,
};

export const App = () => {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [subscriptionOptions, setSubscriptionOptions] =
    useState<SubscriptionOptions>(defaultSubscriptionOptions);
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [lineLayerOptions, setLineLayerOptions] = useState<LineLayerOptions>(
    defaultLineLayerOptions
  );
  const { vehicles, statistics } = useVehicleData(
    filter,
    subscriptionOptions,
    options,
    lineLayerOptions
  );

  const [followVehicleMapPoint, setFollowVehicleMapPoint] =
    useState<VehicleMapPoint | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("vehicleRef");

    if (id) {
      const vehicleMapPoint = vehicles.get(id);
      if (vehicleMapPoint && vehicleMapPoint !== followVehicleMapPoint) {
        setFollowVehicleMapPoint(vehicleMapPoint);
      }
    }
  }, [vehicles, followVehicleMapPoint]);

  const updateFollowVehicle = useCallback((newVehicleRef: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("vehicleRef", newVehicleRef);
    window.location.search = params.toString();
  }, []);

  return (
    <div className="App">
      <div className="control-panel-wrapper">
        <ControlPanel
          statistics={statistics}
          filter={filter}
          setFilter={setFilter}
          subscriptionOptions={subscriptionOptions}
          setSubscriptionOptions={setSubscriptionOptions}
          options={options}
          setOptions={setOptions}
          lineLayerOptions={lineLayerOptions}
          setLineLayerOptions={setLineLayerOptions}
        />
      </div>
      <div className="map-wrapper">
        <Map
          vehicles={vehicles}
          followVehicleMapPoint={followVehicleMapPoint}
          setFollowVehicleRef={updateFollowVehicle}
          lineLayerOptions={lineLayerOptions}
        />
      </div>
    </div>
  );
};
