import React, { memo } from "react";
import { Contrast } from "@entur/layout";
import { Statistics } from "model/statistics";
import { Filter } from "model/filter";
import { Options } from "model/options";
import { SubscriptionOptions } from "model/subscriptionOptions";
import { StatisticsList } from "./StatisticsList";
import { FiltersForm } from "./FiltersForm";
import { SubscriptionOptionsForm } from "./SubscriptionOptionsForm";
import { OptionsForm } from "./OptionsForm";
import logo from "static/img/logo.png";
import "./ControlPanel.scss";
import { LineLayerOptionsForm } from "./LineLayerOptionsForm";
import { LineLayerOptions } from "model/lineLayerOptions";

type Props = {
  statistics: Statistics;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  subscriptionOptions: SubscriptionOptions;
  setSubscriptionOptions: (subscriptionOptions: SubscriptionOptions) => void;
  options: Options;
  setOptions: (options: Options) => void;
  lineLayerOptions: LineLayerOptions;
  setLineLayerOptions: (lineLayerOptions: LineLayerOptions) => void;
};

export const ControlPanel = memo((props: Props) => {
  return (
    <Contrast>
      <div className="logo-wrapper">
        <img className="logo" src={logo} alt="Entur logo" />
        <span>Vehicle Map Demo</span>
      </div>

      <div className="control-panel-content">
        <StatisticsList statistics={props.statistics} />
      </div>

      <div className="control-panel-content">
        <FiltersForm filter={props.filter} setFilter={props.setFilter} />
      </div>

      <div className="control-panel-content">
        <SubscriptionOptionsForm
          subscriptionOptions={props.subscriptionOptions}
          setSubscriptionOptions={props.setSubscriptionOptions}
        />
      </div>

      <div className="control-panel-content">
        <OptionsForm options={props.options} setOptions={props.setOptions} />
      </div>

      <div className="control-panel-content control-panel-content_last">
        <LineLayerOptionsForm
          options={props.lineLayerOptions}
          setOptions={props.setLineLayerOptions}
        />
      </div>
    </Contrast>
  );
});
