import { PrimaryButton } from '@entur/button';
import { Checkbox, TextField } from '@entur/form';
import { Contrast } from '@entur/layout';
import { Label } from '@entur/typography';
import logo from 'static/img/logo.png';

import './ControlPanel.scss';

export const ControlPanel = () =>
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
      <TextField label="Codespace" />
      <TextField label="Service journey" />
      <TextField label="Operator" />
      <TextField label="Vehicle ID" />
      <TextField label="Line ref" />
      <TextField label="Line name" />
      <TextField label="Bounding box" />
      <Checkbox>Monitored</Checkbox>
      <PrimaryButton>Update subscription</PrimaryButton>
    </div>

    <div className="control-panel-content">
      <Label>Map options</Label><br />
      <Checkbox>Remove expired vehicles from map</Checkbox>
      <TextField label="or after N seconds" />
      <Checkbox>Mark vehicles as inactive</Checkbox>
      <TextField label="after N seconds" />
      <PrimaryButton>Update map</PrimaryButton>
    </div>
  </Contrast>
