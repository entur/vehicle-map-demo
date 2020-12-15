import { Switch, TextField } from "@entur/form";
import { Contrast } from "@entur/layout";
import { Heading4, ListItem, UnorderedList } from "@entur/typography";
import { Dropdown } from "@entur/dropdown";
import { Statistics } from "model/statistics";
import { SubscriptionFilter } from "model/subscriptionFilter";
import { Options } from "model/options";
import { VEHICLE_MODE } from "model/vehicleMode";
import useCodespaceIds from "hooks/useCodespaceIds";
import useLineRefs from "hooks/useLineRefs";
import useServiceJourneyIds from "hooks/useServiceJourneyIds";
import logo from "static/img/logo.png";
import "./ControlPanel.scss";
import useOperatorRefs from "hooks/useOperatorRefs";

type Props = {
  statistics: Statistics;
  subscriptionFilter: SubscriptionFilter;
  setSubscriptionFilter: (subscriptionFilter: SubscriptionFilter) => void;
  options: Options;
  setOptions: (options: Options) => void;
};

const DROPDOWN_DEFAULT_VALUE = "-- Not selected --";

export const ControlPanel = (props: Props) => {
  const {
    statistics,
    subscriptionFilter,
    setSubscriptionFilter,
    options,
    setOptions,
  } = props;

  const codespaceIds = useCodespaceIds();
  const lineRefs = useLineRefs(subscriptionFilter?.codespaceId);
  const serviceJourneyIds = useServiceJourneyIds(subscriptionFilter?.lineRef);
  const operatorRefs = useOperatorRefs(subscriptionFilter?.codespaceId);

  return (
    <Contrast>
      <div className="logo-wrapper">
        <img className="logo" src={logo} alt="Entur logo" />
        <span>Vehicle Map Demo</span>
      </div>

      <div className="control-panel-content">
        <Heading4>Statistics</Heading4>
        <UnorderedList>
          <ListItem>Number of vehicles: {statistics.numberOfVehicles}</ListItem>
          <ListItem>
            Number of inactive vehicles: {statistics.numberOfInactiveVehicles}
          </ListItem>
          <ListItem>
            Number of expired vehicles: {statistics.numberOfExpiredVehicles}
          </ListItem>
          <ListItem>
            Number of updates in session: {statistics.numberOfUpdatesInSession}
          </ListItem>
        </UnorderedList>
      </div>

      <div className="control-panel-content">
        <Heading4>Subscription filters</Heading4>
        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(codespaceIds)}
          value={subscriptionFilter.codespaceId || DROPDOWN_DEFAULT_VALUE}
          label="Codespace ID"
          onChange={(item) => {
            const {
              codespaceId,
              lineRef,
              serviceJourneyId,
              operatorRef,
              ...rest
            } = subscriptionFilter;
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
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(lineRefs)}
          value={subscriptionFilter.lineRef || DROPDOWN_DEFAULT_VALUE}
          label="Line ref"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { lineRef, serviceJourneyId, ...rest } = subscriptionFilter;
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
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(serviceJourneyIds)}
          value={subscriptionFilter.serviceJourneyId || DROPDOWN_DEFAULT_VALUE}
          label="Service journey ID"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { serviceJourneyId, ...rest } = subscriptionFilter;
              setSubscriptionFilter({ ...rest });
            } else {
              setSubscriptionFilter({
                ...subscriptionFilter,
                serviceJourneyId: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(operatorRefs)}
          value={subscriptionFilter.operatorRef || DROPDOWN_DEFAULT_VALUE}
          label="Operator ref"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { operatorRef, ...rest } = subscriptionFilter;
              setSubscriptionFilter({ ...rest });
            } else {
              setSubscriptionFilter({
                ...subscriptionFilter,
                operatorRef: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={[DROPDOWN_DEFAULT_VALUE].concat(Object.values(VEHICLE_MODE))}
          value={
            subscriptionFilter.mode?.toLowerCase() || DROPDOWN_DEFAULT_VALUE
          }
          label="Vehicle mode"
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
      </div>

      <div className="control-panel-content">
        <Heading4>Options</Heading4>
        <Switch
          checked={options.enableLiveUpdates}
          onChange={(event) =>
            setOptions({ ...options, enableLiveUpdates: event.target.checked })
          }
        >
          Enable live updates
        </Switch>
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
      </div>
    </Contrast>
  );
};
