import { useState } from "react";
import { PrimaryButton } from "@entur/button";
import { Switch, TextField } from "@entur/form";
import { Contrast } from "@entur/layout";
import { Heading4, ListItem, UnorderedList } from "@entur/typography";
import { Dropdown } from "@entur/dropdown";
import { Statistics } from "model/statistics";
import { SubscriptionFilter } from "model/subscriptionFilter";
import { Options } from "model/options";
import logo from "static/img/logo.png";
import useCodespaceData from "hooks/useCodespaceData";
import useLinesData from "hooks/useLinesData";
import { VEHICLE_MODE } from "model/vehicleMode";
import "./ControlPanel.scss";
type Props = {
  statistics: Statistics;
  onSubscriptionFilterUpdate: (subscriptionFilter: SubscriptionFilter) => void;
  onOptionsUdate: (options: Options) => void;
};

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

const DROPDOWN_DEFAULT_VALUE = "-- Not selected --";

export const ControlPanel = (props: Props) => {
  const [
    subscriptionFilter,
    setSubscriptionFilter,
  ] = useState<SubscriptionFilter>(defaultSubscriptionFilter);
  const [options, setOptions] = useState<Options>(defaultOptions);

  const codespaces = useCodespaceData();
  const lines = useLinesData(subscriptionFilter?.codespaceId);

  return (
    <Contrast>
      <div className="logo-wrapper">
        <img className="logo" src={logo} alt="Entur logo" />
        <span>Vehicle Map Demo</span>
      </div>

      <div className="control-panel-content">
        <Heading4>Statistics</Heading4>
        <UnorderedList>
          <ListItem>
            Number of vehicles: {props.statistics.numberOfVehicles}
          </ListItem>
          <ListItem>
            Number of inactive vehicles:{" "}
            {props.statistics.numberOfInactiveVehicles}
          </ListItem>
          <ListItem>
            Number of expired vehicles:{" "}
            {props.statistics.numberOfExpiredVehicles}
          </ListItem>
          <ListItem>
            Number of updates in session:{" "}
            {props.statistics.numberOfUpdatesInSession}
          </ListItem>
        </UnorderedList>
      </div>

      <div className="control-panel-content">
        <Heading4>Subscription filters</Heading4>
        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(codespaces)}
          value={subscriptionFilter.codespaceId || DROPDOWN_DEFAULT_VALUE}
          label="Codespace"
          onChange={(item) => {
            const { codespaceId, lineRef, ...rest } = subscriptionFilter;
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              setSubscriptionFilter({
                ...rest,
              });
            } else {
              setSubscriptionFilter({
                ...rest,
                codespaceId: item?.value,
              });
            }
          }}
        />
        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(lines)}
          value={subscriptionFilter.lineRef || DROPDOWN_DEFAULT_VALUE}
          label="Line ref"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { lineRef, ...rest } = subscriptionFilter;
              setSubscriptionFilter({ ...rest });
            } else {
              setSubscriptionFilter({
                ...subscriptionFilter,
                lineRef: item?.value,
              });
            }
          }}
        />
        <Dropdown
          items={[DROPDOWN_DEFAULT_VALUE].concat(Object.values(VEHICLE_MODE))}
          value={
            subscriptionFilter.mode?.toLowerCase() || DROPDOWN_DEFAULT_VALUE
          }
          label="Mode"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { mode, ...rest } = subscriptionFilter;
              setSubscriptionFilter({ ...rest });
            } else {
              setSubscriptionFilter({
                ...subscriptionFilter,
                mode: item?.value?.toUpperCase(),
              });
            }
          }}
        />
        <TextField
          label="Service journey"
          value={subscriptionFilter.serviceJourneyId}
          onChange={(event) =>
            setSubscriptionFilter({
              ...subscriptionFilter,
              serviceJourneyId: event.target.value,
            })
          }
        />
        <TextField
          label="Operator"
          value={subscriptionFilter.operator}
          onChange={(event) =>
            setSubscriptionFilter({
              ...subscriptionFilter,
              operator: event.target.value,
            })
          }
        />

        <TextField
          label="Vehicle ID"
          value={subscriptionFilter.vehicleId}
          onChange={(event) =>
            setSubscriptionFilter({
              ...subscriptionFilter,
              vehicleId: event.target.value,
            })
          }
        />
        <TextField
          label="Bounding box"
          value={subscriptionFilter.boundingBox}
          onChange={(event) =>
            setSubscriptionFilter({
              ...subscriptionFilter,
              boundingBox: event.target.value,
            })
          }
        />
        <Switch
          checked={subscriptionFilter.monitored}
          onChange={(event) => {
            if (event.target.checked) {
              setSubscriptionFilter({
                ...subscriptionFilter,
                monitored: event.target.checked,
              });
            } else {
              const { monitored, ...rest } = subscriptionFilter;
              setSubscriptionFilter({ ...rest });
            }
          }}
        >
          Monitored only
        </Switch>
        <PrimaryButton
          onClick={() => props.onSubscriptionFilterUpdate(subscriptionFilter)}
        >
          Update subscription filters
        </PrimaryButton>
      </div>

      <div className="control-panel-content">
        <Heading4>Options</Heading4>
        <TextField
          type="number"
          label="Update interval (ms)"
          value={options.updateIntervalMs}
          onChange={(event) =>
            setOptions({
              ...options,
              updateIntervalMs: parseInt(event.target.value),
            })
          }
        />
        <TextField
          type="number"
          label="Swipe interval (ms)"
          value={options.swipeIntervalMs}
          onChange={(event) =>
            setOptions({
              ...options,
              swipeIntervalMs: parseInt(event.target.value),
            })
          }
        />
        <Switch
          checked={options.removeExpired}
          onChange={(event) =>
            setOptions({ ...options, removeExpired: event.target.checked })
          }
        >
          Remove expired vehicles from map
        </Switch>
        <TextField
          style={{ display: !options.removeExpired ? "none" : "block" }}
          type="number"
          label="after N seconds"
          value={options.removeExpiredAfterSeconds}
          onChange={(event) =>
            setOptions({
              ...options,
              removeExpiredAfterSeconds: parseInt(event.target.value),
            })
          }
        />
        <Switch
          checked={options.markInactive}
          onChange={(event) =>
            setOptions({ ...options, markInactive: event.target.checked })
          }
        >
          Mark vehicles as inactive
        </Switch>
        <TextField
          style={{ display: !options.markInactive ? "none" : "block" }}
          type="number"
          label="after N seconds"
          value={options.markInactiveAfterSeconds}
          onChange={(event) =>
            setOptions({
              ...options,
              markInactiveAfterSeconds: parseInt(event.target.value),
            })
          }
        />
        <PrimaryButton onClick={() => props.onOptionsUdate(options)}>
          Update options
        </PrimaryButton>
      </div>
    </Contrast>
  );
};
