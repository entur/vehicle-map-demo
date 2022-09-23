import { memo } from "react";
import { Dropdown } from "@entur/dropdown";
import { Heading4 } from "@entur/typography";
import { Filter } from "model/filter";
import { DROPDOWN_DEFAULT_VALUE } from "./constants";
import useCodespaceIds from "hooks/useCodespaceIds";
import useLineRefs from "hooks/useLineRefs";
import useServiceJourneyIds from "hooks/useServiceJourneyIds";
import useOperatorRefs from "hooks/useOperatorRefs";
import { Switch } from "@entur/form";
import { VEHICLE_MODE } from "model/vehicleMode";

type Props = {
  filter: Filter;
  setFilter: (filter: Filter) => void;
};

export const FiltersForm = memo(({ filter, setFilter }: Props) => {
  const codespaceIds = useCodespaceIds();
  const lineRefs = useLineRefs(filter?.codespaceId);
  const serviceJourneyIds = useServiceJourneyIds(filter?.lineRef);
  const operatorRefs = useOperatorRefs(filter?.codespaceId);

  return (
    <>
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
      <Switch
        checked={filter.includePointsOnLink}
        onChange={(event) => {
          setFilter({
            ...filter,
            includePointsOnLink: event.target.checked,
          });
        }}
      >
        Include points on link
      </Switch>
    </>
  );
});
