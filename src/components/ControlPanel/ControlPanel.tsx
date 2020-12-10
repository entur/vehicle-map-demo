import { PrimaryButton } from '@entur/button';
import { Checkbox, TextField } from '@entur/form';
import { Contrast } from '@entur/layout';
import { Label } from '@entur/typography';
import { Statistics } from 'model/statistics';
import { useState } from 'react';
import logo from 'static/img/logo.png';

import './ControlPanel.scss';

type SubscriptionFilter = {
  codespace?: string;
  serviceJourneyId?: string;
  operator?: string;
  vehicleId?: string;
  lineRef?: string;
  lineName?: string;
  boundingBox?: string;
  monitored?: boolean;
};

type Options = {
  updateInterval?: number;
  swipeInterval?: number;
  removeExpired?: boolean;
  removeExpiredAfterSeconds?: number;
  markInactive?: boolean;
  markInactiveAfter?: number;
};

type Props = {
  statistics: Statistics,
  onSubscriptionFilterUpdate: (subscriptionFilter: SubscriptionFilter) => void;
  onOptionsUdate: (options: Options) => void;
};

export const ControlPanel = (props: Props) => {
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>({});
  const [options, setOptions] = useState<Options>({});

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
      <Label>Statistics</Label>
      <ul>
        <li>Number of vehicles:</li>
        <li>Number of inactive vehicles:</li>
        <li>Number of expired vehicles:</li>
        <li>Number of updates in session:</li>
      </ul>
    </div>

    <div className="control-panel-content">
      <Label>Subscription filters</Label>
      <TextField label="Codespace" value={subscriptionFilter.codespace} onChange={(event) => setSubscriptionFilter({ ...subscriptionFilter, codespace: event.target.value })} />
      <TextField label="Service journey" />
      <TextField label="Operator" />
      <TextField label="Vehicle ID" />
      <TextField label="Line ref" />
      <TextField label="Line name" />
      <TextField label="Bounding box" />
      <Checkbox checked={true}>Monitored</Checkbox>
      <PrimaryButton
        onClick={() => props.onSubscriptionFilterUpdate(subscriptionFilter)}
      >
        Update subscription filters
      </PrimaryButton>
    </div>

    <div className="control-panel-content">
      <Label>Options</Label>
      <TextField type="number" label="Update interval (ms)" value="250" />
      <TextField type="number" label="Swipe interval (ms)" value="1000" />
      <Checkbox checked={true}>Remove expired vehicles from map</Checkbox>
      <TextField type="number" label="after N seconds" value="3600" />
      <Checkbox checked={true}>Mark vehicles as inactive</Checkbox>
      <TextField type="number" label="after N seconds" value="60" />
      <PrimaryButton
        onClick={() => props.onOptionsUdate(options)}
      >
        Update options
      </PrimaryButton>
    </div>
  </Contrast>
};
