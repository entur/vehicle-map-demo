import React, { useState } from "react";
import { Map } from "../Map";
import { ControlPanel } from "components/ControlPanel";
import useVehicleData from "hooks/useVehicleData";
import "./App.scss";
import { SubscriptionFilter } from "model/subscriptionFilter";
import { Options } from "model/options";

export const App = () => {
  const [subscriptionFilter, setSubscriptionFilter] = useState<
    SubscriptionFilter | undefined
  >();
  const [options, setOptions] = useState<Options | undefined>();
  const { vehicles, statistics } = useVehicleData(subscriptionFilter, options);

  return (
    <div className="App">
      <div className="control-panel-wrapper">
        <ControlPanel
          statistics={statistics}
          onSubscriptionFilterUpdate={setSubscriptionFilter}
          onOptionsUdate={setOptions}
        />
      </div>
      <div className="map-wrapper">
        <Map data={Object.values(vehicles)} />
      </div>
    </div>
  );
};
