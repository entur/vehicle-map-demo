import { PrimaryButton } from '@entur/button';
import { Checkbox, Switch, TextField } from '@entur/form';
import { Contrast } from '@entur/layout';
import { Heading4, ListItem, UnorderedList } from '@entur/typography';
import { Statistics } from 'model/statistics';
import { SubscriptionFilter } from 'model/subscriptionFilter';
import { Options } from 'model/options';
import { useState } from 'react';
import logo from 'static/img/logo.png';

import './ControlPanel.scss';

type Props = {
  statistics: Statistics,
  onSubscriptionFilterUpdate: (subscriptionFilter: SubscriptionFilter) => void;
  onOptionsUdate: (options: Options) => void;
};

const defaultSubscriptionFilter: SubscriptionFilter = {
  monitored: true
};

const defaultOptions: Options = {
  updateIntervalMs: 250,
  swipeIntervalMs: 1000,
  removeExpired: true,
  removeExpiredAfterSeconds: 3600,
  markInactive: true,
  markInactiveAfterSeconds: 60
};

export const ControlPanel = (props: Props) => {
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>(defaultSubscriptionFilter);
  const [options, setOptions] = useState<Options>(defaultOptions);

  return (
    <Contrast className="control-panel-wrapper">
      <div className="logo-wrapper">
        <img
          className="logo"
          src={logo}
          alt="Entur logo"
        />
        <span>Vehicle Map Demo</span>
      </div>

      <div className="control-panel-content">
        <Heading4>Statistics</Heading4>
        <UnorderedList>
          <ListItem>Number of vehicles: {props.statistics.numberOfVehicles}</ListItem>
          <ListItem>Number of inactive vehicles: {props.statistics.numberOfInactiveVehicles}</ListItem>
          <ListItem>Number of expired vehicles: {props.statistics.numberOfExpiredVehicles}</ListItem>
          <ListItem>Number of updates in session: {props.statistics.numberOfUpdatesInSession}</ListItem>
        </UnorderedList>
      </div>

      <div className="control-panel-content">
        <Heading4>Subscription filters</Heading4>
        <TextField label="Codespace" value={subscriptionFilter.codespace} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, codespace: event.target.value })} />
        <TextField label="Service journey" value={subscriptionFilter.serviceJourneyId} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, serviceJourneyId: event.target.value })}/>
        <TextField label="Operator" value={subscriptionFilter.operator} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, operator: event.target.value })} />
        <TextField label="Vehicle ID" value={subscriptionFilter.vehicleId} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, vehicleId: event.target.value })} />
        <TextField label="Line ref" value={subscriptionFilter.lineRef} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, lineRef: event.target.value })} />
        <TextField label="Line name" value={subscriptionFilter.lineName} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, lineName: event.target.value })} />
        <TextField label="Bounding box" value={subscriptionFilter.boundingBox} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, boundingBox: event.target.value })} />
        <Switch checked={subscriptionFilter.monitored} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, monitored: event.target.checked })}>Monitored</Switch>
        <PrimaryButton
          onClick={() => props.onSubscriptionFilterUpdate(subscriptionFilter)}
        >
          Update subscription filters
        </PrimaryButton>
      </div>

      <div className="control-panel-content">
        <Heading4>Options</Heading4>
        <TextField type="number" label="Update interval (ms)" value={options.updateIntervalMs} onChange={(event) => setOptions({ ...options, updateIntervalMs: parseInt(event.target.value) })} />
        <TextField type="number" label="Swipe interval (ms)" value={options.swipeIntervalMs} onChange={(event) => setOptions({ ...options, swipeIntervalMs: parseInt(event.target.value) })} />
        <Switch checked={options.removeExpired} onChange={(event) => setOptions({ ...options, removeExpired: event.target.checked })}>Remove expired vehicles from map</Switch>
        <TextField style={{ display: !options.removeExpired ? 'none' : 'block'}} type="number" label="after N seconds" value={options.removeExpiredAfterSeconds} onChange={(event) => setOptions({ ...options, removeExpiredAfterSeconds: parseInt(event.target.value) })}/>
        <Switch checked={options.markInactive} onChange={(event) => setOptions({ ...options, markInactive: event.target.checked })}>Mark vehicles as inactive</Switch>
        <TextField style={{ display: !options.markInactive ? 'none' : 'block'}} type="number" label="after N seconds" value={options.markInactiveAfterSeconds} onChange={(event) => setOptions({ ...options, markInactiveAfterSeconds: parseInt(event.target.value) })}/>
        <PrimaryButton
          onClick={() => props.onOptionsUdate(options)}
        >
          Update options
        </PrimaryButton>
      </div>
    </Contrast>
  );
};
