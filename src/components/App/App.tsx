import React, { useState } from "react";
import { Map } from "../Map";
import { ControlPanel } from "components/ControlPanel";
import useVehicleData from "hooks/useVehicleData";
import "./App.scss";
import { Filter } from "model/filter";
import { Options } from "model/options";
import { SubscriptionOptions } from "model/subscriptionOptions";
import useVehicleReducer from "hooks/useVehicleReducer";

const defaultFilter: Filter = {
  monitored: true,
};

const defaultSubscriptionOptions: SubscriptionOptions = {
  enableLiveUpdates: true,
  bufferSize: 20,
  bufferTime: 250,
};

const defaultOptions: Options = {
  swipeIntervalMs: 1000,
  removeExpired: true,
  removeExpiredAfterSeconds: 3600,
  markInactive: true,
  markInactiveAfterSeconds: 60,
};

export const App = () => {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [
    subscriptionOptions,
    setSubscriptionOptions,
  ] = useState<SubscriptionOptions>(defaultSubscriptionOptions);
  const [options, setOptions] = useState<Options>(defaultOptions);

  const [
    { vehicles, statistics },
    { hydrate, update, sweep },
  ] = useVehicleReducer();

  useVehicleData(filter, subscriptionOptions, options, hydrate, update, sweep);

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
        />
      </div>
      <div className="map-wrapper">
        <Map vehicles={vehicles} />
      </div>
    </div>
  );
};
