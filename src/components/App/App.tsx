import React, { useState } from "react";
import { Map } from "../Map";
import { ControlPanel } from "components/ControlPanel";
import useVehicleData from "hooks/useVehicleData";
import "./App.scss";
import { SubscriptionFilter } from "model/subscriptionFilter";
import { Options } from "model/options";

const defaultSubscriptionFilter: SubscriptionFilter = {
  monitored: true,
};

const defaultOptions: Options = {
  updateIntervalMs: 250,
  swipeIntervalMs: 1000,
  removeExpired: true,
  removeExpiredAfterSeconds: 3600,
  markInactive: true,
  markInactiveAfterSeconds: 60,
};

export const App = () => {
  const [
    subscriptionFilter,
    setSubscriptionFilter,
  ] = useState<SubscriptionFilter>(defaultSubscriptionFilter);
  const [options, setOptions] = useState<Options>(defaultOptions);
  const { vehicles, statistics } = useVehicleData(subscriptionFilter, options);

  return (
    <div className="App">
      <div className="control-panel-wrapper">
        <ControlPanel
          statistics={statistics}
          subscriptionFilter={subscriptionFilter}
          setSubscriptionFilter={setSubscriptionFilter}
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
