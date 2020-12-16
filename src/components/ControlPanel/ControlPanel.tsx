import { Switch, TextField } from "@entur/form";
import { Contrast } from "@entur/layout";
import { Heading4, ListItem, UnorderedList } from "@entur/typography";
import { Dropdown } from "@entur/dropdown";
import { Statistics } from "model/statistics";
import { Filter } from "model/filter";
import { Options } from "model/options";
import { VEHICLE_MODE } from "model/vehicleMode";
import useCodespaceIds from "hooks/useCodespaceIds";
import useLineRefs from "hooks/useLineRefs";
import useServiceJourneyIds from "hooks/useServiceJourneyIds";
import logo from "static/img/logo.png";
import "./ControlPanel.scss";
import useOperatorRefs from "hooks/useOperatorRefs";
import { SubscriptionOptions } from "model/subscriptionOptions";

type Props = {
  statistics: Statistics;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  subscriptionOptions: SubscriptionOptions;
  setSubscriptionOptions: (subscriptionOptions: SubscriptionOptions) => void;
  options: Options;
  setOptions: (options: Options) => void;
};

const DROPDOWN_DEFAULT_VALUE = "-- Not selected --";

export const ControlPanel = (props: Props) => {
  const {
    statistics,
    filter,
    setFilter,
    subscriptionOptions,
    setSubscriptionOptions,
    options,
    setOptions,
  } = props;

  const codespaceIds = useCodespaceIds();
  const lineRefs = useLineRefs(filter?.codespaceId);
  const serviceJourneyIds = useServiceJourneyIds(filter?.lineRef);
  const operatorRefs = useOperatorRefs(filter?.codespaceId);

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
        <Heading4>Filters</Heading4>
        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(codespaceIds)}
          value={filter.codespaceId || DROPDOWN_DEFAULT_VALUE}
          label="Codespace ID"
          onChange={(item) => {
            const {
              codespaceId,
              lineRef,
              serviceJourneyId,
              operatorRef,
              ...rest
            } = filter;
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              setFilter({
                ...rest,
              });
            } else {
              setFilter({
                ...rest,
                codespaceId: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(lineRefs)}
          value={filter.lineRef || DROPDOWN_DEFAULT_VALUE}
          label="Line ref"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { lineRef, serviceJourneyId, ...rest } = filter;
              setFilter({ ...rest });
            } else {
              setFilter({
                ...filter,
                lineRef: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(serviceJourneyIds)}
          value={filter.serviceJourneyId || DROPDOWN_DEFAULT_VALUE}
          label="Service journey ID"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { serviceJourneyId, ...rest } = filter;
              setFilter({ ...rest });
            } else {
              setFilter({
                ...filter,
                serviceJourneyId: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={() => [DROPDOWN_DEFAULT_VALUE].concat(operatorRefs)}
          value={filter.operatorRef || DROPDOWN_DEFAULT_VALUE}
          label="Operator ref"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { operatorRef, ...rest } = filter;
              setFilter({ ...rest });
            } else {
              setFilter({
                ...filter,
                operatorRef: item?.value,
              });
            }
          }}
        />

        <Dropdown
          items={[DROPDOWN_DEFAULT_VALUE].concat(Object.values(VEHICLE_MODE))}
          value={filter.mode?.toLowerCase() || DROPDOWN_DEFAULT_VALUE}
          label="Vehicle mode"
          onChange={(item) => {
            if (item?.value === DROPDOWN_DEFAULT_VALUE) {
              const { mode, ...rest } = filter;
              setFilter({ ...rest });
            } else {
              setFilter({
                ...filter,
                mode: item?.value?.toUpperCase(),
              });
            }
          }}
        />

        <Switch
          checked={filter.monitored}
          onChange={(event) => {
            if (event.target.checked) {
              setFilter({
                ...filter,
                monitored: event.target.checked,
              });
            } else {
              const { monitored, ...rest } = filter;
              setFilter({ ...rest });
            }
          }}
        >
          Monitored only
        </Switch>
      </div>

      <div className="control-panel-content">
        <Heading4>Live updates</Heading4>
        <Switch
          checked={subscriptionOptions.enableLiveUpdates}
          onChange={(event) =>
            setSubscriptionOptions({
              ...subscriptionOptions,
              enableLiveUpdates: event.target.checked,
            })
          }
        >
          Enable live updates
        </Switch>

        {subscriptionOptions.enableLiveUpdates && (
          <>
            <TextField
              type="number"
              label="Buffer size"
              value={subscriptionOptions.bufferSize}
              onChange={(event) =>
                setSubscriptionOptions({
                  ...subscriptionOptions,
                  bufferSize: parseInt(event.target.value),
                })
              }
            />

            <TextField
              type="number"
              label="Buffer time (ms)"
              value={subscriptionOptions.bufferTime}
              onChange={(event) =>
                setSubscriptionOptions({
                  ...subscriptionOptions,
                  bufferTime: parseInt(event.target.value),
                })
              }
            />
          </>
        )}
      </div>
      <div className="control-panel-content">
        <Heading4>Other settings</Heading4>
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
